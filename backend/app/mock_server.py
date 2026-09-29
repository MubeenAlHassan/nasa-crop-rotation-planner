"""Synthetic, zero-provider ASGI implementation of the public API contract.

This server exists for contract and frontend integration tests. Every climate
number and recommendation below is synthetic and is never read from a captured
POWER, SoilGrids or SMAP observation archive.
"""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.schemas.contracts import (
    CropCatalogResponse, Error as WireError, ErrorDetail, ErrorEnvelope,
    RecommendationRequest, RecommendationResponse,
)

CATALOG_PATH = Path(__file__).resolve().parents[1] / "data/punjab_crops.json"
CATALOG = CropCatalogResponse.model_validate_json(CATALOG_PATH.read_text())
SYNTHETIC_ID = "synthetic-contract-example"
BODY_LIMIT = 64 * 1024

app = FastAPI(title="Field Shift synthetic contract API", version="1.0.0")
app.state.clock = lambda: datetime.now(UTC)
app.state.request_id_factory = uuid4


def _request_id(request: Request) -> UUID:
    return request.state.request_id


def _error(
    request: Request, *, status: int, code: str, message: str,
    details: tuple[ErrorDetail, ...] = (), retryable: bool = False,
) -> JSONResponse:
    envelope = ErrorEnvelope.model_validate({
        "schema_version": "1.0.0", "request_id": _request_id(request),
        "error": WireError(code=code, message=message, retryable=retryable, details=details),
    })
    return JSONResponse(
        status_code=status, content=envelope.model_dump(mode="json"),
        headers={"X-Request-ID": str(_request_id(request))},
    )


@app.middleware("http")
async def request_contract_guard(request: Request, call_next):
    request.state.request_id = app.state.request_id_factory()
    if request.method == "POST":
        if request.headers.get("content-type", "").split(";", 1)[0].strip().lower() != "application/json":
            return _error(request, status=415, code="UNSUPPORTED_MEDIA_TYPE",
                          message="Content-Type must be application/json.")
        if len(await request.body()) > BODY_LIMIT:
            return _error(request, status=413, code="PAYLOAD_TOO_LARGE",
                          message="JSON body exceeds 64 KiB.")
    response = await call_next(request)
    response.headers["X-Request-ID"] = str(_request_id(request))
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    details = tuple(ErrorDetail(
        path="/" + "/".join(str(part).replace("~", "~0").replace("/", "~1")
                            for part in error["loc"] if part not in ("body", "query")),
        message=str(error["msg"])[:500],
    ) for error in exc.errors())
    return _error(request, status=422, code="VALIDATION_ERROR",
                  message="Request validation failed.", details=details)


@app.get("/api/v1/crops", response_model=CropCatalogResponse)
async def get_crops(request: Request, region_id: str) -> CropCatalogResponse | JSONResponse:
    if region_id != CATALOG.region_id:
        return _error(request, status=422, code="VALIDATION_ERROR",
                      message="Unknown region.",
                      details=(ErrorDetail(path="/region_id", message="Unknown region ID."),))
    return CATALOG


def _unavailable(provider: str) -> dict:
    return {
        "provider": provider, "mode": "unavailable", "product": None,
        "observed_start": None, "observed_end": None, "retrieved_at": None,
        "grid_resolution_km": None, "spatial_support": None, "fixture_id": None,
        "used_for": [],
    }


