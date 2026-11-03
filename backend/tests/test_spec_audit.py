"""Independent Phase 0 audit. Run from the repository root; no network calls."""

import ast
import copy
import hashlib
import importlib.util
import json
import sys
import tomllib
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "backend/tests/fixtures"
PIN_LOCATION = {"latitude": 31.4504, "longitude": 73.1350}
PIN_FARM = "faisalabad_2025"
ARCHIVE_KEYS = {
    "power": {"schema_version", "provider", "farm_id", "location", "requests"},
    "soilgrids": {
        "schema_version",
        "provider",
        "farm_id",
        "location",
        "acquisition",
        "retrieved_at",
        "product",
        "source_urls",
        "available",
        "unavailable_reason",
        "layers",
    },
    "smap": {
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
    },
}
MANIFEST_KEYS = {
    "schema_version",
    "fixture_id",
    "farm_id",
    "location",
    "assessment_end",
    "slots",
    "catalog_version",
    "transform_version",
    "synthetic",
    "files",
}


def read(provider):
    return json.loads((FIXTURES / f"{provider}_archive.json").read_text())


def load_script(name):
    key = f"phase0_independent_{name}"
    spec = importlib.util.spec_from_file_location(key, ROOT / f"backend/scripts/test_{name}.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[key] = module
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize("provider", ["power", "soilgrids", "smap"])
def test_exact_archive_envelopes(provider):
    doc = read(provider)
    assert set(doc) == ARCHIVE_KEYS[provider], (
        f"{provider}: missing={ARCHIVE_KEYS[provider] - set(doc)}, extra={set(doc) - ARCHIVE_KEYS[provider]}"
    )
    assert doc["schema_version"] == "fixture-1"
    assert doc["provider"] == provider
    assert doc["farm_id"] == PIN_FARM
    assert doc["location"] == PIN_LOCATION


def test_power_pinned_point_and_periods():
    doc = read("power")
    assert doc["location"] == PIN_LOCATION, f"Captured point is {doc['location']}"
    expected = {("2025-07-18", "2025-10-15")} | {
        (f"{year}-01-01", f"{year}-12-31") for year in range(1991, 2021)
    }
    actual = {(row["start_date"], row["end_date"]) for row in doc["requests"]}
    assert len(doc["requests"]) == 31 and actual == expected


def test_power_pinned_periods_independently():
    doc = read("power")
    expected = {("2025-07-18", "2025-10-15")} | {
        (f"{year}-01-01", f"{year}-12-31") for year in range(1991, 2021)
    }
    actual = {(row["start_date"], row["end_date"]) for row in doc["requests"]}
    assert actual == expected, (
        f"missing={sorted(expected - actual)}, unexpected={sorted(actual - expected)}"
    )


def test_manifest_frozen_envelope():
    doc = json.loads((FIXTURES / "manifest.json").read_text())
    assert set(doc) == MANIFEST_KEYS, (
        f"missing={MANIFEST_KEYS - set(doc)}, extra={set(doc) - MANIFEST_KEYS}"
    )
    assert doc["farm_id"] == PIN_FARM and doc["location"] == PIN_LOCATION
    assert doc["assessment_end"] == "2025-10-15"
    assert doc["slots"] == [
        {"slot_id": "rabi_2025", "start_date": "2025-11-01", "end_date": "2026-03-31"}
    ]


def test_hashes_match_committed_bytes():
    doc = json.loads((FIXTURES / "manifest.json").read_text())
    for row in doc["files"]:
        assert hashlib.sha256((ROOT / row["path"]).read_bytes()).hexdigest() == row["sha256"]


def test_optional_soil_has_no_invented_layers():
    doc = read("soilgrids")
    assert doc.get("available") is False or doc.get("availability") == "unavailable"
    assert doc["layers"] == []
    assert doc.get("unavailable_reason") or doc.get("reason")


def test_scripts_do_not_import_phase1_models():
    for path in (ROOT / "backend/scripts").glob("test_*.py"):
        for node in ast.walk(ast.parse(path.read_text())):
            if isinstance(node, ast.Import):
                names = [item.name for item in node.names]
            elif isinstance(node, ast.ImportFrom):
                names = [node.module or ""]
            else:
                continue
            assert not any(
                name == "schemas" or name.startswith(("app", "backend.app", "backend.schemas"))
                for name in names
            ), (path, names)


def test_catalog_uses_frozen_window_keys_and_root_enum():
    doc = json.loads((ROOT / "backend/data/punjab_crops.json").read_text())
    for crop in doc["crops"]:
        assert crop["root_class"] in {"shallow", "medium", "deep"}, (
            crop["crop_id"],
            crop["root_class"],
        )
        for window in crop["planting_windows"]:
            assert set(window) == {"start_mmdd", "end_mmdd"}


def test_power_verifier_rejects_empty_archive():
    doc = copy.deepcopy(read("power"))
    doc["requests"] = []
    with pytest.raises((ValueError, AssertionError)):
        load_script("power_capture").verify_power_archive(doc)


@pytest.mark.parametrize("bad_moisture", [float("nan"), 2.0])
def test_smap_verifier_rejects_invalid_moisture(bad_moisture):
    # Explicit synthetic validator input, separate from the honest unavailable cache.
    doc = copy.deepcopy(read("smap"))
    doc.update(
        available=True,
        unavailable_reason=None,
        cell_id="ease2_m09_387_2706",
        granule_ids=["SMAP_L3_SM_P_E_20251003_R19240_001.h5"],
        rows=[
            {
                "day": "2025-10-03",
                "surface_m3_m3": bad_moisture,
                "retrieval_quality_flag": 0,
                "pass_id": "AM",
            }
        ],
    )
    valid = copy.deepcopy(doc)
    valid["rows"][0]["surface_m3_m3"] = 0.25
    load_script("smap_capture").verify_smap_archive(valid)
    with pytest.raises((ValueError, AssertionError)):
        load_script("smap_capture").verify_smap_archive(doc)


def test_catalog_verifier_rejects_unknown_root_enum():
    doc = json.loads((ROOT / "backend/data/punjab_crops.json").read_text())
    doc["crops"][0]["root_class"] = "arbitrary-invalid-root-class"
    with pytest.raises((ValueError, AssertionError)):
        load_script("crop_catalog").validate_catalog_document(doc)


def test_smap_all_rejected_inputs_are_not_available(tmp_path):
    import h5py

    path = tmp_path / "wrong-product.h5"
    with h5py.File(path, "w") as handle:
        handle.attrs["product"] = "WRONG"
        handle.attrs["collection_version"] = "6"
    doc = load_script("smap_capture").capture_smap_archive(
        farm_id=PIN_FARM, granules=[path], output=tmp_path / "out.json"
    )
    assert doc["available"] is False, doc


def test_manifest_rejects_cross_farm_archive_even_with_matching_hash(tmp_path):
    dest = tmp_path / "backend/tests/fixtures"
    dest.mkdir(parents=True)
    for name in [
        "manifest.json",
        "power_archive.json",
        "soilgrids_archive.json",
        "smap_archive.json",
    ]:
        (dest / name).write_bytes((FIXTURES / name).read_bytes())
    catalog_dest = tmp_path / "backend/data/punjab_crops.json"
    catalog_dest.parent.mkdir(parents=True)
    catalog_dest.write_bytes((ROOT / "backend/data/punjab_crops.json").read_bytes())
    load_script("fixture_manifest").validate_fixture_manifest(tmp_path)
    power = json.loads((dest / "power_archive.json").read_text())
    power["farm_id"] = "unrelated-farm"
    (dest / "power_archive.json").write_text(json.dumps(power))
    manifest = json.loads((dest / "manifest.json").read_text())
    manifest["files"][0]["sha256"] = hashlib.sha256(
        (dest / "power_archive.json").read_bytes()
    ).hexdigest()
    (dest / "manifest.json").write_text(json.dumps(manifest))
    with pytest.raises((ValueError, AssertionError)):
        load_script("fixture_manifest").validate_fixture_manifest(tmp_path)


def test_python_tooling_and_compatibility_requirements_are_pinned():
    project = tomllib.loads((ROOT / "pyproject.toml").read_text())["project"]
    assert project["requires-python"] == ">=3.11,<3.12"
    assert (ROOT / ".python-version").read_text().strip() == "3.11.13"
    required = set(project["dependencies"]) | set(project["optional-dependencies"]["dev"])
    assert all("==" in dependency for dependency in required)
    compatibility = {
        line
        for line in (ROOT / "backend/requirements.txt").read_text().splitlines()
        if line and not line.startswith("#")
    }
    assert compatibility == required
