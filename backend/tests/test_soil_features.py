from datetime import date

import pytest
from app.features.soil import build_soil_result
from app.schemas.contracts import Location, SoilOverride, Source
from app.schemas.domain import SoilLayer, SoilProfile

LOCATION = Location(latitude=31.4504, longitude=73.135)
SOURCE = Source(provider="soilgrids", mode="snapshot", product="SoilGrids 2.0", observed_start=None, observed_end=None, retrieved_at=None, grid_resolution_km=0.25, spatial_support="grid", fixture_id=None, used_for=())
RAW = {"phh2o": (70, 75, 80, 10), "soc": (10, 20, 30, 10), "nitrogen": (50, 100, 150, 100), "sand": (400, 400, 400, 10), "silt": (350, 350, 350, 10), "clay": (250, 250, 250, 10)}


def profile(missing=None):
    layers = []
    for property_name, (a, b, c, factor) in RAW.items():
        for (start, end), value in zip(((0, 5), (5, 15), (15, 30)), (a, b, c), strict=True):
            if (property_name, start, end) != missing:
                layers.append(SoilLayer(property=property_name, depth_top_cm=start, depth_bottom_cm=end, mean_raw=value, q05_raw=None, q95_raw=None, conversion_factor=factor))
    return SoilProfile(location=LOCATION, layers=tuple(layers), source=SOURCE)


def test_converts_all_units_and_weights_complete_layers():
    result = build_soil_result(profile(), None)
    assert result.soil.ph == pytest.approx((5 * 7 + 10 * 7.5 + 15 * 8) / 30)
    assert result.soil.soc_g_kg == pytest.approx((5 + 20 + 45) / 30)
    assert result.soil.total_n_g_kg == pytest.approx((5 * .5 + 10 * 1 + 15 * 1.5) / 30)
    assert (result.soil.sand_pct, result.soil.silt_pct, result.soil.clay_pct) == (40, 35, 25)
    assert result.soil.field_sources.total_n_g_kg == "soilgrids"


def test_missing_layer_is_null_and_farmer_overrides_only_supplied_field():
    override = SoilOverride(sampled_on=date(2025, 10, 1), depth_top_cm=0, depth_bottom_cm=30, ph=6.5)
    result = build_soil_result(profile(("soc", 5, 15)), override)
    assert result.soil.ph == 6.5 and result.soil.field_sources.ph == "farmer_input"
    assert result.soil.soc_g_kg is None and result.soil.field_sources.soc_g_kg == "unavailable"
    assert result.soil.total_n_g_kg is not None


def test_unavailable_and_texture_warning():
    assert build_soil_result(None, None).soil.ph is None
    changed = profile().model_copy(update={"layers": tuple(
        layer.model_copy(update={"mean_raw": 300.0}) if layer.property == "sand" else layer
        for layer in profile().layers
    )})
    assert any(w.code == "SOIL_TEXTURE_INCONSISTENT" for w in build_soil_result(changed, None).warnings)
