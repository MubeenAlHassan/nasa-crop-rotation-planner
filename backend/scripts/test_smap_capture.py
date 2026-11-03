"""Optional authorized SMAP preprocessing; pytest never downloads granules.

NSIDC V6 guide: https://nsidc.org/sites/default/files/documents/user-guide/
spl3smp_e-v006-userguide.pdf (AM pointer fields, flags, EASE2 global grid).
Metadata attributes are in Metadata/{Dataset,Series}Identification, not root
attributes. HDF5 is imported only when a caller supplies granules.
"""

from __future__ import annotations

import argparse
import copy
import json
import math
import re
import tempfile
from collections.abc import Mapping, Sequence
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pytest
from pydantic import JsonValue

SmapArchive = dict[str, JsonValue]
FARM_ID = "faisalabad_2025"
LOCATION = {"latitude": 31.4504, "longitude": 73.1350}
ARCHIVE_PATH = Path(__file__).resolve().parents[1] / "tests/fixtures/smap_archive.json"
SHAPE = (1624, 3856)
PIXEL_M = 9024.314
# Upper-left cell centre, EASE2 M09 global, EPSG:6933.
LEFT_CENTRE_M, TOP_CENTRE_M = -17367530.445, 7314540.831
ADVISORY_START, ADVISORY_END = date(2026, 5, 14), date(2026, 7, 28)
GRANULE_RE = re.compile(r"SMAP_L3_SM_P_E_(\d{8})_(R\d{5})_(\d{3})\.h5")
KEYS = {
    "schema_version",
    "provider",
    "farm_id",
    "location",
    "product",
    "version",
    "cell_id",
    "grid_posting_km",
    "retrieved_at",
    "granule_ids",
    "available",
    "unavailable_reason",
    "rows",
    "reference_rows",
}


def _number(value: object) -> bool:
    return type(value) in (int, float) and math.isfinite(value)


def _utc(value: object) -> datetime:
    if not isinstance(value, str):
        raise ValueError("Expected UTC timestamp")
    timestamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if timestamp.utcoffset() != timedelta(0):
        raise ValueError("Timestamp must be timezone-aware UTC")
    return timestamp


def _project(latitude: float, longitude: float) -> tuple[float, float]:
    """Ellipsoidal cylindrical equal-area projection (EPSG:6933)."""
    if not _number(latitude) or not _number(longitude):
        raise ValueError("Finite coordinates required")
    if not -85.044 <= latitude <= 85.044 or not -180 <= longitude <= 180:
        raise ValueError("Coordinates outside the SMAP global grid")
    radius, eccentricity = 6378137.0, math.sqrt(0.0066943799901413165)
    sine = math.sin(math.radians(latitude))
    k0 = math.cos(math.radians(30)) / math.sqrt(1 - eccentricity**2 * 0.25)
    q = (1 - eccentricity**2) * (
        sine / (1 - eccentricity**2 * sine**2)
        - math.log((1 - eccentricity * sine) / (1 + eccentricity * sine)) / (2 * eccentricity)
    )
    return radius * k0 * math.radians(longitude), radius * q / (2 * k0)


def resolve_cell(target_lat: float, target_lon: float) -> tuple[int, int]:
    """Containing native-grid cell; never search/snap to a distant valid cell."""
    x, y = _project(target_lat, target_lon)
    col = math.floor((x - (LEFT_CENTRE_M - PIXEL_M / 2)) / PIXEL_M)
    row = math.floor(((TOP_CENTRE_M + PIXEL_M / 2) - y) / PIXEL_M)
    if not 0 <= row < SHAPE[0] or not 0 <= col < SHAPE[1]:
        raise ValueError("Point is outside EASE2 M09")
    return row, col


def _granule_day(name: object) -> date:
    match = GRANULE_RE.fullmatch(name) if isinstance(name, str) else None
    if match is None:
        raise ValueError("Granule ID must retain the product, date, release and revision")
    day = datetime.strptime(match[1], "%Y%m%d").date()
    # Fail closed: this archive has no field proving an advisory reprocessing.
    if ADVISORY_START <= day <= ADVISORY_END:
        raise ValueError("Granule is inside the geolocation advisory")
    return day


