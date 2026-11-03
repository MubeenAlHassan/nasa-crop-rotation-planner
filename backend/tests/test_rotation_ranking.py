from datetime import date
from decimal import Decimal
from pathlib import Path

import app.engine.ranking as ranking
from app.catalog.registry import load_crop_catalog
from app.engine.ranking import rank_rotations
from app.engine.scoring import score_rotation
from app.schemas.contracts import PlantingWindow, RecommendationRequest
from test_rotation_scoring import features

CATALOG = load_crop_catalog(Path(__file__).parents[1] / "data" / "punjab_crops.json", "punjab_pk_demo_v1")


def request(allowed=(), top_k=3):
    return RecommendationRequest.model_validate({
        "location": {"latitude": 31.4504, "longitude": 73.135}, "region_id": "punjab_pk_demo_v1",
        "assessment_end": "2025-10-15", "slots": [{"slot_id": "rabi", "start_date": "2025-10-25", "end_date": "2026-03-31"}],
        "crop_history": [{"crop_id": "maize", "start_date": "2025-05-01", "end_date": "2025-09-30", "residue_management": "retained"}],
        "irrigation": "rainfed", "allowed_crop_ids": allowed, "top_k": top_k,
    }, context={"today_utc": date(2025, 10, 15)})


def test_real_constraints_precede_scoring_and_ids_repeat():
    climate_features = features()
    climate_features = climate_features.model_copy(update={"slot_scenarios": (climate_features.slot_scenarios[0].model_copy(update={"slot_id": "rabi"}),)})
    first = rank_rotations(request(), CATALOG, climate_features)
    assert first == rank_rotations(request(), CATALOG, climate_features)
    assert first.feasible_rotation_count == 1
    assert len(first.recommendations) == 1
    assert first.recommendations[0].slots[0].crop_id == "chickpea"
    assert first.recommendations[0].rotation_id.startswith("rot_")
    assert any(item.crop_id == "wheat" for item in first.exclusions)
    assert first.recommendations[0].rank == 1


def test_no_feasible_rotation_is_valid_result():
    climate_features = features()
    climate_features = climate_features.model_copy(update={"slot_scenarios": (climate_features.slot_scenarios[0].model_copy(update={"slot_id": "rabi"}),)})
    result = rank_rotations(request(allowed=("wheat",)), CATALOG, climate_features)
    assert result.feasible_rotation_count == 0
    assert result.recommendations == ()
    assert any(w.code == "NO_FEASIBLE_ROTATION" for w in result.warnings)


def test_ties_sort_lexically_and_respect_top_k(monkeypatch):
    window = (PlantingWindow(start_mmdd="1025", end_mmdd="1025"),)
    crops = tuple(crop.model_copy(update={"planting_windows": window, "irrigation_required": False, "ph_max": 8.5, "family_break_crops": 0}) for crop in CATALOG.crops)
    catalog = CATALOG.model_copy(update={"crops": crops})
    climate_features = features()
    climate_features = climate_features.model_copy(update={"slot_scenarios": (climate_features.slot_scenarios[0].model_copy(update={"slot_id": "rabi"}),)})

    def equal_score(ids, req, cat, feat):
        return score_rotation(ids, req, cat, feat).model_copy(update={"unrounded_score": Decimal("50")})

    monkeypatch.setattr(ranking, "score_rotation", equal_score)
    result = rank_rotations(request(top_k=2), catalog, climate_features)
    assert result.feasible_rotation_count == 3
    assert [item.slots[0].crop_id for item in result.recommendations] == ["chickpea", "maize"]
    assert [item.rank for item in result.recommendations] == [1, 2]
