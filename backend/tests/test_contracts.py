"""Executable checks for the public 1.0.0 wire contract."""

import json
import re
import sys
from copy import deepcopy
from datetime import date
from pathlib import Path

import pytest
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.schemas.contracts import (  # noqa: E402
    ContractDocument,
    CropCatalogResponse,
    ErrorEnvelope,
    PlantingWindow,
    RecommendationRequest,
    RecommendationResponse,
    SoilOverride,
    contract_json_schema,
)

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture(scope="module")
def examples():
    text = (ROOT / "agent_docs/DATA_SCHEMA.md").read_text()
    blocks = re.findall(r"```json\n(.*?)\n```", text, flags=re.S)
    assert len(blocks) == 3
    return tuple(json.loads(block) for block in blocks)


@pytest.fixture
def sample_request(examples):
    return deepcopy(examples[0])


def parse_sample_request(payload):
    return RecommendationRequest.model_validate_json(
        json.dumps(payload), context={"today_utc": date(2026, 9, 26)}
    )


def test_documented_samples_and_real_catalog(examples):
    sample_request = parse_sample_request(examples[0])
    success = RecommendationResponse.model_validate_json(
        json.dumps(examples[1]), context={"request": sample_request}
    )
    error = ErrorEnvelope.model_validate_json(json.dumps(examples[2]))
    catalog = CropCatalogResponse.model_validate_json(
        (ROOT / "backend/data/punjab_crops.json").read_text()
    )
    assert success.status == "degraded"
    assert error.error.code == "VALIDATION_ERROR"
    assert catalog.catalog_version == "1.0.1"
    assert {crop.crop_id for crop in catalog.crops} == {"wheat", "chickpea", "maize"}


def test_schema_id_and_definitions():
    schema = contract_json_schema()
    assert schema["$id"] == "https://field-shift.local/contracts/1.0.0.json"
    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert set(schema["properties"]) == {
        "recommendation_request", "recommendation_response", "error_response", "crop_catalog_response"
    }
    assert set(schema["required"]) == set(schema["properties"])
    assert schema["additionalProperties"] is False
    assert {
        "Location", "SoilOverride", "RecommendationRequest", "RecommendationResponse",
        "ErrorEnvelope", "Crop", "CropCatalogResponse", "Source", "Features",
    } <= set(schema["$defs"])
    assert ContractDocument.model_json_schema()["$defs"].keys() == schema["$defs"].keys()
    assert schema["$defs"]["Message"]["title"] == "Message"
    assert "title" not in schema["$defs"]["Message"]["properties"]["message"]
    assert schema["$defs"]["Climate"]["properties"]["rainfall_observed_mm"]["anyOf"][0]["minimum"] == 0
    assert schema["$defs"]["Components"]["properties"]["nitrogen"]["anyOf"][0]["maximum"] == 100
    assert not any(f'"{keyword}"' in json.dumps(schema)
                   for keyword in ("ge", "le", "gt", "lt"))


@pytest.mark.parametrize("field,value", [
    ("latitude", 90.001), ("latitude", -90.001), ("longitude", 180.001),
    ("longitude", -180.001), ("latitude", "31.4504"), ("latitude", True),
    ("longitude", float("nan")), ("longitude", float("inf")),
])
def test_location_rejects_invalid_values(sample_request, field, value):
    sample_request["location"][field] = value
    with pytest.raises(ValidationError):
        parse_sample_request(sample_request)


@pytest.mark.parametrize("value", [
    "2025-02-29", "2025-1-01", "2025-10-15T00:00:00Z", 20251015, None,
])
def test_iso_date_rejects_invalid_wire_values(sample_request, value):
    sample_request["assessment_end"] = value
    with pytest.raises(ValidationError):
        parse_sample_request(sample_request)


def test_iso_leap_date_is_accepted(sample_request):
    sample_request["assessment_end"] = "2024-02-29"
    sample_request["slots"][0].update(start_date="2024-03-01", end_date="2024-04-15")
    sample_request["crop_history"] = []
    assert parse_sample_request(sample_request).assessment_end == date(2024, 2, 29)


@pytest.mark.parametrize("mutate", [
    lambda x: x.update(top_k=1.0),
    lambda x: x.update(top_k=True),
    lambda x: x.update(top_k="3"),
    lambda x: x.update(top_k=4),
    lambda x: x.update(extra_field=42),
    lambda x: x["location"].update(altitude=182),
    lambda x: x.update(region_id="unknown"),
    lambda x: x.update(allowed_crop_ids=["unknown"]),
    lambda x: x.update(allowed_crop_ids=["chickpea", "chickpea"]),
    lambda x: x.update(excluded_crop_ids=["chickpea"]),
    lambda x: x.update(slots=[]),
    lambda x: x.update(slots=x["slots"] * 5),
    lambda x: x["slots"][0].update(end_date="2025-11-15"),
    lambda x: x["slots"][0].update(start_date="2025-10-15"),
    lambda x: x["slots"][0].update(end_date="2028-01-01"),
    lambda x: x["crop_history"][0].update(crop_id="unknown"),
    lambda x: x["crop_history"][0].update(end_date="2025-11-01"),
])
def test_sample_request_boundaries(sample_request, mutate):
    mutate(sample_request)
    with pytest.raises(ValidationError):
        parse_sample_request(sample_request)


