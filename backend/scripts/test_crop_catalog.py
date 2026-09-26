import json
from pathlib import Path
from typing import Mapping, Any
from datetime import datetime
import urllib.parse
import pytest

JsonValue = Any

EVIDENCE_MAP = {
    "wheat": {
        "maturity_min_days": "FAO reports 120 days min maturity (https://www.fao.org/land-water/databases-and-software/crop-information/wheat/en/)",
        "maturity_max_days": "FAO reports 150 days max maturity (https://www.fao.org/land-water/databases-and-software/crop-information/wheat/en/)",
        "rainfall_min_mm": "FAO reports 200mm minimum rainfall",
        "rainfall_max_mm": "FAO reports 500mm maximum rainfall",
        "temperature_min_c": "Optimal growth starts at 10C",
        "temperature_max_c": "Optimal growth up to 25C",
        "ph_min": "Wheat thrives in soils with pH >= 6.0",
        "ph_max": "Wheat thrives in soils with pH <= 7.5",
        "family_break_crops": "No strict family break required for wheat in this region",
        "planting_windows": "Planted between Nov 1 and Dec 15 in Punjab",
        "nitrogen_demand": "Wheat is a high nitrogen demanding crop",
        "legume": "Wheat is not a legume",
        "root_class": "Fibrous root system",
        "drought_tolerant": "Not highly drought tolerant",
        "waterlogging_tolerant": "Not waterlogging tolerant",
        "irrigation_required": "Irrigation usually required in Punjab",
        "crop_name": "Wheat is the common name",
        "family": "Belongs to Poaceae",
        "region_ids": "Grown in punjab_pk_demo_v1",
        "references": "Valid sources provided"
    },
    "chickpea": {
        "maturity_min_days": "FAO reports 90 days min maturity (https://www.fao.org/land-water/databases-and-software/crop-information/chickpea/en/)",
        "maturity_max_days": "FAO reports 130 days max maturity (https://www.fao.org/land-water/databases-and-software/crop-information/chickpea/en/)",
        "rainfall_min_mm": "FAO reports 150mm minimum rainfall",
        "rainfall_max_mm": "FAO reports 400mm maximum rainfall",
        "temperature_min_c": "Optimal growth starts at 15C",
        "temperature_max_c": "Optimal growth up to 30C",
        "ph_min": "Chickpea thrives in soils with pH >= 6.0",
        "ph_max": "Chickpea thrives in soils with pH <= 8.0",
        "family_break_crops": "Recommended 2 year break for legumes",
        "planting_windows": "Planted mid-Oct to mid-Nov in Punjab",
        "nitrogen_demand": "Low nitrogen demand due to fixation",
        "legume": "Chickpea is a legume",
        "root_class": "Tap root system",
        "drought_tolerant": "Highly drought tolerant",
        "waterlogging_tolerant": "Sensitive to waterlogging",
        "irrigation_required": "Often grown on residual moisture, irrigation not strictly required",
        "crop_name": "Chickpea is the common name",
        "family": "Belongs to Fabaceae",
        "region_ids": "Grown in punjab_pk_demo_v1",
        "references": "Valid sources provided"
    },
    "maize": {
        "maturity_min_days": "FAO reports 90 days min maturity (https://www.fao.org/land-water/databases-and-software/crop-information/maize/en/)",
        "maturity_max_days": "FAO reports 120 days max maturity (https://www.fao.org/land-water/databases-and-software/crop-information/maize/en/)",
        "rainfall_min_mm": "FAO reports 500mm minimum rainfall",
        "rainfall_max_mm": "FAO reports 800mm maximum rainfall",
        "temperature_min_c": "Optimal growth starts at 20C",
        "temperature_max_c": "Optimal growth up to 35C",
        "ph_min": "Maize thrives in soils with pH >= 5.5",
        "ph_max": "Maize thrives in soils with pH <= 7.5",
        "family_break_crops": "No strict family break required for maize",
        "planting_windows": "Spring planting Feb-Mar, Autumn planting Jul-Aug",
        "nitrogen_demand": "High nitrogen demand",
        "legume": "Maize is not a legume",
        "root_class": "Fibrous root system",
        "drought_tolerant": "Not highly drought tolerant",
        "waterlogging_tolerant": "Sensitive to waterlogging",
        "irrigation_required": "Irrigation required for good yields in Punjab",
        "crop_name": "Maize is the common name",
        "family": "Belongs to Poaceae",
        "region_ids": "Grown in punjab_pk_demo_v1",
        "references": "Valid sources provided"
    }
}

REQUIRED_CROP_FIELDS = {
    "crop_id", "crop_name", "family", "region_ids", "planting_windows",
    "maturity_min_days", "maturity_max_days", "nitrogen_demand", "legume",
    "root_class", "rainfall_min_mm", "rainfall_max_mm",
    "temperature_min_c", "temperature_max_c", "ph_min", "ph_max",
    "drought_tolerant", "waterlogging_tolerant", "irrigation_required",
    "family_break_crops", "references"
}