def verify_smap_archive(archive: Mapping[str, JsonValue]) -> None:
    if not isinstance(archive, dict) or set(archive) != KEYS:
        raise ValueError("Invalid SMAP archive keys")
    expected = {
        "schema_version": "fixture-1",
        "provider": "smap",
        "farm_id": FARM_ID,
        "location": LOCATION,
        "product": "SPL3SMP_E",
        "version": "6",
    }
    if any(archive[key] != value for key, value in expected.items()):
        raise ValueError("SMAP identity/product/version mismatch")
    if type(archive["grid_posting_km"]) is not int or archive["grid_posting_km"] != 9:
        raise ValueError("Expected 9 km grid posting")
    _utc(archive["retrieved_at"])
    if type(archive["available"]) is not bool:
        raise ValueError("available must be boolean")
    for key in ("rows", "reference_rows", "granule_ids"):
        if not isinstance(archive[key], list):
            raise ValueError(f"{key} must be an array")
    if not archive["available"]:
        if (
            not isinstance(archive["unavailable_reason"], str)
            or not archive["unavailable_reason"].strip()
        ):
            raise ValueError("Unavailable SMAP requires a reason")
        if archive["cell_id"] is not None or any(
            archive[key] for key in ("rows", "reference_rows", "granule_ids")
        ):
            raise ValueError("Unavailable SMAP requires null cell and empty arrays")
        return
    row_index, col_index = resolve_cell(
        **{"target_lat": LOCATION["latitude"], "target_lon": LOCATION["longitude"]}
    )
    if (
        archive["cell_id"] != f"ease2_m09_{row_index}_{col_index}"
        or archive["unavailable_reason"] is not None
    ):
        raise ValueError("Invalid cell/reason for available SMAP")
    ids = archive["granule_ids"]
    if not ids or any(not isinstance(name, str) for name in ids) or len(set(ids)) != len(ids):
        raise ValueError("Available SMAP requires unique granule IDs")
    days = [_granule_day(name) for name in ids]
    if days != sorted(days) or len(set(days)) != len(days):
        raise ValueError("Duplicate/unsorted granule days")
    seen = []
    for key in ("rows", "reference_rows"):
        previous = None
        for row in archive[key]:
            if not isinstance(row, dict) or set(row) != {
                "day",
                "surface_m3_m3",
                "retrieval_quality_flag",
                "pass_id",
            }:
                raise ValueError("Invalid SMAP row keys")
            if not isinstance(row["day"], str):
                raise ValueError("Expected ISO day")
            day = date.fromisoformat(row["day"])
            if row["day"] != day.isoformat() or (previous is not None and day <= previous):
                raise ValueError("Days must be ISO, sorted and unique")
            previous = day
            if key == "rows" and not date(2025, 10, 2) <= day <= date(2025, 10, 15):
                raise ValueError("Current row outside the pinned 14 days")
            if key == "reference_rows" and not date(2015, 3, 31) <= day < date(2025, 1, 1):
                raise ValueError("Reference must precede assessment year and follow mission start")
            flag, moisture = row["retrieval_quality_flag"], row["surface_m3_m3"]
            if row["pass_id"] != "AM" or type(flag) is not int or not 0 <= flag <= 65535:
                raise ValueError("Invalid pass/quality flag")
            if moisture is not None and (
                flag not in (0, 8) or not _number(moisture) or not 0 <= moisture <= 1
            ):
                raise ValueError("Moisture must be finite m³/m³ in [0,1] with recommended quality")
            seen.append(day)
    if not archive["rows"] or not any(row["surface_m3_m3"] is not None for row in archive["rows"]):
        raise ValueError("No usable current SMAP observation")
    if set(seen) != set(days) or len(seen) != len(days):
        raise ValueError("Every row must have exactly one retained source granule")


