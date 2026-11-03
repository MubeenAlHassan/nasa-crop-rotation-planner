import asyncio

import app.api.v1.recommendations as routes
import httpx
from app.mock_server import _synthetic_response
from app.schemas.domain import FixtureMismatch, ProviderBundle, RequiredDataUnavailable
from fastapi import FastAPI, HTTPException
from test_recommendation_service import Power, Smap, Soil
from test_recommendation_service import request as service_request

REQUEST = {
    "location": {"latitude": 31.4504, "longitude": 73.135}, "region_id": "punjab_pk_demo_v1",
    "assessment_end": "2025-10-15", "slots": [{"slot_id": "rabi", "start_date": "2025-10-25", "end_date": "2026-03-31"}],
    "crop_history": [], "irrigation": "rainfed",
}


def app():
    api = FastAPI()
    api.include_router(routes.router)
    api.dependency_overrides[routes.get_provider_bundle] = lambda: ProviderBundle(power=object(), soil=object(), smap=object())
    return api


def call(api, method, path, **kwargs):
    async def request():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=api), base_url="http://test") as client:
            return await client.request(method, path, **kwargs)
    return asyncio.run(request())


def test_catalog_openapi_and_validation_envelopes():
    api = app()
    result = call(api, "GET", "/api/v1/crops?region_id=punjab_pk_demo_v1")
    assert result.status_code == 200 and result.json()["catalog_version"] == "1.0.1"
    assert result.headers["x-request-id"]
    assert call(api, "GET", "/api/v1/crops?region_id=wrong").json()["error"]["code"] == "VALIDATION_ERROR"
    schema = call(api, "GET", "/openapi.json").json()
    assert "/api/v1/crops" in schema["paths"] and "/api/v1/recommend-rotation" in schema["paths"]
    bad = call(api, "POST", "/api/v1/recommend-rotation", json={**REQUEST, "unexpected": 1})
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "VALIDATION_ERROR"
    assert bad.headers["x-request-id"] == bad.json()["request_id"]
    assert call(api, "POST", "/api/v1/recommend-rotation", content="{}", headers={"Content-Type": "text/plain"}).status_code == 415
    assert call(api, "POST", "/api/v1/recommend-rotation", content=b"x" * 65537, headers={"Content-Type": "application/json"}).status_code == 413


def test_nullable_success_and_service_error_mappings(monkeypatch):
    api = app()

    async def success(payload, providers, *, request_id, generated_at):
        return _synthetic_response(payload, request_id, generated_at)

    monkeypatch.setattr(routes, "build_recommendation_response", success)
    response = call(api, "POST", "/api/v1/recommend-rotation", json=REQUEST)
    assert response.status_code == 200
    assert response.headers["x-request-id"] == response.json()["request_id"]
    assert response.json()["features"]["moisture"]["surface_m3_m3"] is None

    async def unavailable(*args, **kwargs):
        raise RequiredDataUnavailable("Missing POWER", True)

    monkeypatch.setattr(routes, "build_recommendation_response", unavailable)
    response = call(api, "POST", "/api/v1/recommend-rotation", json=REQUEST)
    assert response.status_code == 503 and response.json()["error"]["retryable"] is True

    async def mismatch(*args, **kwargs):
        raise FixtureMismatch("Wrong fixture")

    monkeypatch.setattr(routes, "build_recommendation_response", mismatch)
    assert call(api, "POST", "/api/v1/recommend-rotation", json=REQUEST).status_code == 422

    async def limited(*args, **kwargs):
        raise HTTPException(status_code=429, headers={"Retry-After": "5"})

    monkeypatch.setattr(routes, "build_recommendation_response", limited)
    limited_response = call(api, "POST", "/api/v1/recommend-rotation", json=REQUEST)
    assert limited_response.status_code == 429
    assert limited_response.headers["retry-after"] == "5"

    async def unexpected(*args, **kwargs):
        raise RuntimeError("secret")

    monkeypatch.setattr(routes, "build_recommendation_response", unexpected)
    response = call(api, "POST", "/api/v1/recommend-rotation", json=REQUEST)
    assert response.status_code == 500 and "secret" not in response.text


def test_route_to_real_service_with_injected_offline_providers():
    api = FastAPI()
    api.include_router(routes.router)
    power = Power()
    api.dependency_overrides[routes.get_provider_bundle] = lambda: ProviderBundle(power=power, soil=Soil(), smap=Smap())
    body = service_request().model_dump(mode="json")
    response = call(api, "POST", "/api/v1/recommend-rotation", json=body)
    assert response.status_code == 200
    assert response.json()["status"] == "degraded"
    assert response.json()["recommendations"][0]["slots"][0]["crop_id"] == "chickpea"
    assert response.headers["x-request-id"] == response.json()["request_id"]
    assert len(power.calls) == 2