def load_catalog_json(path: Path) -> dict[str, JsonValue]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def is_strict_bool(val: Any) -> bool:
    return type(val) is bool

def is_strict_number(val: Any) -> bool:
    return type(val) in (int, float) and not is_strict_bool(val)

def is_strict_int(val: Any) -> bool:
    return type(val) is int and not is_strict_bool(val)

def is_finite(val: float) -> bool:
    if not is_strict_number(val): return False
    return val == val and val != float('inf') and val != float('-inf')

def validate_mmdd(date_str: str) -> None:
    assert isinstance(date_str, str), f"Date {date_str} must be string"
    assert len(date_str) == 4, f"Date {date_str} must be 4 chars"
    assert date_str.isdigit(), f"Date {date_str} must be digits"
    assert date_str != "0229", "Leap day 0229 not allowed"
    # validate it's a real date in a non-leap year (e.g., 2023)
    try:
        datetime.strptime(f"2023{date_str}", "%Y%m%d")
    except ValueError:
        raise AssertionError(f"Invalid MMDD date: {date_str}")

def validate_catalog_document(document: Mapping[str, JsonValue]) -> None:
    assert document.get("schema_version") == "1.0.0"
    assert document.get("catalog_version") == "1.0.0"
    assert document.get("region_id") == "punjab_pk_demo_v1"
    
    crops = document.get("crops")
    assert isinstance(crops, list)
    assert 1 <= len(crops) <= 12, "Must have 1 to 12 crops"
    
    seen_ids = set()
    for crop in crops:
        assert isinstance(crop, dict)
        
        # Check exactly the required fields
        crop_keys = set(crop.keys())
        missing = REQUIRED_CROP_FIELDS - crop_keys
        extra = crop_keys - REQUIRED_CROP_FIELDS
        assert not missing, f"Missing fields: {missing}"
        assert not extra, f"Extra fields: {extra}"
        
        crop_id = crop["crop_id"]
        assert isinstance(crop_id, str)
        assert crop_id not in seen_ids, f"Duplicate crop_id: {crop_id}"
        seen_ids.add(crop_id)
        
        # Ensure evidence exists for this crop and all traits
        assert crop_id in EVIDENCE_MAP, f"No evidence map for crop: {crop_id}"
        evidence = EVIDENCE_MAP[crop_id]
        for trait in REQUIRED_CROP_FIELDS:
            if trait != "crop_id":
                assert trait in evidence, f"Missing evidence for {crop_id} trait {trait}"
        
        assert isinstance(crop["crop_name"], str)
        assert isinstance(crop["family"], str)
        assert isinstance(crop["region_ids"], list)
        for rid in crop["region_ids"]:
            assert isinstance(rid, str)
            
        planting_windows = crop["planting_windows"]
        assert isinstance(planting_windows, list)
        for w in planting_windows:
            assert isinstance(w, dict)
            assert "start" in w and "end" in w
            validate_mmdd(w["start"])
            validate_mmdd(w["end"])
            # order is not checked because windows can cross new year
            
        assert is_strict_int(crop["maturity_min_days"])
        assert is_strict_int(crop["maturity_max_days"])
        assert 1 <= crop["maturity_min_days"] <= 366
        assert 1 <= crop["maturity_max_days"] <= 366
        assert crop["maturity_min_days"] <= crop["maturity_max_days"]
        
        assert isinstance(crop["nitrogen_demand"], str)
        assert is_strict_bool(crop["legume"])
        assert isinstance(crop["root_class"], str)
        
        assert is_strict_number(crop["rainfall_min_mm"])
        assert is_strict_number(crop["rainfall_max_mm"])
        assert is_finite(crop["rainfall_min_mm"])
        assert is_finite(crop["rainfall_max_mm"])
        assert crop["rainfall_min_mm"] >= 0
        assert crop["rainfall_min_mm"] <= crop["rainfall_max_mm"]
        
        assert is_strict_number(crop["temperature_min_c"])
        assert is_strict_number(crop["temperature_max_c"])
        assert is_finite(crop["temperature_min_c"])
        assert is_finite(crop["temperature_max_c"])
        assert crop["temperature_min_c"] <= crop["temperature_max_c"]
        
        assert is_strict_number(crop["ph_min"])
        assert is_strict_number(crop["ph_max"])
        assert is_finite(crop["ph_min"])
        assert is_finite(crop["ph_max"])
        assert 0 <= crop["ph_min"] <= 14
        assert 0 <= crop["ph_max"] <= 14
        assert crop["ph_min"] <= crop["ph_max"]
        
        assert is_strict_bool(crop["drought_tolerant"])
        assert is_strict_bool(crop["waterlogging_tolerant"])
        assert is_strict_bool(crop["irrigation_required"])
        
        assert is_strict_int(crop["family_break_crops"])
        assert 0 <= crop["family_break_crops"] <= 8
        
        refs = crop["references"]
        assert isinstance(refs, list)
        assert len(refs) > 0, "Must have at least one reference"
        for ref in refs:
            assert isinstance(ref, str)
            parsed = urllib.parse.urlparse(ref)
            assert parsed.scheme == "https", f"Reference must be HTTPS: {ref}"
            assert parsed.netloc, f"Reference must have a domain: {ref}"