def _atomic_write(output: Path, archive: SmapArchive) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=output.parent, delete=False
        ) as handle:
            temporary = Path(handle.name)
            json.dump(archive, handle, indent=2, allow_nan=False)
            handle.write("\n")
        temporary.replace(output)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def _text(value: object) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8").rstrip("\x00")
    if isinstance(value, str):
        return value.rstrip("\x00")
    if getattr(value, "size", None) == 1 and getattr(
        getattr(value, "dtype", None), "kind", None
    ) in ("S", "U"):
        return _text(value.item())
    raise ValueError("Expected scalar text metadata")


def _extract_granule(path: Path, cell: tuple[int, int]) -> dict[str, JsonValue]:
    import h5py

    day = _granule_day(path.name)
    with h5py.File(path, "r") as handle:
        for group in ("DatasetIdentification", "SeriesIdentification"):
            attrs = handle[f"Metadata/{group}"].attrs
            if _text(attrs["shortName"]) != "SPL3SMP_E" or _text(attrs["ECSVersionID"]) not in (
                "6",
                "006",
            ):
                raise ValueError("Wrong SMAP product/collection version")
        attrs = handle["Metadata/DatasetIdentification"].attrs
        if (
            _text(attrs["fileName"]) != path.name
            or _text(attrs["CompositeReleaseID"]) != GRANULE_RE.fullmatch(path.name)[2]
        ):
            raise ValueError("Granule name/revision disagrees with metadata")
        group = handle["Soil_Moisture_Retrieval_Data_AM"]
        names = (
            "latitude",
            "longitude",
            "EASE_row_index",
            "EASE_col_index",
            "soil_moisture",
            "retrieval_quality_flag",
            "tb_time_utc",
        )
        if any(group[name].shape != SHAPE for name in names):
            raise ValueError("Expected full native global EASE2 M09 grid")
        if any(group[name].dtype.kind not in "iu" for name in ("EASE_row_index", "EASE_col_index")):
            raise ValueError("Native cell indices must be integers")
        if (int(group["EASE_row_index"][cell]), int(group["EASE_col_index"][cell])) != cell:
            raise ValueError("Cell indices disagree with geolocation")
        x, y = _project(float(group["latitude"][cell]), float(group["longitude"][cell]))
        if (
            abs(x - (LEFT_CENTRE_M + cell[1] * PIXEL_M)) > 100
            or abs(y - (TOP_CENTRE_M - cell[0] * PIXEL_M)) > 100
        ):
            raise ValueError("Cell centre disagrees with projected native grid")
        observation_time = _utc(_text(group["tb_time_utc"][cell]))
        if observation_time.date() != day:
            raise ValueError("Observation time disagrees with granule day")
        dataset = group["soil_moisture"]
        if _text(dataset.attrs["units"]) not in ("m3/m3", "cm3/cm3", "cm**3/cm**3"):
            raise ValueError("Unknown soil moisture units")
        raw = float(dataset[cell])
        fill = float(dataset.attrs["_FillValue"])
        scale = float(dataset.attrs.get("scale_factor", 1.0))
        offset = float(dataset.attrs.get("add_offset", 0.0))
        if not _number(fill) or not _number(scale) or scale <= 0 or not _number(offset):
            raise ValueError("Invalid scale/fill metadata")
        flag_value = group["retrieval_quality_flag"][cell]
        if getattr(flag_value, "dtype", None).kind not in "iu":
            raise ValueError("Quality flag must be integer")
        flag = int(flag_value)
        if not 0 <= flag <= 65535:
            raise ValueError("Quality flag out of range")
        moisture = (
            None
            if raw == fill or not math.isfinite(raw) or flag not in (0, 8)
            else raw * scale + offset
        )
        if moisture is not None and (not math.isfinite(moisture) or not 0 <= moisture <= 1):
            raise ValueError("Invalid scaled soil moisture")
        return {
            "day": day.isoformat(),
            "surface_m3_m3": moisture,
            "retrieval_quality_flag": flag,
            "pass_id": "AM",
        }


