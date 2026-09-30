"""Bounded deterministic enumeration and ranking of feasible rotations."""

from __future__ import annotations

import hashlib
import json
from decimal import ROUND_HALF_UP, Decimal
from itertools import product

from app.engine.constraints import check_rotation
from app.engine.scoring import score_rotation
from app.schemas.contracts import (
    CropCatalogResponse,
    Features,
    Message,
    PlannedCrop,
    Recommendation,
    RecommendationRequest,
)
from app.schemas.domain import RankingResult


def _rotation_id(catalog_version: str, slots, crop_ids: tuple[str, ...]) -> str:
    canonical = json.dumps({
        "catalog_version": catalog_version, "rules_version": "agronomy-v1",
        "slots": [{"slot_id": slot.slot_id, "crop_id": crop_id}
                  for slot, crop_id in zip(slots, crop_ids, strict=True)],
    }, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return "rot_" + hashlib.sha256(canonical).hexdigest()


def rank_rotations(
    request: RecommendationRequest, catalog: CropCatalogResponse, features: Features,
) -> RankingResult:
    if catalog.region_id != request.region_id or len(catalog.crops) > 12 or len(request.slots) > 4:
        raise ValueError("Unsupported ranking region or size")
    crops = {crop.crop_id: crop for crop in catalog.crops}
    scored = []
    exclusions = {}
    for crop_ids in product(tuple(crops), repeat=len(request.slots)):
        crop_ids = tuple(crop_ids)
        failures = check_rotation(crop_ids, request, catalog, features.soil)
        if failures:
            for exclusion in failures:
                exclusions[(exclusion.slot_id, exclusion.crop_id, exclusion.code)] = exclusion
            continue
        scored.append(score_rotation(crop_ids, request, catalog, features))
    scored.sort(key=lambda item: (-item.unrounded_score, item.crop_ids))
    recommendations = []
    warnings = {}
    for rank, item in enumerate(scored[:request.top_k], 1):
        recommendations.append(Recommendation(
            rank=rank, rotation_id=_rotation_id(catalog.catalog_version, request.slots, item.crop_ids),
            score=float(item.unrounded_score.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)),
            components=item.components, effective_weights=item.effective_weights,
            slots=tuple(PlannedCrop(
                slot_id=slot.slot_id, crop_id=crop_id, crop_name=crops[crop_id].crop_name,
                start_date=slot.start_date, end_date=slot.end_date,
            ) for slot, crop_id in zip(request.slots, item.crop_ids, strict=True)),
            reasons=item.reasons,
        ))
        for warning in item.warnings:
            warnings[warning.code] = warning
    if not scored:
        warnings["NO_FEASIBLE_ROTATION"] = Message(code="NO_FEASIBLE_ROTATION", message="No crop sequence satisfies every hard constraint.")
    return RankingResult(
        recommendations=tuple(recommendations), feasible_rotation_count=len(scored),
        exclusions=tuple(exclusions[key] for key in sorted(exclusions)),
        warnings=tuple(warnings[key] for key in sorted(warnings)),
    )