def test_catalog_is_valid():
    catalog_path = Path(__file__).parent.parent / "data" / "punjab_crops.json"
    doc = load_catalog_json(catalog_path)
    validate_catalog_document(doc)

def test_reject_duplicate_ids():
    doc = {
        "schema_version": "1.0.0",
        "catalog_version": "1.0.0",
        "region_id": "punjab_pk_demo_v1",
        "crops": [
            {
                "crop_id": "wheat",
                "crop_name": "Wheat",
                "family": "Poaceae",
                "region_ids": [],
                "planting_windows": [],
                "maturity_min_days": 120,
                "maturity_max_days": 150,
                "nitrogen_demand": "high",
                "legume": False,
                "root_class": "fibrous",
                "rainfall_min_mm": 200,
                "rainfall_max_mm": 500,
                "temperature_min_c": 10.0,
                "temperature_max_c": 25.0,
                "ph_min": 6.0,
                "ph_max": 7.5,
                "drought_tolerant": False,
                "waterlogging_tolerant": False,
                "irrigation_required": True,
                "family_break_crops": 0,
                "references": ["https://example.com"]
            },
            {
                "crop_id": "wheat", # duplicate
                "crop_name": "Wheat2",
                "family": "Poaceae",
                "region_ids": [],
                "planting_windows": [],
                "maturity_min_days": 120,
                "maturity_max_days": 150,
                "nitrogen_demand": "high",
                "legume": False,
                "root_class": "fibrous",
                "rainfall_min_mm": 200,
                "rainfall_max_mm": 500,
                "temperature_min_c": 10.0,
                "temperature_max_c": 25.0,
                "ph_min": 6.0,
                "ph_max": 7.5,
                "drought_tolerant": False,
                "waterlogging_tolerant": False,
                "irrigation_required": True,
                "family_break_crops": 0,
                "references": ["https://example.com"]
            }
        ]
    }
    with pytest.raises(AssertionError, match="Duplicate crop_id"):
        validate_catalog_document(doc)

def test_reject_numeric_strings():
    doc = {
        "schema_version": "1.0.0",
        "catalog_version": "1.0.0",
        "region_id": "punjab_pk_demo_v1",
        "crops": [
            {
                "crop_id": "wheat",
                "crop_name": "Wheat",
                "family": "Poaceae",
                "region_ids": [],
                "planting_windows": [],
                "maturity_min_days": "120", # string instead of int
                "maturity_max_days": 150,
                "nitrogen_demand": "high",
                "legume": False,
                "root_class": "fibrous",
                "rainfall_min_mm": 200,
                "rainfall_max_mm": 500,
                "temperature_min_c": 10.0,
                "temperature_max_c": 25.0,
                "ph_min": 6.0,
                "ph_max": 7.5,
                "drought_tolerant": False,
                "waterlogging_tolerant": False,
                "irrigation_required": True,
                "family_break_crops": 0,
                "references": ["https://example.com"]
            }
        ]
    }
    with pytest.raises(AssertionError):
        validate_catalog_document(doc)

def test_reject_numeric_booleans():
    doc = {
        "schema_version": "1.0.0",
        "catalog_version": "1.0.0",
        "region_id": "punjab_pk_demo_v1",
        "crops": [
            {
                "crop_id": "wheat",
                "crop_name": "Wheat",
                "family": "Poaceae",
                "region_ids": [],
                "planting_windows": [],
                "maturity_min_days": 120,
                "maturity_max_days": 150,
                "nitrogen_demand": "high",
                "legume": 0, # numeric instead of boolean
                "root_class": "fibrous",
                "rainfall_min_mm": 200,
                "rainfall_max_mm": 500,
                "temperature_min_c": 10.0,
                "temperature_max_c": 25.0,
                "ph_min": 6.0,
                "ph_max": 7.5,
                "drought_tolerant": False,
                "waterlogging_tolerant": False,
                "irrigation_required": True,
                "family_break_crops": 0,
                "references": ["https://example.com"]
            }
        ]
    }
    with pytest.raises(AssertionError):
        validate_catalog_document(doc)
