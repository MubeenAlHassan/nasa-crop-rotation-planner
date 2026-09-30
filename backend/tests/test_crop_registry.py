import json
from pathlib import Path

import pytest
from app.catalog.registry import load_crop_catalog
from app.schemas.contracts import CropCatalogResponse

CATALOG = Path(__file__).parents[1] / "data" / "punjab_crops.json"


def test_real_catalog_version_order_and_contract():
    result = load_crop_catalog(CATALOG, "punjab_pk_demo_v1")
    assert type(result) is CropCatalogResponse
    assert result.catalog_version == "1.0.1"
    assert [crop.crop_id for crop in result.crops] == ["wheat", "chickpea", "maize"]
    assert CropCatalogResponse.model_validate_json(result.model_dump_json()) == result


def test_rejects_region_duplicates_and_invalid_traits(tmp_path):
    with pytest.raises(ValueError, match="Unknown region"):
        load_crop_catalog(CATALOG, "elsewhere")
    data = json.loads(CATALOG.read_text())
    data["crops"].append(data["crops"][0].copy())
    path = tmp_path / "crops.json"
    path.write_text(json.dumps(data))
    with pytest.raises(ValueError, match="Invalid crop catalog"):
        load_crop_catalog(path, "punjab_pk_demo_v1")
    data["crops"].pop()
    data["crops"][0]["ph_min"] = 15
    path.write_text(json.dumps(data))
    with pytest.raises(ValueError):
        load_crop_catalog(path, "punjab_pk_demo_v1")
    data["crops"][0]["ph_min"] = 6
    data["crops"][0]["references"] = ["http://invalid.example"]
    path.write_text(json.dumps(data))
    with pytest.raises(ValueError):
        load_crop_catalog(path, "punjab_pk_demo_v1")