def capture_smap_archive(*, farm_id: str, granules: Sequence[Path], output: Path) -> SmapArchive:
    if farm_id != FARM_ID:
        raise ValueError("Unknown farm; use the pinned Faisalabad ID")
    archive: SmapArchive = {
        "schema_version": "fixture-1",
        "provider": "smap",
        "farm_id": FARM_ID,
        "location": dict(LOCATION),
        "product": "SPL3SMP_E",
        "version": "6",
        "cell_id": None,
        "grid_posting_km": 9,
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "granule_ids": [],
        "available": False,
        "unavailable_reason": "No authorized SPL3SMP_E Version 6 granules supplied; previous observations lacked verifiable provenance.",
        "rows": [],
        "reference_rows": [],
    }
    cell = resolve_cell(LOCATION["latitude"], LOCATION["longitude"])
    retained, rejected = {}, []
    for path in granules:
        try:
            row = _extract_granule(path, cell)
            day = date.fromisoformat(row["day"])
            if not (
                date(2015, 3, 31) <= day < date(2025, 1, 1)
                or date(2025, 10, 2) <= day <= date(2025, 10, 15)
            ):
                raise ValueError("Outside pinned current/reference periods")
        except (OSError, KeyError, ValueError, ImportError, UnicodeError) as error:
            rejected.append(f"{path.name}: {type(error).__name__}: {error}")
            continue
        # Duplicate dates are a capture error, not a silently discarded input.
        if row["day"] in retained:
            raise ValueError(f"Duplicate SMAP day: {row['day']}")
        retained[row["day"]] = (path.name, row)
    current = [row for _, row in retained.values() if row["day"] >= "2025-01-01"]
    if any(row["surface_m3_m3"] is not None for row in current):
        archive.update(
            available=True, unavailable_reason=None, cell_id=f"ease2_m09_{cell[0]}_{cell[1]}"
        )
        for day in sorted(retained):
            name, row = retained[day]
            archive["granule_ids"].append(name)
            archive["rows" if day >= "2025-01-01" else "reference_rows"].append(row)
    elif granules:
        archive["unavailable_reason"] = (
            "No verified, usable AM observations in the assessment window. " + "; ".join(rejected)
        )
    verify_smap_archive(archive)
    _atomic_write(output, archive)
    return archive


def _sample_available() -> SmapArchive:
    """Explicit unit-test sample; never used as a committed provider observation."""
    cell = resolve_cell(LOCATION["latitude"], LOCATION["longitude"])
    return {
        "schema_version": "fixture-1",
        "provider": "smap",
        "farm_id": FARM_ID,
        "location": dict(LOCATION),
        "product": "SPL3SMP_E",
        "version": "6",
        "cell_id": f"ease2_m09_{cell[0]}_{cell[1]}",
        "grid_posting_km": 9,
        "retrieved_at": "2026-09-26T00:00:00Z",
        "available": True,
        "unavailable_reason": None,
        "granule_ids": [
            "SMAP_L3_SM_P_E_20241003_R19240_001.h5",
            "SMAP_L3_SM_P_E_20251003_R19240_001.h5",
        ],
        "rows": [
            {
                "day": "2025-10-03",
                "surface_m3_m3": 0.25,
                "retrieval_quality_flag": 0,
                "pass_id": "AM",
            }
        ],
        "reference_rows": [
            {
                "day": "2024-10-03",
                "surface_m3_m3": None,
                "retrieval_quality_flag": 1,
                "pass_id": "AM",
            }
        ],
    }


def test_committed_archive() -> None:
    verify_smap_archive(json.loads(ARCHIVE_PATH.read_text()))


def test_available_sample() -> None:
    verify_smap_archive(_sample_available())


@pytest.mark.parametrize(
    "field,value",
    [
        ("version", "5"),
        ("product", "SPL3SMP"),
        ("grid_posting_km", 36),
        ("cell_id", "ease2_m09_0_0"),
        ("available", 1),
        ("retrieved_at", "2025-10-15T00:00:00"),
        ("unavailable_reason", "unexpected"),
        ("location", {"latitude": 31.418, "longitude": 73.079}),
    ],
)
def test_reject_bad_metadata(field: str, value: JsonValue) -> None:
    archive = _sample_available()
    archive[field] = value
    with pytest.raises(ValueError):
        verify_smap_archive(archive)


