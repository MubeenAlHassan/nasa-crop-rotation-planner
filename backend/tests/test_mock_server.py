"""The mock serves valid synthetic envelopes entirely through ASGI transport."""

import asyncio
import json
import re
import socket
import sys
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

import httpx
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.mock_server import app  # noqa: E402
from app.schemas.contracts import (  # noqa: E402
    CropCatalogResponse, ErrorEnvelope, RecommendationRequest, RecommendationResponse,
    contract_json_schema,
)

ROOT = Path(__file__).resolve().parents[2]
FIXED_TIME = datetime(2026, 9, 26, 9, 0, tzinfo=UTC)
FIXED_ID = UUID("258c4465-0862-49b7-bc73-a3d08eacda09")


def sample_request():
    blocks = re.findall(r"```json\n(.*?)\n```", (ROOT / "agent_docs/DATA_SCHEMA.md").read_text(), re.S)
    return json.loads(blocks[0])


async def invoke(method, path, **kwargs):
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://mock.test"
    ) as client:
        return await client.request(method, path, **kwargs)


@pytest.fixture(autouse=True)
def fixed_clock_and_no_network(monkeypatch):
    monkeypatch.setattr(app.state, "clock", lambda: FIXED_TIME)
    monkeypatch.setattr(app.state, "request_id_factory", lambda: FIXED_ID)

    def blocked(*args, **kwargs):
        raise AssertionError("Mock API attempted to open an external socket")

    monkeypatch.setattr(socket.socket, "connect", blocked)
    monkeypatch.setattr(socket, "create_connection", blocked)


def test_catalog_route_and_openapi_contract():
    response = asyncio.run(invoke("GET", "/api/v1/crops?region_id=punjab_pk_demo_v1"))
    assert response.status_code == 200
    catalog = CropCatalogResponse.model_validate(response.json())
    assert catalog.catalog_version == "1.0.1"
    assert {crop.crop_id for crop in catalog.crops} == {"wheat", "chickpea", "maize"}
    assert response.headers["X-Request-ID"] == str(FIXED_ID)
    openapi = app.openapi()
    assert "RecommendationRequest" in openapi["components"]["schemas"]
    assert "RecommendationResponse" in openapi["components"]["schemas"]
    assert "CropCatalogResponse" in contract_json_schema()["$defs"]


@pytest.mark.parametrize("path", [
    "/api/v1/crops", "/api/v1/crops?region_id=unknown",
])
def test_unknown_or_missing_region_is_strict_422(path):
    response = asyncio.run(invoke("GET", path))
    assert response.status_code == 422
    envelope = ErrorEnvelope.model_validate(response.json())
    assert envelope.error.code == "VALIDATION_ERROR"
    assert envelope.error.retryable is False
    assert response.headers["X-Request-ID"] == str(envelope.request_id)
    assert "detail" not in response.json()


def test_post_contract_is_stable_and_synthetic():
    request = sample_request()
    assert RecommendationRequest.model_validate(request)
    first = asyncio.run(invoke("POST", "/api/v1/recommend-rotation", json=request))
    second = asyncio.run(invoke("POST", "/api/v1/recommend-rotation", json=request))
    assert first.status_code == 200
    assert first.content == second.content
    result = RecommendationResponse.model_validate(first.json(),
                                                   context={"request": RecommendationRequest.model_validate(request)})
    assert result.status == "degraded"
    assert result.generated_at == FIXED_TIME
    assert {source.provider for source in result.sources} == {
        "power", "soilgrids", "smap", "farmer_input"
    }
    assert result.sources[0].fixture_id == "synthetic-contract-example"
    assert all(source.mode == "unavailable" for source in result.sources[1:])
    assert result.features.soil.ph is None
    assert result.features.moisture.surface_m3_m3 is None
    assert result.recommendations[0].slots[0].start_date == date_from("2025-11-01")
    assert any(warning.code == "DEMO_FIXTURE" for warning in result.warnings)


def date_from(value):
    from datetime import date
    return date.fromisoformat(value)


@pytest.mark.parametrize("mutate", [
    lambda x: x["location"].update(latitude=95),
    lambda x: x.update(extra=1),
    lambda x: x.update(region_id="unknown"),
    lambda x: x.update(top_k="3"),
])
def test_bad_post_returns_error_envelope(mutate):
    request = sample_request()
    mutate(request)
    response = asyncio.run(invoke("POST", "/api/v1/recommend-rotation", json=request))
    assert response.status_code == 422
    error = ErrorEnvelope.model_validate(response.json())
    assert error.error.code == "VALIDATION_ERROR"
    assert "detail" not in response.json()


def test_body_limit_content_type_and_malformed_json():
    bad_media = asyncio.run(invoke("POST", "/api/v1/recommend-rotation",
                                   content=b"{}", headers={"Content-Type": "text/plain"}))
    assert bad_media.status_code == 415
    assert ErrorEnvelope.model_validate(bad_media.json()).error.code == "UNSUPPORTED_MEDIA_TYPE"
    too_large = asyncio.run(invoke("POST", "/api/v1/recommend-rotation",
                                   content=b" " * (64 * 1024 + 1),
                                   headers={"Content-Type": "application/json"}))
    assert too_large.status_code == 413
    assert ErrorEnvelope.model_validate(too_large.json()).error.code == "PAYLOAD_TOO_LARGE"
    malformed = asyncio.run(invoke("POST", "/api/v1/recommend-rotation",
                                   content=b"{", headers={"Content-Type": "application/json"}))
    assert malformed.status_code == 422
    assert ErrorEnvelope.model_validate(malformed.json()).error.code == "VALIDATION_ERROR"


def test_override_provenance_and_empty_candidate_set():
    request = sample_request()
    request["soil_override"] = {
        "sampled_on": "2025-10-01", "depth_top_cm": 0, "depth_bottom_cm": 30,
        "ph": 0,
    }
    response = asyncio.run(invoke("POST", "/api/v1/recommend-rotation", json=request))
    result = RecommendationResponse.model_validate(response.json())
    assert result.features.soil.ph == 0
    assert result.features.soil.field_sources.ph == "farmer_input"
    assert result.sources[3].mode == "farmer_input"
    assert "/features/soil/ph" in result.sources[3].used_for
    request["soil_override"] = None
    request["allowed_crop_ids"] = ["chickpea"]
    request["excluded_crop_ids"] = ["chickpea"]
    invalid = asyncio.run(invoke("POST", "/api/v1/recommend-rotation", json=request))
    assert invalid.status_code == 422
    request["allowed_crop_ids"] = []
    request["excluded_crop_ids"] = ["wheat", "chickpea", "maize"]
    empty = asyncio.run(invoke("POST", "/api/v1/recommend-rotation", json=request))
    result = RecommendationResponse.model_validate(empty.json())
    assert result.status == "no_feasible_rotation"
    assert result.recommendations == ()
    assert {(entry.crop_id, entry.code) for entry in result.exclusions} == {
        (crop_id, "CROP_EXCLUDED") for crop_id in ("wheat", "chickpea", "maize")
    }
    assert any(warning.code == "NO_FEASIBLE_ROTATION" for warning in result.warnings)
