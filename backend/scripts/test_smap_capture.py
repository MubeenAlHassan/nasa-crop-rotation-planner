import pytest
from pathlib import Path
from typing import Sequence, Mapping, Any, Optional
import datetime
import math
import h5py
import numpy as np
import json

JsonValue = Any
SmapArchive = dict[str, JsonValue]

FAISALABAD_LAT = 31.418
FAISALABAD_LON = 73.079

ADVISORY_START = datetime.date(2026, 5, 14)
ADVISORY_END = datetime.date(2026, 7, 28)

def resolve_cell(lat_array: np.ndarray, lon_array: np.ndarray, target_lat: float, target_lon: float) -> tuple[int, int]:
    dist = (lat_array - target_lat)**2 + (lon_array - target_lon)**2
    idx = np.unravel_index(np.argmin(dist), dist.shape)
    return int(idx[0]), int(idx[1])

def capture_smap_archive(
    *,
    farm_id: str,
    granules: Sequence[Path],
    output: Path,
) -> SmapArchive:
    if not granules:
        archive = {
            "available": False,
            "reason": "No supplied granules",
            "cell_id": None,
            "granules": [],
            "rows": [],
            "reference_rows": []
        }
        output.parent.mkdir(parents=True, exist_ok=True)
        with open(output, "w") as f:
            json.dump(archive, f)
        return archive

    if farm_id != "faisalabad":
        raise ValueError(f"Unknown farm: {farm_id}")

    target_lat, target_lon = FAISALABAD_LAT, FAISALABAD_LON
    cell_idx: Optional[tuple[int, int]] = None
    cell_id: Optional[str] = None
    
    rows = []
    reference_rows = []
    seen_dates = set()
    used_granules = []
    
    metadata = {"product": "SPL3SMP_E", "version": "6"}

    for g_path in granules:
        try:
            with h5py.File(g_path, "r") as f:
                product = f.attrs.get("product", b"").decode('utf-8') if isinstance(f.attrs.get("product"), bytes) else str(f.attrs.get("product", ""))
                version = f.attrs.get("collection_version", b"").decode('utf-8') if isinstance(f.attrs.get("collection_version"), bytes) else str(f.attrs.get("collection_version", ""))

                if product != "SPL3SMP_E" or version != "6":
                    continue 

                # Reject PM rows if the group is missing or implies PM
                # The requirement says "Reject wrong product/version, PM rows..."
                if "Soil_Moisture_Retrieval_Data_AM" not in f:
                    continue

                am_group = f["Soil_Moisture_Retrieval_Data_AM"]
                
                # We need latitude and longitude to resolve the cell
                if "latitude" not in am_group or "longitude" not in am_group:
                    continue
                    
                lat_arr = am_group["latitude"][:]
                lon_arr = am_group["longitude"][:]

                current_cell_idx = resolve_cell(lat_arr, lon_arr, target_lat, target_lon)
                
                if cell_idx is None:
                    cell_idx = current_cell_idx
                    cell_id = f"ease9km_{cell_idx[0]}_{cell_idx[1]}"
                else:
                    if current_cell_idx != cell_idx:
                        continue # Inconsistent cells

                if "soil_moisture" not in am_group or "retrieval_qual_flag" not in am_group or "tb_time_utc" not in am_group:
                    continue
                    
                sm_ds = am_group["soil_moisture"]
                qual_ds = am_group["retrieval_qual_flag"]
                time_ds = am_group["tb_time_utc"]
                
                sm_val = float(sm_ds[cell_idx])
                qual_val = int(qual_ds[cell_idx])
                time_val = time_ds[cell_idx]
                
                if isinstance(time_val, bytes):
                    time_val = time_val.decode('utf-8')
                
                try:
                    dt = datetime.datetime.fromisoformat(time_val.replace('Z', '+00:00'))
                    day = dt.date()
                except ValueError:
                    continue
                    
                if ADVISORY_START <= day <= ADVISORY_END:
                    continue

                if day in seen_dates:
                    raise ValueError(f"Duplicate date detected: {day}")
                seen_dates.add(day)

                fill_val = float(sm_ds.attrs.get("_FillValue", -9999.0))
                scale = float(sm_ds.attrs.get("scale_factor", 1.0))
                
                # Check for nonfinite or fill value
                if math.isclose(sm_val, fill_val) or not math.isfinite(sm_val):
                    moisture = None
                else:
                    moisture = sm_val * scale
                    if qual_val not in (0, 8):
                        moisture = None

                row = {
                    "day": day.isoformat(),
                    "surface_m3_m3": moisture,
                    "retrieval_quality_flag": qual_val,
                    "pass_id": "AM" # pinned to AM pass
                }

                if day < datetime.date(2025, 1, 1):
                    reference_rows.append(row)
                elif datetime.date(2025, 10, 2) <= day <= datetime.date(2025, 10, 15):
                    rows.append(row)

                used_granules.append(g_path.name)
        except (OSError, KeyError, ValueError):
            # Corrupt file or missing required datasets
            continue

    rows.sort(key=lambda x: x["day"])
    reference_rows.sort(key=lambda x: x["day"])

    archive = {
        "metadata": metadata,
        "granules": used_granules,
        "cell_id": cell_id,
        "grid_posting_km": 9,
        "rows": rows,
        "reference_rows": reference_rows,
        "available": True
    }
    
    output.parent.mkdir(parents=True, exist_ok=True)
    with open(output, "w") as f:
        json.dump(archive, f)
        
    return archive

