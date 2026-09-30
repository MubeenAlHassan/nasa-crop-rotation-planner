"""Normalize verified topsoil layers and overlay dated farmer observations."""

from __future__ import annotations

from app.schemas.contracts import Message, Soil, SoilFieldSources, SoilOverride
from app.schemas.domain import SoilProfile, SoilResult

_FIELDS = {
    "ph": "phh2o", "soc_g_kg": "soc", "total_n_g_kg": "nitrogen",
    "sand_pct": "sand", "silt_pct": "silt", "clay_pct": "clay",
}
_DEPTHS = ((0, 5, 5), (5, 15, 10), (15, 30, 15))


def build_soil_result(profile: SoilProfile | None, override: SoilOverride | None) -> SoilResult:
    values: dict[str, float | None] = {}
    origins: dict[str, str] = {}
    layers = {(layer.property, layer.depth_top_cm, layer.depth_bottom_cm): layer
              for layer in profile.layers} if profile is not None else {}
    for field, property_name in _FIELDS.items():
        selected = [layers.get((property_name, start, end)) for start, end, _ in _DEPTHS]
        if all(layer is not None and layer.mean_raw is not None for layer in selected):
            values[field] = sum(
                weight * layer.mean_raw / layer.conversion_factor
                for layer, (_, _, weight) in zip(selected, _DEPTHS, strict=True)
            ) / 30
            origins[field] = "soilgrids"
        else:
            values[field] = None
            origins[field] = "unavailable"
        if override is not None and (farmer_value := getattr(override, field)) is not None:
            values[field] = farmer_value
            origins[field] = "farmer_input"
    warnings = []
    texture = (values["sand_pct"], values["silt_pct"], values["clay_pct"])
    if all(value is not None for value in texture) and abs(sum(texture) - 100) > 2:
        warnings.append(Message(code="SOIL_TEXTURE_INCONSISTENT", message="Mapped or supplied texture percentages differ from 100 by more than two points."))
    soil = Soil(
        depth_top_cm=0, depth_bottom_cm=30, **values,
        field_sources=SoilFieldSources(**origins),
    )
    return SoilResult(soil=soil, warnings=tuple(warnings))
