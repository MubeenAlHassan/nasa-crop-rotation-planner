"""Load versioned, cited regional crop catalogs without modifying source order."""

from __future__ import annotations

import json
from pathlib import Path

from app.schemas.contracts import CropCatalogResponse

_DATA = Path(__file__).resolve().parents[2] / "data"
CATALOG_FILES: dict[str, Path] = {
    "punjab_pk_demo_v1": _DATA / "punjab_crops.json",
    "maryland_usa_demo_v1": _DATA / "maryland_crops.json",
    "uk_england_demo_v1": _DATA / "uk_crops.json",
}

# Union of crop IDs across shipped demo catalogs (request allow/exclude validation).
KNOWN_CROP_IDS: frozenset[str] = frozenset({
    "wheat", "chickpea", "maize", "soybean", "barley", "field_bean",
})


def supported_region_ids() -> frozenset[str]:
    return frozenset(CATALOG_FILES)


def load_crop_catalog(path: Path, region_id: str) -> CropCatalogResponse:
    if region_id not in CATALOG_FILES:
        raise ValueError("Unknown region_id")
    try:
        raw = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError("Crop catalog cannot be read") from exc
    if not isinstance(raw, dict) or raw.get("region_id") != region_id:
        raise ValueError("Crop catalog region mismatch")
    try:
        return CropCatalogResponse.model_validate(raw)
    except ValueError as exc:
        raise ValueError("Invalid crop catalog") from exc