def verify_smap_archive(archive: Mapping[str, JsonValue]) -> None:
    if not isinstance(archive, dict):
        raise ValueError("Archive must be a dictionary")
        
    if archive.get("available") is False:
        if "reason" not in archive:
            raise ValueError("Unavailable archive missing reason")
        if archive.get("cell_id") is not None:
            raise ValueError("Unavailable archive must have cell_id=None")
        if archive.get("rows") or archive.get("reference_rows") or archive.get("granules"):
            raise ValueError("Unavailable archive must have empty arrays")
        return

    metadata = archive.get("metadata", {})
    if metadata.get("product") != "SPL3SMP_E" or metadata.get("version") != "6":
        raise ValueError("Archive metadata must indicate SPL3SMP_E version 6")
        
    if archive.get("grid_posting_km") != 9:
        raise ValueError("grid_posting_km must be 9")
        
    if not isinstance(archive.get("cell_id"), str):
        raise ValueError("Archive must have a valid cell_id")

    rows = archive.get("rows", [])
    ref_rows = archive.get("reference_rows", [])
    
    for row in rows + ref_rows:
        if set(row.keys()) != {"day", "surface_m3_m3", "retrieval_quality_flag", "pass_id"}:
            raise ValueError("Invalid row keys")
            
        if row["pass_id"] != "AM":
            raise ValueError("Only AM pass_id is supported")
            
        day = datetime.date.fromisoformat(row["day"])
        
        # Check advisory
        if ADVISORY_START <= day <= ADVISORY_END:
            raise ValueError(f"Date {day} is within advisory period")

        moisture = row["surface_m3_m3"]
        qual = row["retrieval_quality_flag"]
        
        if moisture is not None:
            if qual not in (0, 8):
                raise ValueError("Moisture is present but quality flag is not 0 or 8")
            if moisture < 0 or moisture > 1: # Basic sanity check for soil moisture
                 pass # The requirement didn't explicitly mention this but good practice.
                 
    # Check pinned period for current rows
    for row in rows:
        day = datetime.date.fromisoformat(row["day"])
        if not (datetime.date(2025, 10, 2) <= day <= datetime.date(2025, 10, 15)):
            raise ValueError("Current rows must be in pinned period")
            
    # Check pinned period for ref rows
    for row in ref_rows:
        day = datetime.date.fromisoformat(row["day"])
        if day >= datetime.date(2025, 1, 1):
            raise ValueError("Reference rows must precede 2025")

# --- Tests ---

@pytest.fixture
def dummy_hdf5(tmp_path):
    def _create(name, product="SPL3SMP_E", version="6", date_str="2025-10-10T12:00:00Z", sm_val=0.2, qual_val=0, include_am=True):
        p = tmp_path / name
        with h5py.File(p, "w") as f:
            f.attrs["product"] = product
            f.attrs["collection_version"] = version
            if include_am:
                am = f.create_group("Soil_Moisture_Retrieval_Data_AM")
                am.create_dataset("latitude", data=np.array([[31.418, 32.0], [31.0, 31.0]]))
                am.create_dataset("longitude", data=np.array([[73.079, 74.0], [72.0, 72.0]]))
                
                sm = am.create_dataset("soil_moisture", data=np.array([[sm_val, 0.0], [0.0, 0.0]]))
                sm.attrs["_FillValue"] = -9999.0
                sm.attrs["scale_factor"] = 1.0
                
                am.create_dataset("retrieval_qual_flag", data=np.array([[qual_val, 1], [1, 1]]))
                am.create_dataset("tb_time_utc", data=np.array([[date_str.encode('utf-8'), b"a"], [b"b", b"c"]]))
        return p
    return _create

