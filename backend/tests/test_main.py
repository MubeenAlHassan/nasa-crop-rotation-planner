"""Production composition, security boundaries, and ASGI lifecycle tests."""

import asyncio
from pathlib import Path

import httpx
import pytest
from app.main import app
from app.schemas.domain import ProviderBundle

ROOT = Path(__file__).parents[2]
REQUEST = {
    "location": {"latitude": 31.4504, "longitude": 73.135},
    "region_id": "punjab_pk_demo_v1",
    "assessment_end": "2025-10-15",
    "slots": [{"slot_id": "rabi_2025", "start_date": "2025-11-01", "end_date": "2026-03-31"}],
    "crop_history": [{"crop_id": "maize", "start_date": "2025-05-01", "end_date": "2025-09-30",
                      "residue_management": "retained"}],
    "irrigation": "rainfed", "data_mode": "fixture", "top_k": 3,
}


def run_requests(*requests: tuple[str, str, dict]) -> list[httpx.Response]:
    async def collect() -> list[httpx.Response]:
        async with app.router.lifespan_context(app):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),
                                         base_url="http://test") as client:
                return [await client.request(method, path, **kwargs) for method, path, kwargs in requests]

    return asyncio.run(collect())


def test_live_lifespan_mounts_routes_closes_client_and_disables_fixtures(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ENABLE_DEMO_FIXTURES", raising=False)
    async def check() -> None:
        async with app.router.lifespan_context(app):
            client = app.state.http_client
            assert isinstance(client, httpx.AsyncClient)
            assert isinstance(app.state.live_providers, ProviderBundle)
            assert app.state.fixture_enabled is False
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),
                                         base_url="http://test") as test_client:
                catalog = await test_client.get("/api/v1/crops?region_id=punjab_pk_demo_v1")
                assert catalog.status_code == 200
                assert catalog.headers["x-request-id"]
                assert (await test_client.get("/health/live")).json() == {"status": "ok"}
                assert (await test_client.get("/health/ready")).json() == {"status": "ready"}
                forbidden = await test_client.post("/api/v1/recommend-rotation", json=REQUEST)
                assert forbidden.status_code == 422
                assert forbidden.json()["error"]["code"] == "VALIDATION_ERROR"
        assert client.is_closed
        assert app.state.http_client is None

    asyncio.run(check())


def test_fixture_mode_keeps_live_providers_and_returns_pinned_sources(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENABLE_DEMO_FIXTURES", "true")
    monkeypatch.setenv("BACKEND_DATA_DIR", str(ROOT))
    async def check() -> None:
        async with app.router.lifespan_context(app):
            assert isinstance(app.state.http_client, httpx.AsyncClient)
            assert isinstance(app.state.live_providers, ProviderBundle)
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),
                                         base_url="http://test") as client:
                response = await client.post("/api/v1/recommend-rotation", json=REQUEST)
                assert response.status_code == 200, response.text
                payload = response.json()
                assert payload["location"] == REQUEST["location"]
                assert response.headers["x-request-id"] == payload["request_id"]
                assert payload["sources"][0]["mode"] == "fixture"
                # Auto mode uses live POWER (may be 503 offline without network / cold baseline).
                auto = await client.post("/api/v1/recommend-rotation", json={**REQUEST, "data_mode": "auto"})
                assert auto.status_code in (200, 503)
                nearby = await client.post("/api/v1/recommend-rotation", json={
                    **REQUEST, "location": {"latitude": 31.4505, "longitude": 73.135}})
                assert nearby.status_code == 422
    asyncio.run(check())


def test_body_limit_request_ids_and_cors(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ENABLE_DEMO_FIXTURES", raising=False)
    large, malformed, allowed, denied = run_requests(
        ("POST", "/api/v1/recommend-rotation", {"content": b"x" * 65537,
                                                  "headers": {"Content-Type": "application/json"}}),
        ("POST", "/api/v1/recommend-rotation", {"content": b"{}",
                                                  "headers": {"Content-Type": "application/json"}}),
        ("OPTIONS", "/api/v1/crops", {"headers": {"Origin": "http://localhost:3000",
                                                "Access-Control-Request-Method": "GET"}}),
        ("OPTIONS", "/api/v1/crops", {"headers": {"Origin": "https://untrusted.example",
                                                "Access-Control-Request-Method": "GET"}}),
    )
    assert large.status_code == 413
    assert large.headers["x-request-id"] == large.json()["request_id"]
    assert malformed.status_code == 422
    assert malformed.headers["x-request-id"] == malformed.json()["request_id"]
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert "access-control-allow-origin" not in denied.headers


def test_provider_failure_does_not_expose_secret(monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture) -> None:
    import app.api.v1.recommendations as routes

    monkeypatch.delenv("ENABLE_DEMO_FIXTURES", raising=False)
    async def broken(*_args, **_kwargs):
        raise RuntimeError("password=private-provider-token")
    monkeypatch.setattr(routes, "build_recommendation_response", broken)
    response = run_requests(("POST", "/api/v1/recommend-rotation",
                             {"json": {**REQUEST, "data_mode": "auto"}}))[0]
    assert response.status_code == 500
    assert "private-provider-token" not in response.text
    assert "private-provider-token" not in caplog.text