@pytest.mark.parametrize(
    "field,value",
    [
        ("surface_m3_m3", float("nan")),
        ("surface_m3_m3", float("inf")),
        ("surface_m3_m3", 2.0),
        ("surface_m3_m3", -0.1),
        ("surface_m3_m3", True),
        ("surface_m3_m3", "0.25"),
        ("retrieval_quality_flag", True),
        ("retrieval_quality_flag", 1),
        ("retrieval_quality_flag", 65536),
        ("pass_id", "PM"),
        ("day", "2025-10-16"),
    ],
)
def test_reject_bad_row(field: str, value: JsonValue) -> None:
    archive = _sample_available()
    archive["rows"][0][field] = value
    with pytest.raises(ValueError):
        verify_smap_archive(archive)


def test_no_granules_is_honest(tmp_path: Path) -> None:
    archive = capture_smap_archive(farm_id=FARM_ID, granules=[], output=tmp_path / "smap.json")
    assert archive["available"] is False and archive["rows"] == []
    verify_smap_archive(archive)


def test_all_inputs_rejected(tmp_path: Path) -> None:
    path = tmp_path / "wrong.h5"
    path.write_bytes(b"invalid HDF5")
    archive = capture_smap_archive(farm_id=FARM_ID, granules=[path], output=tmp_path / "out.json")
    assert not archive["available"] and archive["cell_id"] is None
    assert "No verified" in archive["unavailable_reason"]


