from datetime import date
from pathlib import Path

from app.catalog.registry import load_crop_catalog
from app.engine.constraints import check_rotation
from app.schemas.contracts import PlantingWindow, RecommendationRequest, Soil, SoilFieldSources

CATALOG = load_crop_catalog(Path(__file__).parents[1] / "data" / "punjab_crops.json", "punjab_pk_demo_v1")
SOURCES = SoilFieldSources(**{key: "unavailable" for key in ("ph", "soc_g_kg", "total_n_g_kg", "sand_pct", "silt_pct", "clay_pct")})


def request(start="2025-10-25", end="2026-03-31", history=()):
    return RecommendationRequest.model_validate({
        "location": {"latitude": 31.4504, "longitude": 73.135}, "region_id": "punjab_pk_demo_v1",
        "assessment_end": "2025-10-15", "slots": [{"slot_id": "rabi", "start_date": start, "end_date": end}],
        "crop_history": list(history), "irrigation": "rainfed",
    }, context={"today_utc": date(2025, 10, 15)})


def soil(ph=None):
    origins = SOURCES.model_copy(update={"ph": "farmer_input"}) if ph is not None else SOURCES
    return Soil(depth_top_cm=0, depth_bottom_cm=30, ph=ph, soc_g_kg=None, total_n_g_kg=None, sand_pct=None, silt_pct=None, clay_pct=None, field_sources=origins)


def codes(ids, req, topsoil):
    return {item.code for item in check_rotation(ids, req, CATALOG, topsoil)}


def test_exact_calendar_maturity_and_ph_boundaries():
    req = request()
    assert not codes(("chickpea",), req, soil(6))
    assert not codes(("chickpea",), req, soil(8.5))
    assert "SOIL_PH_OUT_OF_RANGE" in codes(("chickpea",), req, soil(8.51))
    assert "CALENDAR_INCOMPATIBLE" in codes(("chickpea",), request(start="2025-10-26"), soil(7))
    assert "MATURITY_WINDOW_TOO_SHORT" in codes(("chickpea",), request(end="2025-11-23"), soil(7))
    assert "IRRIGATION_REQUIRED" in codes(("wheat",), req, soil(7))


def test_history_family_break_and_unknown_ph():
    history = ({"crop_id": "chickpea", "start_date": "2025-01-01", "end_date": "2025-04-30", "residue_management": "unknown"},)
    assert "FAMILY_BREAK_REQUIRED" in codes(("chickpea",), request(history=history), soil())
    assert "SOIL_PH_OUT_OF_RANGE" not in codes(("chickpea",), request(), soil())


def test_year_crossing_calendar_is_inclusive():
    crop = CATALOG.crops[1].model_copy(update={
        "planting_windows": (PlantingWindow(start_mmdd="1201", end_mmdd="0131"),),
    })
    catalog = CATALOG.model_copy(update={"crops": (crop,)})
    for start, expected in (("2025-12-01", False), ("2026-01-31", False), ("2026-02-01", True)):
        req = request(start=start, end="2026-05-31")
        assert any(item.code == "CALENDAR_INCOMPATIBLE" for item in check_rotation(("chickpea",), req, catalog, soil())) is expected


def test_family_break_carries_across_planned_slots():
    req = RecommendationRequest.model_validate({
        "location": {"latitude": 31.4504, "longitude": 73.135}, "region_id": "punjab_pk_demo_v1",
        "assessment_end": "2025-10-15",
        "slots": [
            {"slot_id": "first", "start_date": "2025-10-25", "end_date": "2026-03-31"},
            {"slot_id": "second", "start_date": "2026-10-25", "end_date": "2027-03-31"},
        ],
        "irrigation": "rainfed",
    }, context={"today_utc": date(2025, 10, 15)})
    failures = check_rotation(("chickpea", "chickpea"), req, CATALOG, soil())
    assert any(item.slot_id == "second" and item.code == "FAMILY_BREAK_REQUIRED" for item in failures)