def _synthetic_response(
    request: RecommendationRequest, request_id: UUID, generated_at: datetime,
) -> RecommendationResponse:
    first_day = request.assessment_end - timedelta(days=89)
    soil_names = ("ph", "soc_g_kg", "total_n_g_kg", "sand_pct", "silt_pct", "clay_pct")
    soil_values = {
        name: getattr(request.soil_override, name) if request.soil_override else None
        for name in soil_names
    }
    farmer_used_for = [f"/features/soil/{name}" for name, value in soil_values.items()
                       if value is not None]
    farmer_source = _unavailable("farmer_input")
    if farmer_used_for:
        farmer_source = {
            "provider": "farmer_input", "mode": "farmer_input", "product": "Self-reported 0–30 cm sample",
            "observed_start": request.soil_override.sampled_on,
            "observed_end": request.soil_override.sampled_on,
            "retrieved_at": generated_at, "grid_resolution_km": None,
            "spatial_support": "User-entered 0–30 cm sample", "fixture_id": None,
            "used_for": farmer_used_for,
        }
    eligible = [crop.crop_id for crop in CATALOG.crops
                if (not request.allowed_crop_ids or crop.crop_id in request.allowed_crop_ids)
                and crop.crop_id not in request.excluded_crop_ids]
    exclusions = sorted((
        {"slot_id": slot.slot_id, "crop_id": crop.crop_id,
         "code": "CROP_EXCLUDED" if crop.crop_id in request.excluded_crop_ids else "CROP_NOT_ALLOWED",
         "message": "Excluded by the synthetic mock's request filter."}
        for slot in request.slots for crop in CATALOG.crops
        if crop.crop_id in request.excluded_crop_ids
        or (request.allowed_crop_ids and crop.crop_id not in request.allowed_crop_ids)
    ), key=lambda item: (item["slot_id"], item["crop_id"], item["code"]))
    chosen_id = sorted(eligible)[0] if eligible else None
    chosen_name = next((crop.crop_name for crop in CATALOG.crops if crop.crop_id == chosen_id), None)
    recommendations = []
    if chosen_id is not None:
        rotation_key = {
            "catalog_version": CATALOG.catalog_version, "rules_version": "agronomy-v1",
            "slots": [{"slot_id": slot.slot_id, "crop_id": chosen_id} for slot in request.slots],
        }
        digest = hashlib.sha256(json.dumps(rotation_key, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
        recommendations = [{
            "rank": 1, "rotation_id": f"rot_{digest}", "score": 50.0,
            "components": {"nitrogen": 50.0, "roots": 50.0, "water": 50.0,
                           "temperature": 50.0, "soil": None},
            "effective_weights": {"nitrogen": 0.25, "roots": 0.25, "water": 0.25,
                                  "temperature": 0.25, "soil": 0.0},
            "slots": [{"slot_id": slot.slot_id, "crop_id": chosen_id, "crop_name": chosen_name,
                       "start_date": slot.start_date, "end_date": slot.end_date}
                      for slot in request.slots],
            "reasons": [{"code": "SEASONAL_CLIMATE_FIT",
                         "message": "Synthetic mock score for API testing; no agronomic assessment was made."}],
        }]
    warnings = [
        {"code": "DEMO_FIXTURE", "message": "Synthetic mock data; not a captured provider fixture."},
        {"code": "SOILGRIDS_UNAVAILABLE", "message": "No SoilGrids observations are used by the mock."},
        {"code": "SMAP_UNAVAILABLE", "message": "No SMAP observations are used by the mock."},
    ]
    if not request.crop_history:
        warnings.append({"code": "HISTORY_UNKNOWN", "message": "Crop history was not supplied."})
    if any(value is None for value in soil_values.values()):
        warnings.append({"code": "SOIL_SCREEN_INCOMPLETE", "message": "Some soil fields are unavailable."})
    if chosen_id is None:
        warnings.append({"code": "NO_FEASIBLE_ROTATION", "message": "No permitted crop ID remains."})
    payload = {
        "schema_version": "1.0.0", "request_id": request_id, "generated_at": generated_at,
        "status": "degraded" if recommendations else "no_feasible_rotation",
        "rules_version": "agronomy-v1", "catalog_version": CATALOG.catalog_version,
        "location": request.location, "data_quality": "limited",
        "features": {
            "climate": {
                "window_start": first_day, "window_end": request.assessment_end,
                "baseline_start_year": 1991, "baseline_end_year": 2020,
                "rainfall_observed_mm": 120.0, "rainfall_baseline_mm": 150.0,
                "rainfall_anomaly_pct": -20.0, "temperature_observed_c": 25.0,
                "temperature_baseline_c": 24.0, "temperature_anomaly_c": 1.0,
                "rainfall_band": "dry", "heat_band": "elevated",
                "rainfall_coverage": 1.0, "temperature_coverage": 1.0,
                "rainfall_baseline_years": 30, "temperature_baseline_years": 30,
            },
            "soil": {"depth_top_cm": 0, "depth_bottom_cm": 30, **soil_values,
                     "field_sources": {name: "farmer_input" if value is not None else "unavailable"
                                       for name, value in soil_values.items()}},
            "moisture": {"surface_m3_m3": None, "percentile": None,
                         "accepted_overpasses": 0, "latest_observation": None, "depth_cm": 5},
            "slot_scenarios": [{"slot_id": slot.slot_id, "kind": "historical_stress_scenario",
                                "rainfall_mm": 100.0, "temperature_c": 20.0,
                                "rainfall_baseline_years": 30, "temperature_baseline_years": 30,
                                "smap_adjustment_applied": False} for slot in request.slots],
        },
        "sources": [
            {"provider": "power", "mode": "fixture", "product": "Synthetic POWER-like mock",
             "observed_start": first_day, "observed_end": request.assessment_end,
             "retrieved_at": generated_at, "grid_resolution_km": None,
             "spatial_support": "Synthetic point, no provider grid", "fixture_id": SYNTHETIC_ID,
             "used_for": ["/features/climate", "/features/slot_scenarios"]},
            _unavailable("soilgrids"), _unavailable("smap"), farmer_source,
        ],
        "recommendations": recommendations, "feasible_rotation_count": len(recommendations),
        "exclusions": exclusions, "warnings": warnings,
    }
    return RecommendationResponse.model_validate(payload, context={"request": request})


@app.post("/api/v1/recommend-rotation", response_model=RecommendationResponse)
async def recommend_rotation(
    request: Request, payload: RecommendationRequest,
) -> RecommendationResponse:
    return _synthetic_response(payload, _request_id(request), app.state.clock())