def test_ordered_nonoverlapping_slots_and_history(sample_request):
    sample_request["slots"].append({
        "slot_id": "rabi_2025", "start_date": "2026-04-01", "end_date": "2026-05-15"
    })
    with pytest.raises(ValidationError):
        parse_sample_request(sample_request)
    sample_request["slots"][1]["slot_id"] = "second"
    assert len(parse_sample_request(sample_request).slots) == 2
    sample_request["slots"][1]["start_date"] = "2026-03-31"
    with pytest.raises(ValidationError):
        parse_sample_request(sample_request)


def test_soil_override_zero_and_texture_rules(sample_request):
    sample_request["soil_override"] = {
        "sampled_on": "2025-10-01", "depth_top_cm": 0, "depth_bottom_cm": 30,
        "ph": 0, "sand_pct": 40, "silt_pct": 35, "clay_pct": 25,
    }
    assert parse_sample_request(sample_request).soil_override.ph == 0
    sample_request["soil_override"]["sand_pct"] = 45
    with pytest.raises(ValidationError):
        parse_sample_request(sample_request)
    sample_request["soil_override"]["sand_pct"] = None
    with pytest.raises(ValidationError):
        parse_sample_request(sample_request)
    sample_request["soil_override"] = {
        "sampled_on": "2025-10-01", "depth_top_cm": 0, "depth_bottom_cm": 30
    }
    with pytest.raises(ValidationError):
        parse_sample_request(sample_request)
    with pytest.raises(ValidationError):
        SoilOverride.model_validate({**sample_request["soil_override"], "ph": "7"})


def test_response_required_nulls_and_source_cardinality(examples):
    response = deepcopy(examples[1])
    response["features"]["soil"].update({
        name: None for name in ("ph", "soc_g_kg", "total_n_g_kg", "sand_pct", "silt_pct", "clay_pct")
    })
    response["features"]["soil"]["field_sources"] = {
        name: "unavailable" for name in response["features"]["soil"]["field_sources"]
    }
    parsed = RecommendationResponse.model_validate(response)
    encoded = json.loads(parsed.model_dump_json())
    assert all(name in encoded["features"]["soil"] and encoded["features"]["soil"][name] is None
               for name in response["features"]["soil"]["field_sources"])
    del response["features"]["soil"]["ph"]
    with pytest.raises(ValidationError):
        RecommendationResponse.model_validate(response)
    response = deepcopy(examples[1])
    response["sources"][1]["provider"] = "power"
    with pytest.raises(ValidationError):
        RecommendationResponse.model_validate(response)


@pytest.mark.parametrize("mutate", [
    lambda x: x["sources"][2].update(product="SPL3SMP_E"),
    lambda x: x["sources"][0].update(fixture_id=None),
    lambda x: x["features"]["climate"].update(rainfall_coverage=1.1),
    lambda x: x["features"]["moisture"].update(surface_m3_m3="0.2"),
    lambda x: x["recommendations"][0]["effective_weights"].update(water=0.5),
    lambda x: x["recommendations"][0].update(rank=2),
    lambda x: x.update(generated_at="2026-09-26T14:00:00+05:00"),
    lambda x: x["warnings"][0].update(code="MADE_UP"),
    lambda x: x["warnings"][0].update(code="ROOT_DEPTH_ALTERNATION"),
    lambda x: x["recommendations"][0]["reasons"][0].update(code="SOURCE_STALE"),
    lambda x: x["features"]["slot_scenarios"][0].update(smap_adjustment_applied="false"),
])
def test_response_invariants(examples, mutate):
    response = deepcopy(examples[1])
    mutate(response)
    with pytest.raises(ValidationError):
        RecommendationResponse.model_validate(response)


def test_empty_result_is_success_shape(examples):
    response = deepcopy(examples[1])
    response.update(status="no_feasible_rotation", recommendations=[], feasible_rotation_count=0)
    response["warnings"].append({"code": "NO_FEASIBLE_ROTATION", "message": "No feasible crop."})
    assert RecommendationResponse.model_validate(response).recommendations == ()


def test_catalog_intervals_urls_and_planting_windows():
    assert PlantingWindow(start_mmdd="1101", end_mmdd="0228").start_mmdd == "1101"
    with pytest.raises(ValidationError):
        PlantingWindow(start_mmdd="0229", end_mmdd="0301")
    catalog = json.loads((ROOT / "backend/data/punjab_crops.json").read_text())
    catalog["crops"][0]["rainfall_max_mm"] = -1
    with pytest.raises(ValidationError):
        CropCatalogResponse.model_validate(catalog)