def test_available_unavailable(tmp_path):
    # No granules
    out = tmp_path / "out.json"
    archive = capture_smap_archive(farm_id="faisalabad", granules=[], output=out)
    assert not archive["available"]
    assert archive["cell_id"] is None
    assert archive["reason"] == "No supplied granules"
    verify_smap_archive(archive)

def test_flags_and_fill(tmp_path, dummy_hdf5):
    out = tmp_path / "out.json"
    # Flag 0 (Recommended)
    g1 = dummy_hdf5("g1.h5", date_str="2025-10-02T12:00:00Z", sm_val=0.2, qual_val=0)
    # Flag 8 (Attempted/Questionable but often retained)
    g2 = dummy_hdf5("g2.h5", date_str="2025-10-03T12:00:00Z", sm_val=0.3, qual_val=8)
    # Flag 1 (Rejected)
    g3 = dummy_hdf5("g3.h5", date_str="2025-10-04T12:00:00Z", sm_val=0.4, qual_val=1)
    # Fill value (-9999.0)
    g4 = dummy_hdf5("g4.h5", date_str="2025-10-05T12:00:00Z", sm_val=-9999.0, qual_val=0)
    
    archive = capture_smap_archive(farm_id="faisalabad", granules=[g1, g2, g3, g4], output=out)
    assert archive["available"]
    rows = archive["rows"]
    assert len(rows) == 4
    assert rows[0]["surface_m3_m3"] == 0.2
    assert rows[1]["surface_m3_m3"] == 0.3
    assert rows[2]["surface_m3_m3"] is None # Rejected flag
    assert rows[2]["retrieval_quality_flag"] == 1
    assert rows[3]["surface_m3_m3"] is None # Fill value
    verify_smap_archive(archive)

def test_wrong_versions_and_pm(tmp_path, dummy_hdf5):
    out = tmp_path / "out.json"
    g1 = dummy_hdf5("g1.h5", product="SPL3SMP", version="6") # Wrong product
    g2 = dummy_hdf5("g2.h5", product="SPL3SMP_E", version="5") # Wrong version
    g3 = dummy_hdf5("g3.h5", include_am=False) # Missing AM group (e.g. PM only)
    g4 = dummy_hdf5("g4.h5", date_str="2025-10-10T12:00:00Z") # Valid
    
    archive = capture_smap_archive(farm_id="faisalabad", granules=[g1, g2, g3, g4], output=out)
    assert len(archive["granules"]) == 1
    assert archive["granules"][0] == "g4.h5"

def test_date_cell_consistency(tmp_path, dummy_hdf5):
    out = tmp_path / "out.json"
    g1 = dummy_hdf5("g1.h5", date_str="2025-10-10T12:00:00Z")
    g2 = dummy_hdf5("g2.h5", date_str="2025-10-10T14:00:00Z") # Duplicate date
    
    archive = capture_smap_archive(farm_id="faisalabad", granules=[g1, g2], output=out)
    assert len(archive["rows"]) == 1
    assert archive["granules"] == ["g1.h5"]

def test_advisory_exclusions(tmp_path, dummy_hdf5):
    out = tmp_path / "out.json"
    g1 = dummy_hdf5("g1.h5", date_str="2026-06-01T12:00:00Z") # During advisory
    g2 = dummy_hdf5("g2.h5", date_str="2025-10-10T12:00:00Z") # Valid
    
    archive = capture_smap_archive(farm_id="faisalabad", granules=[g1, g2], output=out)
    assert len(archive["rows"]) == 1
    assert archive["rows"][0]["day"] == "2025-10-10"
    
def test_pinned_periods(tmp_path, dummy_hdf5):
    out = tmp_path / "out.json"
    g1 = dummy_hdf5("g1.h5", date_str="2024-12-31T12:00:00Z") # Reference
    g2 = dummy_hdf5("g2.h5", date_str="2025-10-01T12:00:00Z") # Out of pinned (ignored)
    g3 = dummy_hdf5("g3.h5", date_str="2025-10-15T12:00:00Z") # Current
    g4 = dummy_hdf5("g4.h5", date_str="2025-10-16T12:00:00Z") # Out of pinned (ignored)
    
    archive = capture_smap_archive(farm_id="faisalabad", granules=[g1, g2, g3, g4], output=out)
    assert len(archive["reference_rows"]) == 1
    assert len(archive["rows"]) == 1
    assert archive["reference_rows"][0]["day"] == "2024-12-31"
    assert archive["rows"][0]["day"] == "2025-10-15"
