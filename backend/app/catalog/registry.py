"""Load the versioned, cited regional crop catalog without modifying source order."""

from __future__ import annotations

import json
from pathlib import Path

from app.schemas.contracts import CropCatalogResponse


def load_crop_catalog(path: Path, region_id: str) -> CropCatalogResponse:
    if region_id != "punjab_pk_demo_v1":
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