def test_duplicate_days_fail_without_overwriting(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    row = _sample_available()["rows"][0]
    monkeypatch.setattr(
        __import__(__name__, fromlist=["_extract_granule"]),
        "_extract_granule",
        lambda *_: copy.deepcopy(row),
    )
    output = tmp_path / "out.json"
    output.write_text("old verified bytes")
    with pytest.raises(ValueError, match="Duplicate"):
        capture_smap_archive(farm_id=FARM_ID, granules=[Path("one"), Path("two")], output=output)
    assert output.read_text() == "old verified bytes"


def test_provenance_required() -> None:
    archive = _sample_available()
    archive["granule_ids"].pop(0)
    with pytest.raises(ValueError, match="source granule"):
        verify_smap_archive(archive)


def test_advisory_rejected() -> None:
    with pytest.raises(ValueError, match="advisory"):
        _granule_day("SMAP_L3_SM_P_E_20260601_R19240_001.h5")


def _hdf_sample(tmp_path: Path, *, raw: float = 0.25, flag: int = 0, scale: float = 1.0) -> Path:
    """Sparse, synthetic HDF5 test input on the real native-grid shape."""
    import h5py

    path = tmp_path / "SMAP_L3_SM_P_E_20251003_R19240_001.h5"
    cell = (387, 2706)
    # Arrays store the native cell centre, not the farm coordinates.
    # Invert ellipsoidal CEA for the exact published cell-centre northing.
    low, high = -85.0, 85.0
    expected_y = TOP_CENTRE_M - cell[0] * PIXEL_M
    for _ in range(60):
        middle = (low + high) / 2
        if _project(middle, 0)[1] < expected_y:
            low = middle
        else:
            high = middle
    centre_lat = (low + high) / 2
    centre_lon = (LEFT_CENTRE_M + cell[1] * PIXEL_M) / _project(0, 1)[0]
    with h5py.File(path, "w") as handle:
        for name in ("DatasetIdentification", "SeriesIdentification"):
            group = handle.create_group(f"Metadata/{name}")
            group.attrs["shortName"] = "SPL3SMP_E"
            group.attrs["ECSVersionID"] = "006"
        metadata = handle["Metadata/DatasetIdentification"].attrs
        metadata["fileName"], metadata["CompositeReleaseID"] = path.name, "R19240"
        group = handle.create_group("Soil_Moisture_Retrieval_Data_AM")
        values = {
            "latitude": centre_lat,
            "longitude": centre_lon,
            "EASE_row_index": cell[0],
            "EASE_col_index": cell[1],
            "soil_moisture": raw,
            "retrieval_quality_flag": flag,
            "tb_time_utc": b"2025-10-03T06:00:00Z",
        }
        for name, value in values.items():
            dtype = (
                "S24"
                if name == "tb_time_utc"
                else "u2"
                if name in ("EASE_row_index", "EASE_col_index", "retrieval_quality_flag")
                else "f8"
            )
            dataset = group.create_dataset(name, SHAPE, dtype=dtype, chunks=(1, 1))
            dataset[cell] = value
        dataset = group["soil_moisture"]
        dataset.attrs["units"], dataset.attrs["_FillValue"] = "cm**3/cm**3", -9999.0
        dataset.attrs["scale_factor"] = scale
    return path


@pytest.mark.parametrize(
    "raw,flag,scale,expected",
    [
        (0.25, 0, 1, 0.25),
        (25.0, 8, 0.01, 0.25),
        (-9999, 0, 1, None),
        (0.3, 1, 1, None),
        (float("nan"), 0, 1, None),
    ],
)
def test_hdf_extraction_scaling_and_quality(
    tmp_path: Path, raw: float, flag: int, scale: float, expected: float | None
) -> None:
    path = _hdf_sample(tmp_path, raw=raw, flag=flag, scale=scale)
    row = _extract_granule(path, (387, 2706))
    assert row["surface_m3_m3"] == expected
    assert row["retrieval_quality_flag"] == flag
    archive = capture_smap_archive(farm_id=FARM_ID, granules=[path], output=tmp_path / "out.json")
    assert archive["available"] is (expected is not None)
    if expected is not None:
        assert archive["granule_ids"] == [path.name]


@pytest.mark.parametrize(
    "kind", ["product", "version", "PM", "cell", "time", "scale", "range", "revision"]
)
def test_hdf_rejects_bad_provenance(tmp_path: Path, kind: str) -> None:
    import h5py

    path = _hdf_sample(tmp_path)
    with h5py.File(path, "r+") as handle:
        attrs = handle["Metadata/DatasetIdentification"].attrs
        group = handle["Soil_Moisture_Retrieval_Data_AM"]
        if kind == "product":
            attrs["shortName"] = "SPL3SMP"
        elif kind == "version":
            attrs["ECSVersionID"] = "005"
        elif kind == "revision":
            attrs["CompositeReleaseID"] = "R99999"
        elif kind == "PM":
            handle.move("Soil_Moisture_Retrieval_Data_AM", "Soil_Moisture_Retrieval_Data_PM")
        elif kind == "cell":
            group["latitude"][387, 2706] = 40.0
        elif kind == "time":
            group["tb_time_utc"][387, 2706] = b"2025-10-04T06:00:00Z"
        elif kind == "scale":
            group["soil_moisture"].attrs["scale_factor"] = -1
        else:
            group["soil_moisture"][387, 2706] = 2.0
    archive = capture_smap_archive(farm_id=FARM_ID, granules=[path], output=tmp_path / "out.json")
    assert archive["available"] is False and archive["rows"] == []


def test_containing_cell_and_bounds() -> None:
    assert resolve_cell(31.4504, 73.1350) == (387, 2706)
    with pytest.raises(ValueError, match="outside"):
        resolve_cell(90, 73)


def test_hdf_singleton_metadata_attributes(tmp_path: Path) -> None:
    import h5py
    import numpy as np

    path = _hdf_sample(tmp_path)
    with h5py.File(path, "r+") as handle:
        handle["Metadata/DatasetIdentification"].attrs["shortName"] = np.array([b"SPL3SMP_E"])
        handle["Metadata/SeriesIdentification"].attrs["ECSVersionID"] = np.array([b"006"])
    assert _extract_granule(path, (387, 2706))["surface_m3_m3"] == 0.25


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--capture", action="store_true", required=True)
    parser.add_argument("--granules", nargs="*", type=Path, default=[])
    parser.add_argument("--output", type=Path, default=ARCHIVE_PATH)
    args = parser.parse_args()
    capture_smap_archive(farm_id=FARM_ID, granules=args.granules, output=args.output)
