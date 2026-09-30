"""Versioned catalog and recommendation routes with public error envelopes."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID, uuid4

from app.catalog.registry import load_crop_catalog
from app.schemas.contracts import (
    CropCatalogResponse,
    Error,
    ErrorDetail,
    ErrorEnvelope,
    RecommendationRequest,
    RecommendationResponse,
)
from app.schemas.domain import FixtureMismatch, ProviderBundle, RequiredDataUnavailable
from app.services.recommendation import build_recommendation_response
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute

_LOG = logging.getLogger(__name__)
_CATALOG = Path(__file__).parents[3] / "data" / "punjab_crops.json"


def _error(request_id: UUID, status: int, code: str, message: str, retryable: bool,
           details: tuple[ErrorDetail, ...] = ()) -> JSONResponse:
    envelope = ErrorEnvelope(schema_version="1.0.0", request_id=request_id,
                             error=Error(code=code, message=message, retryable=retryable, details=details))
    return JSONResponse(status_code=status, content=envelope.model_dump(mode="json"),
                        headers={"X-Request-ID": str(request_id)})


class EnvelopeRoute(APIRoute):
    def get_route_handler(self):
        original = super().get_route_handler()

        async def handler(request: Request):
            request_id = uuid4()
            request.state.request_id = request_id
            if request.method == "POST":
                media_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
                if media_type != "application/json":
                    return _error(request_id, 415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json.", False)
                try:
                    if int(request.headers.get("content-length", "0")) > 65536:
                        return _error(request_id, 413, "PAYLOAD_TOO_LARGE", "JSON body exceeds 64 KiB.", False)
                except ValueError:
                    return _error(request_id, 422, "VALIDATION_ERROR", "Invalid Content-Length header.", False)
                body = bytearray()
                async for chunk in request.stream():
                    body.extend(chunk)
                    if len(body) > 65536:
                        return _error(request_id, 413, "PAYLOAD_TOO_LARGE", "JSON body exceeds 64 KiB.", False)
                request._body = bytes(body)
            try:
                response = await original(request)
            except RequestValidationError as exc:
                details = tuple(ErrorDetail(
                    path="/" + "/".join(str(part) for part in error["loc"] if part not in ("body", "query")),
                    message=str(error.get("msg", "Invalid value"))[:500],
                ) for error in exc.errors())
                return _error(request_id, 422, "VALIDATION_ERROR", "Request validation failed.", False, details)
            except FixtureMismatch as exc:
                return _error(request_id, 422, "VALIDATION_ERROR", "Fixture request does not match pinned inputs.", False,
                              (ErrorDetail(path="/data_mode", message=exc.message[:500]),))
            except RequiredDataUnavailable as exc:
                return _error(request_id, 503, "REQUIRED_DATA_UNAVAILABLE", exc.message[:500], exc.retryable)
            except HTTPException as exc:
                if exc.status_code == 422:
                    return _error(request_id, 422, "VALIDATION_ERROR", str(exc.detail)[:500], False)
                if exc.status_code == 429:
                    response = _error(request_id, 429, "RATE_LIMITED", "Rate limit exceeded.", True)
                    if exc.headers and "Retry-After" in exc.headers:
                        response.headers["Retry-After"] = exc.headers["Retry-After"]
                    return response
                _LOG.exception("HTTP failure request_id=%s", request_id)
                return _error(request_id, 500, "INTERNAL_ERROR", "Internal server error.", False)
            except Exception:
                _LOG.exception("Recommendation failure request_id=%s", request_id)
                return _error(request_id, 500, "INTERNAL_ERROR", "Internal server error.", False)
            response.headers["X-Request-ID"] = str(request_id)
            return response

        return handler


router = APIRouter(route_class=EnvelopeRoute)


def get_provider_bundle(request: Request) -> ProviderBundle:
    providers = getattr(request.app.state, "providers", None)
    if not isinstance(providers, ProviderBundle):
        raise RequiredDataUnavailable("Provider bundle is not configured.", True)
    return providers


@router.get("/api/v1/crops", response_model=CropCatalogResponse)
def get_crops(region_id: str) -> CropCatalogResponse:
    if region_id != "punjab_pk_demo_v1":
        raise HTTPException(status_code=422, detail="Unknown region ID.")
    return load_crop_catalog(_CATALOG, region_id)


@router.post("/api/v1/recommend-rotation", response_model=RecommendationResponse)
async def recommend_rotation(
    payload: RecommendationRequest, request: Request,
    providers: ProviderBundle = Depends(get_provider_bundle),
) -> RecommendationResponse:
    return await build_recommendation_response(
        payload, providers, request_id=request.state.request_id, generated_at=datetime.now(UTC),
    )
