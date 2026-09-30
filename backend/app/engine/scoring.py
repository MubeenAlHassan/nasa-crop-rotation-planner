"""Deterministic agronomy-v1 component scoring for feasible rotations."""

from __future__ import annotations

from decimal import Decimal
from statistics import mean

from app.schemas.contracts import (
    Components,
    CropCatalogResponse,
    Features,
    Message,
    RecommendationRequest,
    Weights,
)
from app.schemas.domain import ScoredRotation

_WEIGHTS = {"nitrogen": Decimal("0.25"), "roots": Decimal("0.20"), "water": Decimal("0.30"), "temperature": Decimal("0.15"), "soil": Decimal("0.10")}
_ROOTS = {"shallow": 0, "medium": 1, "deep": 2}


def _distance(value: float, low: float, high: float) -> float:
    return max(low - value, 0.0, value - high)


def _clamp(value: float) -> float:
    return min(100.0, max(0.0, value))


def score_rotation(
    crop_ids: tuple[str, ...], request: RecommendationRequest,
    catalog: CropCatalogResponse, features: Features,
) -> ScoredRotation:
    if len(crop_ids) != len(request.slots) or len(features.slot_scenarios) != len(request.slots):
        raise ValueError("Rotation or scenario count mismatch")
    crops = {crop.crop_id: crop for crop in catalog.crops}
    if any(crop_id not in crops for crop_id in crop_ids):
        raise ValueError("Unknown crop ID")
    scores: dict[str, list[float]] = {key: [] for key in _WEIGHTS}
    warnings: dict[str, Message] = {}
    reasons: dict[str, Message] = {}
    previous = crops.get(request.crop_history[-1].crop_id) if request.crop_history else None
    previous_residue = request.crop_history[-1].residue_management if request.crop_history else "unknown"
    for slot, crop_id, scenario in zip(request.slots, crop_ids, features.slot_scenarios, strict=True):
        if scenario.slot_id != slot.slot_id:
            raise ValueError("Scenario slot mismatch")
        crop = crops[crop_id]
        if previous is None:
            warnings["HISTORY_UNKNOWN"] = Message(code="HISTORY_UNKNOWN", message="The prior crop is unknown; first transition scores are omitted.")
        else:
            if previous.legume and crop.nitrogen_demand == "high":
                nitrogen = 100 if previous_residue == "retained" else 75
                reasons["LEGUME_BEFORE_HIGH_DEMAND"] = Message(code="LEGUME_BEFORE_HIGH_DEMAND", message="A legume precedes a high-demand crop; residue management affects the comparison.")
                if previous_residue != "retained":
                    reasons["LIMITED_RESIDUE_BENEFIT"] = Message(code="LIMITED_RESIDUE_BENEFIT", message="Unknown or removed residues limit the assumed residual benefit.")
            elif previous.nitrogen_demand == "high" and not previous.legume and crop.legume:
                nitrogen = 90
                reasons["LEGUME_AFTER_HIGH_DEMAND"] = Message(code="LEGUME_AFTER_HIGH_DEMAND", message="A legume follows a high-demand nonlegume crop.")
            elif previous.nitrogen_demand == "high" and not previous.legume and crop.nitrogen_demand == "high" and not crop.legume:
                nitrogen = 30
            else:
                nitrogen = 60
            scores["nitrogen"].append(nitrogen)
            difference = abs(_ROOTS[previous.root_class] - _ROOTS[crop.root_class])
            scores["roots"].append((40, 75, 100)[difference])
            if difference:
                reasons["ROOT_DEPTH_ALTERNATION"] = Message(code="ROOT_DEPTH_ALTERNATION", message="The catalog rooting classes differ between adjacent crops.")
        previous, previous_residue = crop, "unknown"
        if scenario.rainfall_mm is not None:
            water = 100 - 100 * _distance(scenario.rainfall_mm, crop.rainfall_min_mm, crop.rainfall_max_mm) / max(crop.rainfall_max_mm, 10)
            band = features.climate.rainfall_band
            if not crop.drought_tolerant and band in ("severe_dry", "dry"):
                water -= 30 if band == "severe_dry" else 15
            if not crop.waterlogging_tolerant and band in ("wet", "severe_wet"):
                water -= 10 if band == "wet" else 20
            if (not crop.drought_tolerant and features.moisture.percentile is not None
                and features.moisture.percentile < 20
                and 0 <= (slot.start_date - request.assessment_end).days <= 30):
                water -= 10
            scores["water"].append(_clamp(water))
            reasons["WATER_STRESS_TOLERANCE"] = Message(code="WATER_STRESS_TOLERANCE", message="Seasonal rainfall exposure is compared with the catalog crop interval.")
        if scenario.temperature_c is not None:
            scores["temperature"].append(_clamp(100 - 10 * _distance(scenario.temperature_c, crop.temperature_min_c, crop.temperature_max_c)))
            reasons["SEASONAL_CLIMATE_FIT"] = Message(code="SEASONAL_CLIMATE_FIT", message="Historical stress temperature is compared with the catalog crop interval.")
        if features.soil.ph is not None:
            if not crop.ph_min <= features.soil.ph <= crop.ph_max:
                raise ValueError("Infeasible pH reached scoring")
            scores["soil"].append(100)
            reasons["SOIL_PH_FIT"] = Message(code="SOIL_PH_FIT", message="Known topsoil pH is within the catalog crop interval.")
    if features.soil.ph is None:
        warnings["SOIL_SCREEN_INCOMPLETE"] = Message(code="SOIL_SCREEN_INCOMPLETE", message="Soil pH is unavailable; suitability screening is incomplete.")
    values = {}
    for key, measurements in scores.items():
        values[key] = mean(measurements) if measurements else None
        if 0 < len(measurements) < len(crop_ids):
            warnings["PARTIAL_COMPONENT_COVERAGE"] = Message(code="PARTIAL_COMPONENT_COVERAGE", message="One or more component scores use only part of the planned sequence.")
    if not reasons:
        reasons["ROTATION_DIVERSITY"] = Message(code="ROTATION_DIVERSITY", message="The feasible crop sequence is compared using available rotation components.")
    active = sum(weight for key, weight in _WEIGHTS.items() if values[key] is not None)
    if active == 0:
        raise ValueError("No score components are available")
    effective = {key: float(weight / active) if values[key] is not None else 0.0 for key, weight in _WEIGHTS.items()}
    unrounded = sum(Decimal(str(values[key])) * _WEIGHTS[key] for key in _WEIGHTS if values[key] is not None) / active
    return ScoredRotation(
        crop_ids=crop_ids, components=Components(**values), effective_weights=Weights(**effective),
        unrounded_score=unrounded, reasons=tuple(reasons.values()), warnings=tuple(warnings.values()),
    )
