"""Production ASGI composition root for live and explicitly selected demo inputs."""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from uuid import uuid4

import httpx
from app.api.v1.recommendations import get_provider_bundle, router
from app.providers.cache import DiskHttpCache
from app.providers.fixtures import create_fixture_provider_bundle, load_fixture_manifest
from app.providers.http import HttpxJsonFetcher
from app.providers.power import NasaPowerProvider
from app.providers.smap import SmapArchiveProvider
from app.providers.soilgrids import IsricSoilProvider
from app.schemas.contracts import Error, ErrorEnvelope, RecommendationRequest
from app.schemas.domain import FixtureMismatch, ProviderBundle, RequiredDataUnavailable
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

_LOG = logging.getLogger(__name__)
_DEFAULT_ROOT = Path(__file__).resolve().parents[2]
_BODY_LIMIT = 64 * 1024


class _SanitizeRouteErrors(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        # The Phase 2 route logs exceptions; provider exception strings may contain credentials.
        record.exc_info = None
        record.exc_text = None
        record.stack_info = None
        return True


logging.getLogger("app.api.v1.recommendations").addFilter(_SanitizeRouteErrors())


class _UnavailableSmap:
    async def get_surface(self, location, assessment_end, *, deadline):
        return None


def _smap_provider(data_root: Path):
    """Prefer a checksum-pinned archive when present; otherwise stay unavailable."""
    archive = data_root / "backend" / "tests" / "fixtures" / "smap_archive.json"
    if archive.is_file():
        return SmapArchiveProvider(archive)
    return _UnavailableSmap()


def _origins() -> list[str]:
    raw = os.getenv("BACKEND_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
    origins = [item.strip() for item in raw.split(",") if item.strip()]
    if not origins or any("*" in origin or not origin.startswith(("http://", "https://")) for origin in origins):
        raise ValueError("BACKEND_ALLOWED_ORIGINS must be an explicit HTTP origin list")
    return origins


@asynccontextmanager
async def lifespan(application: FastAPI):
    fixture_enabled = os.getenv("ENABLE_DEMO_FIXTURES") == "true"
    application.state.fixture_enabled = fixture_enabled
    application.state.data_root = Path(os.getenv("BACKEND_DATA_DIR", str(_DEFAULT_ROOT))).resolve()
    application.state.http_client = None
    application.state.live_providers = None
    if fixture_enabled:
        load_fixture_manifest(application.state.data_root)

    # Live providers stay mounted even when demo fixtures are enabled so
    # data_mode=auto can reach NASA POWER for custom map points.
    cache_dir = application.state.data_root / "backend" / ".provider_cache"
    provider_cache = DiskHttpCache(cache_dir)
    timeout = httpx.Timeout(connect=2.0, read=4.0, write=2.0, pool=1.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        application.state.http_client = client
        fetcher = HttpxJsonFetcher(client, provider_cache)
        application.state.live_providers = ProviderBundle(
            power=NasaPowerProvider(fetcher),
            soil=IsricSoilProvider(fetcher, rest_enabled=os.getenv("ENABLE_SOILGRIDS_REST") == "true"),
            smap=_smap_provider(application.state.data_root),
        )
        try:
            yield
        finally:
            application.state.live_providers = None
            application.state.http_client = None


app: FastAPI = FastAPI(title="Field Shift API", version="1.0.0", lifespan=lifespan)
app.include_router(router)
app.add_middleware(CORSMiddleware, allow_origins=_origins(), allow_methods=["GET", "POST", "OPTIONS"],
                   allow_headers=["Content-Type", "Accept", "X-Request-ID"],
                   expose_headers=["X-Request-ID"])


def _error_response(request_id: str, status: int, code: str, message: str) -> JSONResponse:
    envelope = ErrorEnvelope(schema_version="1.0.0", request_id=request_id,
                             error=Error(code=code, message=message, retryable=False, details=()))
    return JSONResponse(status_code=status, content=envelope.model_dump(mode="json"),
                        headers={"X-Request-ID": request_id})


@app.middleware("http")
async def request_guard(request: Request, call_next):
    request_id = str(uuid4())
    request.state.request_id = request_id
    if request.method == "POST":
        try:
            if int(request.headers.get("content-length", "0")) > _BODY_LIMIT:
                return _error_response(request_id, 413, "PAYLOAD_TOO_LARGE", "JSON body exceeds 64 KiB.")
        except ValueError:
            return _error_response(request_id, 422, "VALIDATION_ERROR", "Invalid Content-Length header.")
    try:
        response = await call_next(request)
    except Exception:
        _LOG.error("Unhandled request failure request_id=%s", request_id)
        return _error_response(request_id, 500, "INTERNAL_ERROR", "Internal server error.")
    response.headers.setdefault("X-Request-ID", str(request.state.request_id))
    return response


async def _providers_for_request(payload: RecommendationRequest, request: Request) -> ProviderBundle:
    if payload.data_mode == "fixture":
        if not getattr(request.app.state, "fixture_enabled", False):
            raise FixtureMismatch("Demo fixture mode is disabled")
        return create_fixture_provider_bundle(request.app.state.data_root, payload.location, enabled=True)
    providers = getattr(request.app.state, "live_providers", None)
    if not isinstance(providers, ProviderBundle):
        raise RequiredDataUnavailable("Live providers are not configured.", True)
    return providers


app.dependency_overrides[get_provider_bundle] = _providers_for_request


@app.get("/health/live")
async def liveness() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/ready", response_model=None)
async def readiness(request: Request) -> JSONResponse | dict[str, str]:
    if request.app.state.fixture_enabled or isinstance(request.app.state.live_providers, ProviderBundle):
        return {"status": "ready"}
    return JSONResponse(status_code=503, content={"status": "unavailable"})
