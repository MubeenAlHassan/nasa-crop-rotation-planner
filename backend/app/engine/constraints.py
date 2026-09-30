"""Pure hard agronomic filters; observed stress never excludes a future crop."""

from __future__ import annotations

from app.schemas.contracts import Crop, CropCatalogResponse, Exclusion, RecommendationRequest, Soil

_TEXT = {
    "CROP_EXCLUDED": "Crop is explicitly excluded.",
    "CROP_NOT_ALLOWED": "Crop is outside the allowed selection.",
    "CALENDAR_INCOMPATIBLE": "Planting date is outside the catalog window.",
    "MATURITY_WINDOW_TOO_SHORT": "The dated slot is shorter than the crop minimum maturity.",
    "IRRIGATION_REQUIRED": "Crop requires irrigation but this plan is rainfed.",
    "FAMILY_BREAK_REQUIRED": "Catalog disease-family break is not met.",
    "SOIL_PH_OUT_OF_RANGE": "Known soil pH is outside the crop interval.",
}


def _calendar_matches(crop: Crop, day) -> bool:
    mmdd = day.strftime("%m%d")
    return any(
        window.start_mmdd <= mmdd <= window.end_mmdd
        if window.start_mmdd <= window.end_mmdd
        else mmdd >= window.start_mmdd or mmdd <= window.end_mmdd
        for window in crop.planting_windows
    )


def check_rotation(
    crop_ids: tuple[str, ...], request: RecommendationRequest,
    catalog: CropCatalogResponse, soil: Soil,
) -> tuple[Exclusion, ...]:
    if len(crop_ids) != len(request.slots) or catalog.region_id != request.region_id:
        raise ValueError("Rotation shape or region mismatch")
    crops = {crop.crop_id: crop for crop in catalog.crops}
    if any(crop_id not in crops for crop_id in crop_ids):
        raise ValueError("Unknown crop ID")
    lineage = [crops[item.crop_id] for item in request.crop_history if item.crop_id in crops]
    exclusions = []
    for slot, crop_id in zip(request.slots, crop_ids, strict=True):
        crop = crops[crop_id]
        codes = []
        if crop_id in request.excluded_crop_ids:
            codes.append("CROP_EXCLUDED")
        if request.allowed_crop_ids and crop_id not in request.allowed_crop_ids:
            codes.append("CROP_NOT_ALLOWED")
        if not _calendar_matches(crop, slot.start_date):
            codes.append("CALENDAR_INCOMPATIBLE")
        if (slot.end_date - slot.start_date).days + 1 < crop.maturity_min_days:
            codes.append("MATURITY_WINDOW_TOO_SHORT")
        if request.irrigation == "rainfed" and crop.irrigation_required:
            codes.append("IRRIGATION_REQUIRED")
        if soil.ph is not None and not crop.ph_min <= soil.ph <= crop.ph_max:
            codes.append("SOIL_PH_OUT_OF_RANGE")
        if crop.family_break_crops:
            for index in range(len(lineage) - 1, -1, -1):
                if lineage[index].family == crop.family:
                    if len(lineage) - 1 - index < crop.family_break_crops:
                        codes.append("FAMILY_BREAK_REQUIRED")
                    break
        exclusions.extend(Exclusion(slot_id=slot.slot_id, crop_id=crop_id, code=code, message=_TEXT[code]) for code in codes)
        lineage.append(crop)
    unique = {(item.slot_id, item.crop_id, item.code): item for item in exclusions}
    return tuple(unique[key] for key in sorted(unique))
