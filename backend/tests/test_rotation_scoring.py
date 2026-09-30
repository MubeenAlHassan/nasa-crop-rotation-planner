from datetime import date
from pathlib import Path

import pytest
from app.catalog.registry import load_crop_catalog
from app.engine.scoring import score_rotation
from app.schemas.contracts import (
    Climate,
    Features,
    Moisture,
    RecommendationRequest,
    SlotScenario,
    Soil,
    SoilFieldSources,
)

CATALOG = load_crop_catalog(Path(__file__).parents[1] / "data" / "punjab_crops.json", "punjab_pk_demo_v1")


def request(start="2025-10-25", history=(), irrigation="rainfed"):
    return RecommendationRequest.model_validate({
        "location": {"latitude": 31.4504, "longitude": 73.135}, "region_id": "punjab_pk_demo_v1",
        "assessment_end": "2025-10-15", "slots": [{"slot_id": "slot", "start_date": start, "end_date": "2026-03-31"}],
        "crop_history": history, "irrigation": irrigation,
    }, context={"today_utc": date(2025, 10, 15)})


def features(rain=100, temp=18, ph=7, band="severe_dry", percentile=None):
    origins = {key: "unavailable" for key in ("ph", "soc_g_kg", "total_n_g_kg", "sand_pct", "silt_pct", "clay_pct")}
    if ph is not None:
        origins["ph"] = "farmer_input"
    return Features(
        climate=Climate(window_start=date(2025, 7, 18), window_end=date(2025, 10, 15), baseline_start_year=1991, baseline_end_year=2020, rainfall_observed_mm=60, rainfall_baseline_mm=100, rainfall_anomaly_pct=-40, rainfall_band=band, temperature_observed_c=25, temperature_baseline_c=24, temperature_anomaly_c=1, heat_band="elevated", rainfall_coverage=1, temperature_coverage=1, rainfall_baseline_years=30, temperature_baseline_years=30),
        soil=Soil(depth_top_cm=0, depth_bottom_cm=30, ph=ph, soc_g_kg=None, total_n_g_kg=None, sand_pct=None, silt_pct=None, clay_pct=None, field_sources=SoilFieldSources(**origins)),
        moisture=Moisture(surface_m3_m3=.2 if percentile is not None else None, percentile=percentile, accepted_overpasses=3 if percentile is not None else 0, latest_observation=date(2025, 10, 15) if percentile is not None else None, depth_cm=5),
        slot_scenarios=(SlotScenario(slot_id="slot", kind="historical_stress_scenario", rainfall_mm=rain, temperature_c=temp, rainfall_baseline_years=30, temperature_baseline_years=30, smap_adjustment_applied=percentile is not None),),
    )


def test_golden_components_and_decimal_score():
    history = [{"crop_id": "maize", "start_date": "2025-05-01", "end_date": "2025-09-30", "residue_management": "retained"}]
    result = score_rotation(("chickpea",), request(history=history), CATALOG, features())
    assert result.components.nitrogen == 90
    assert result.components.roots == 40
    assert result.components.water == 100
    assert result.components.temperature == 100
    assert result.components.soil == 100
    assert result.unrounded_score == 85.5
    assert score_rotation(("chickpea",), request(history=history), CATALOG, features()) == result


def test_retained_legume_water_penalty_and_partial_weights():
    history = [{"crop_id": "chickpea", "start_date": "2024-10-25", "end_date": "2025-04-30", "residue_management": "retained"}]
    result = score_rotation(("wheat",), request(start="2025-11-01", history=history, irrigation="available"), CATALOG, features(rain=500))
    assert result.components.nitrogen == 100 and result.components.water == 70
    assert result.unrounded_score == 79
    limited = score_rotation(("chickpea",), request(), CATALOG, features(ph=None))
    assert limited.components.nitrogen is None and limited.components.soil is None
    assert limited.effective_weights.nitrogen == 0 and limited.effective_weights.soil == 0
    assert sum(limited.effective_weights.model_dump().values()) == pytest.approx(1)
    assert {w.code for w in limited.warnings} >= {"HISTORY_UNKNOWN", "SOIL_SCREEN_INCOMPLETE"}


def test_residue_moisture_and_wet_threshold_deductions():
    history = [{"crop_id": "chickpea", "start_date": "2024-10-25", "end_date": "2025-04-30", "residue_management": "unknown"}]
    req = request(start="2025-11-01", history=history, irrigation="available")
    dry = score_rotation(("wheat",), req, CATALOG, features(rain=500, percentile=19.9))
    assert dry.components.nitrogen == 75
    assert dry.components.water == 60
    assert any(item.code == "LIMITED_RESIDUE_BENEFIT" for item in dry.reasons)
    wet = score_rotation(("wheat",), req, CATALOG, features(rain=500, band="severe_wet", percentile=20))
    assert wet.components.water == 80
