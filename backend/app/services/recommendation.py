"""Bounded recommendation orchestration over injected, attributed providers."""

from __future__ import annotations

import asyncio
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from uuid import UUID

from app.catalog.registry import load_crop_catalog
from app.engine.ranking import rank_rotations
from app.features.climate import calculate_climate_features
from app.features.moisture import build_moisture_result
from app.features.soil import build_soil_result
from app.schemas.contracts import (
    Features,
    Message,
    RecommendationRequest,
    RecommendationResponse,
    Source,
)
from app.schemas.domain import (
    FixtureMismatch,
    ProviderBundle,
    ProviderError,
    RequiredDataUnavailable,
)

_CATALOG = Path(__file__).parents[2] / "data" / "punjab_crops.json"


def _unavailable(provider: str) -> Source:
    return Source(provider=provider, mode="unavailable", product=None, observed_start=None,
                  observed_end=None, retrieved_at=None, grid_resolution_km=None,
                  spatial_support=None, fixture_id=None, used_for=())


def _check_series(series, location, start: date, end: date) -> bool:
    return (series.location == location and bool(series.rows)
            and all(start <= row.day <= end for row in series.rows)
            and (series.source.observed_start is None or series.source.observed_start >= start)
            and (series.source.observed_end is None or series.source.observed_end <= end))


