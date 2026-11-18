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


@pytest.mark.parametrize(
    "irrigation,feasible_count,status",
    [("rainfed", 0, "no_feasible_rotation"), ("available", 1, "degraded")],
)
def test_fixture_mode_keeps_live_providers_and_returns_pinned_sources(
    monkeypatch: pytest.MonkeyPatch, irrigation: str, feasible_count: int, status: str,
) -> None:
    monkeypatch.setenv("ENABLE_DEMO_FIXTURES", "true")
    monkeypatch.setenv("BACKEND_DATA_DIR", str(ROOT))
    async def check() -> None:
        async with app.router.lifespan_context(app):
            assert isinstance(app.state.http_client, httpx.AsyncClient)
            assert isinstance(app.state.live_providers, ProviderBundle)
            live_calls = []

            async def unavailable(url, **kwargs):
                live_calls.append(url)
                raise httpx.ConnectError("Offline regression test")

            monkeypatch.setattr(app.state.http_client, "get", unavailable)
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),
                                         base_url="http://test") as client:
                body = {**REQUEST, "irrigation": irrigation}
                response = await client.post("/api/v1/recommend-rotation", json=body)
                assert response.status_code == 200, response.text
                payload = response.json()
                assert payload["location"] == REQUEST["location"]
                assert response.headers["x-request-id"] == payload["request_id"]
                assert payload["sources"][0]["mode"] == "fixture"
                assert live_calls == [], "Fixture requests must not fetch live observations"
                assert payload["schema_version"] == "1.0.0"
                assert payload["catalog_version"] == "1.0.1"
                assert payload["rules_version"] == "agronomy-v1"
                assert payload["status"] == status
                assert payload["feasible_rotation_count"] == feasible_count
                assert len(payload["recommendations"]) == feasible_count
                assert payload["sources"][0] == {
                    "provider": "power", "mode": "fixture", "product": "POWER daily AG UTC",
                    "observed_start": "1991-01-01", "observed_end": "2025-10-15",
                    "retrieved_at": "2026-09-26T15:09:58.389193Z",
                    "grid_resolution_km": None, "spatial_support": "NASA POWER native point sample",
                    "fixture_id": "faisalabad_2025",
                    "used_for": ["/features/climate", "/features/slot_scenarios"],
                }
                assert [source["provider"] for source in payload["sources"]] == [
                    "power", "soilgrids", "smap", "farmer_input",
                ]
                for source in payload["sources"][1:]:
                    assert source["mode"] == "unavailable"
                    assert source["used_for"] == []
                    assert all(value is None for key, value in source.items()
                               if key not in {"provider", "mode", "used_for"})
                assert {item["code"] for item in payload["warnings"]} >= {
                    "DEMO_FIXTURE", "SMAP_UNAVAILABLE", "SOILGRIDS_UNAVAILABLE",
                }
                if irrigation == "rainfed":
                    assert {item["code"] for item in payload["exclusions"]} == {
                        "CALENDAR_INCOMPATIBLE", "IRRIGATION_REQUIRED",
                    }
                    assert "NO_FEASIBLE_ROTATION" in {item["code"] for item in payload["warnings"]}
                else:
                    rotation = payload["recommendations"][0]
                    assert rotation["score"] == 43.5
                    assert rotation["rank"] == 1
                    assert rotation["rotation_id"] == (
                        "rot_1a2109813dec8cc4fe4c7af7588cc34d2041bfef3fbb39c7ace9519dc8541825"
                    )
                    assert rotation["slots"] == [{
                        **REQUEST["slots"][0], "crop_id": "wheat", "crop_name": "Wheat",
                    }]
                repeated = (await client.post("/api/v1/recommend-rotation", json=body)).json()
                assert {key: value for key, value in payload.items()
                        if key not in {"request_id", "generated_at"}} == {
                    key: value for key, value in repeated.items()
                    if key not in {"request_id", "generated_at"}
                }
                # Auto mode must attempt live inputs and fail honestly, even at the pinned point.
                auto = await client.post("/api/v1/recommend-rotation", json={**REQUEST, "data_mode": "auto"})
                assert auto.status_code == 503
                assert auto.json()["error"]["code"] == "REQUIRED_DATA_UNAVAILABLE"
                assert live_calls
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