async def build_recommendation_response(
    request: RecommendationRequest, providers: ProviderBundle, *,
    request_id: UUID, generated_at: datetime,
) -> RecommendationResponse:
    catalog = load_crop_catalog(_CATALOG, request.region_id)
    deadline = time.monotonic() + 8.0
    observed_start = request.assessment_end - timedelta(days=89)
    tasks = (
        providers.power.get_daily(request.location, observed_start, request.assessment_end, deadline=deadline),
        providers.power.get_daily(request.location, date(1991, 1, 1), date(2020, 12, 31), deadline=deadline),
        providers.soil.get_topsoil(request.location, deadline=deadline),
        providers.smap.get_surface(request.location, request.assessment_end, deadline=deadline),
    )
    observations, baseline, soil_profile, smap_series = await asyncio.gather(*tasks, return_exceptions=True)
    for required in (observations, baseline):
        if isinstance(required, ProviderError):
            raise RequiredDataUnavailable("Required POWER observations or baseline are unavailable.", required.retryable) from required
        if isinstance(required, BaseException):
            raise required
    if not _check_series(observations, request.location, observed_start, request.assessment_end):
        raise RequiredDataUnavailable("POWER observation point or period mismatch.", False)
    if not _check_series(baseline, request.location, date(1991, 1, 1), date(2020, 12, 31)):
        raise RequiredDataUnavailable("POWER baseline point or period mismatch.", False)
    if request.data_mode == "fixture" and (
        observations.source.mode != "fixture" or baseline.source.mode != "fixture"
        or observations.source.fixture_id != baseline.source.fixture_id
    ):
        raise FixtureMismatch("Fixture mode requires pinned POWER inputs")
    if request.data_mode == "auto" and (observations.source.mode == "fixture" or baseline.source.mode == "fixture"):
        raise FixtureMismatch("Demo fixtures cannot be used in auto mode")
    if isinstance(soil_profile, ProviderError):
        soil_profile = None
    elif isinstance(soil_profile, BaseException):
        raise soil_profile
    if isinstance(smap_series, ProviderError):
        smap_series = None
    elif isinstance(smap_series, BaseException):
        raise smap_series
    if soil_profile is not None and soil_profile.location != request.location:
        raise FixtureMismatch("Soil point mismatch")
    if smap_series is not None and (smap_series.location != request.location or any(row.day > request.assessment_end for row in smap_series.rows)):
        raise FixtureMismatch("SMAP point or period mismatch")
    optional_sources = tuple(item.source for item in (soil_profile, smap_series) if item is not None)
    if request.data_mode == "auto" and any(source.mode == "fixture" for source in optional_sources):
        raise FixtureMismatch("Demo fixtures cannot be used in auto mode")
    if request.data_mode == "fixture" and any(
        source.mode != "fixture" or source.fixture_id != observations.source.fixture_id
        for source in optional_sources
    ):
        raise FixtureMismatch("Fixture sources do not match the pinned farm")
    climate = calculate_climate_features(observations, baseline, request.assessment_end, request.slots)
    if (climate.climate.rainfall_observed_mm is None and climate.climate.temperature_observed_c is None) or any(
        item.rainfall_mm is None and item.temperature_c is None for item in climate.slot_scenarios
    ):
        raise RequiredDataUnavailable("Matched POWER coverage is insufficient for recommendation.", False)
    soil = build_soil_result(soil_profile, request.soil_override)
    moisture = build_moisture_result(smap_series, request.assessment_end)
    scenarios = tuple(item.model_copy(update={"smap_adjustment_applied":
        moisture.moisture.percentile is not None and 0 <= (slot.start_date - request.assessment_end).days <= 30})
        for item, slot in zip(climate.slot_scenarios, request.slots, strict=True))
    features = Features(climate=climate.climate, soil=soil.soil, moisture=moisture.moisture, slot_scenarios=scenarios)
    ranking = rank_rotations(request, catalog, features)
    warnings = {message.code: message for message in (*climate.warnings, *soil.warnings, *moisture.warnings, *ranking.warnings)}
    if soil_profile is None:
        warnings["SOILGRIDS_UNAVAILABLE"] = Message(code="SOILGRIDS_UNAVAILABLE", message="Verified SoilGrids values are unavailable; farmer values are used where supplied.")
    if not request.crop_history or len(request.crop_history) < max(crop.family_break_crops for crop in catalog.crops):
        warnings["HISTORY_UNKNOWN"] = Message(code="HISTORY_UNKNOWN", message="Supplied crop history is insufficient to establish every disease-family break.")
    if features.soil.ph is None:
        warnings["SOIL_SCREEN_INCOMPLETE"] = Message(code="SOIL_SCREEN_INCOMPLETE", message="Soil pH is unavailable; crop screening is incomplete.")
    power_modes = {observations.source.mode, baseline.source.mode}
    if "stale_cache" in power_modes or (soil_profile is not None and soil_profile.source.mode == "stale_cache"):
        warnings["SOURCE_STALE"] = Message(code="SOURCE_STALE", message="One or more source snapshots are stale.")
    if "fixture" in power_modes:
        warnings["DEMO_FIXTURE"] = Message(code="DEMO_FIXTURE", message="Pinned historical demo fixtures are used; scenarios are not forecasts.")
    power_mode = "stale_cache" if "stale_cache" in power_modes else (
        "fixture" if "fixture" in power_modes else observations.source.mode
    )
    source_power = observations.source.model_copy(update={
        "mode": power_mode,
        "observed_start": date(1991, 1, 1), "observed_end": request.assessment_end,
        "used_for": ("/features/climate", "/features/slot_scenarios"),
    })
    source_soil = soil_profile.source.model_copy(update={"used_for": ("/features/soil",)}) if soil_profile is not None else _unavailable("soilgrids")
    source_smap = smap_series.source.model_copy(update={"used_for": ("/features/moisture",)}) if smap_series is not None else _unavailable("smap")
    farmer_fields = tuple(f"/features/soil/{key}" for key in ("ph", "soc_g_kg", "total_n_g_kg", "sand_pct", "silt_pct", "clay_pct") if request.soil_override is not None and getattr(request.soil_override, key) is not None)
    source_farmer = (Source(provider="farmer_input", mode="farmer_input", product="Farmer 0–30 cm soil sample",
        observed_start=request.soil_override.sampled_on, observed_end=request.soil_override.sampled_on,
        retrieved_at=None, grid_resolution_km=None, spatial_support="Farm composite sample",
        fixture_id=None, used_for=farmer_fields) if request.soil_override is not None else _unavailable("farmer_input"))
    complete = (
        features.climate.rainfall_anomaly_pct is not None and features.climate.temperature_anomaly_c is not None
        and all(item.rainfall_mm is not None and item.temperature_c is not None for item in scenarios)
        and features.soil.ph is not None and "HISTORY_UNKNOWN" not in warnings
        and all(item.smap_adjustment_applied or (slot.start_date - request.assessment_end).days > 30
                for item, slot in zip(scenarios, request.slots, strict=True))
        and not any(source.mode in ("stale_cache", "fixture", "unavailable") for source in (source_power, source_soil, source_smap))
    )
    quality = "complete" if complete else "limited"
    status = "no_feasible_rotation" if ranking.feasible_rotation_count == 0 else ("ok" if complete else "degraded")
    return RecommendationResponse.model_validate({
        "schema_version": "1.0.0", "request_id": request_id, "generated_at": generated_at,
        "status": status, "rules_version": "agronomy-v1", "catalog_version": catalog.catalog_version,
        "location": request.location, "data_quality": quality, "features": features,
        "sources": (source_power, source_soil, source_smap, source_farmer),
        "recommendations": ranking.recommendations,
        "feasible_rotation_count": ranking.feasible_rotation_count,
        "exclusions": ranking.exclusions,
        "warnings": tuple(warnings[key] for key in sorted(warnings)),
    }, context={"request": request})
