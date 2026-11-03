"""Provider and scoring records remain immutable, ordered and attributed."""

import inspect
import json
import re
import sys
from dataclasses import FrozenInstanceError
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.schemas.contracts import Location, Source  # noqa: E402
from app.schemas.domain import (  # noqa: E402
    ClimateResult, FetchedInputs, FixtureMismatch, HttpPayload, JsonFetcher,
    MoistureResult, PowerDaily, PowerProvider, PowerSeries, ProviderBundle,
    ProviderError, RankingResult, RequiredDataUnavailable, ScoredRotation,
    SmapObservation, SmapProvider, SmapSeries, SoilLayer, SoilProfile,
    SoilProvider, SoilResult,
)

ROOT = Path(__file__).resolve().parents[2]


def example_response():
    blocks = re.findall(r"```json\n(.*?)\n```", (ROOT / "agent_docs/DATA_SCHEMA.md").read_text(), re.S)
    return json.loads(blocks[1])


def source(provider):
    example = example_response()
    return Source.model_validate(next(item for item in example["sources"] if item["provider"] == provider))


def location():
    return Location(latitude=31.4504, longitude=73.135)


def daily(day="2025-10-15", rainfall=0.0, temperature=25.0):
    return PowerDaily(day=day, rainfall_mm=rainfall, temperature_c=temperature)


def test_exact_exports_are_frozen():
    row = daily()
    with pytest.raises(ValidationError):
        row.rainfall_mm = 2.0
    with pytest.raises(ValidationError):
        PowerDaily(day="2025-10-15", rainfall_mm=1, temperature_c=20, made_up=1)
    bundle = ProviderBundle(power=object(), soil=object(), smap=object())
    with pytest.raises(FrozenInstanceError):
        bundle.power = object()


@pytest.mark.parametrize("value", ["1.5", True, float("nan"), float("inf"), -1])
def test_power_numeric_bounds(value):
    with pytest.raises(ValidationError):
        daily(rainfall=value)


def test_power_days_must_be_sorted_unique_and_attributed():
    row1 = daily("2025-10-14")
    row2 = daily("2025-10-15")
    series = PowerSeries(location=location(), rows=(row1, row2), source=source("power"))
    assert len(series.rows) == 2
    with pytest.raises(ValidationError):
        PowerSeries(location=location(), rows=(row2, row1), source=source("power"))
    with pytest.raises(ValidationError):
        PowerSeries(location=location(), rows=(row1, row1), source=source("power"))
    with pytest.raises(ValidationError):
        PowerSeries(location=location(), rows=(), source=source("soilgrids"))


@pytest.mark.parametrize("property,divisor", [
    ("phh2o", 10), ("soc", 10), ("nitrogen", 100),
    ("sand", 10), ("silt", 10), ("clay", 10),
])
def test_raw_soil_unit_divisors(property, divisor):
    layer = SoilLayer(property=property, depth_top_cm=0, depth_bottom_cm=5,
                      mean_raw=None, q05_raw=None, q95_raw=None, conversion_factor=divisor)
    assert layer.conversion_factor == divisor
    with pytest.raises(ValidationError):
        SoilLayer(property=property, depth_top_cm=0, depth_bottom_cm=5,
                  mean_raw=10, q05_raw=5, q95_raw=15, conversion_factor=1)


def test_soil_layers_require_canonical_depths_and_unique_order():
    first = SoilLayer(property="phh2o", depth_top_cm=0, depth_bottom_cm=5,
                      mean_raw=72, q05_raw=60, q95_raw=80, conversion_factor=10)
    second = SoilLayer(property="phh2o", depth_top_cm=5, depth_bottom_cm=15,
                       mean_raw=72, q05_raw=60, q95_raw=80, conversion_factor=10)
    profile = SoilProfile(location=location(), layers=(first, second), source=source("soilgrids"))
    assert profile.layers[0].mean_raw == 72
    for layers in ((second, first), (first, first)):
        with pytest.raises(ValidationError):
            SoilProfile(location=location(), layers=layers, source=source("soilgrids"))
    with pytest.raises(ValidationError):
        SoilLayer(property="phh2o", depth_top_cm=0, depth_bottom_cm=30,
                  mean_raw=72, q05_raw=60, q95_raw=80, conversion_factor=10)


def test_smap_quality_pass_bounds_and_reference_year():
    smap_source = source("smap").model_copy(update={
        "mode": "fixture", "product": "SPL3SMP_E", "fixture_id": "synthetic-test",
        "retrieved_at": None,
    })
    row = SmapObservation(day="2025-10-15", surface_m3_m3=0.25,
                          retrieval_quality_flag=8, pass_id="AM")
    ref = SmapObservation(day="2024-10-15", surface_m3_m3=None,
                          retrieval_quality_flag=1, pass_id="AM")
    series = SmapSeries(location=location(), cell_id="cell-1", rows=(row,),
                        reference_rows=(ref,), source=smap_source)
    assert series.reference_rows[0].surface_m3_m3 is None
    with pytest.raises(ValidationError):
        SmapObservation(day="2025-10-15", surface_m3_m3=1.1,
                        retrieval_quality_flag=0, pass_id="AM")
    with pytest.raises(ValidationError):
        SmapObservation(day="2025-10-15", surface_m3_m3=0.1,
                        retrieval_quality_flag=0, pass_id="PM")
    with pytest.raises(ValidationError):
        SmapSeries(location=location(), cell_id="cell-1", rows=(row,),
                   reference_rows=(row,), source=smap_source)


def test_http_payload_utc_json_and_mode():
    payload = HttpPayload(body={"nested": {"x": [1, None, "ok"]}},
                          mode="cache", retrieved_at="2026-09-26T09:00:00Z")
    assert payload.retrieved_at.utcoffset().total_seconds() == 0
    for bad_time in ("2026-09-26T09:00:00+05:00", "2026-09-26T09:00:00"):
        with pytest.raises(ValidationError):
            HttpPayload(body={}, mode="live", retrieved_at=bad_time)
    with pytest.raises(ValidationError):
        HttpPayload(body={"x": float("nan")}, mode="live",
                    retrieved_at="2026-09-26T09:00:00Z")


def test_fetched_inputs_point_and_source_set():
    power = PowerSeries(location=location(), rows=(daily(),), source=source("power"))
    sources = tuple(source(name) for name in ("power", "soilgrids", "smap", "farmer_input"))
    inputs = FetchedInputs(observations=power, baseline=power, soil=None, smap=None,
                            sources=sources)
    assert inputs.soil is None and inputs.smap is None
    with pytest.raises(ValidationError):
        FetchedInputs(observations=power, baseline=power, soil=None, smap=None,
                      sources=sources[:3] + (sources[0],))


def test_feature_and_ranking_records_use_wire_models():
    example = example_response()
    assert ClimateResult(climate=example["features"]["climate"],
                         slot_scenarios=example["features"]["slot_scenarios"],
                         warnings=example["warnings"]).climate.baseline_start_year == 1991
    assert SoilResult(soil=example["features"]["soil"], warnings=()).soil.depth_bottom_cm == 30
    assert MoistureResult(moisture=example["features"]["moisture"],
                          warnings=()).moisture.surface_m3_m3 is None
    rec = example["recommendations"][0]
    scored = ScoredRotation(crop_ids=("chickpea",), components=rec["components"],
                            effective_weights=rec["effective_weights"],
                            unrounded_score=Decimal("81.333"), reasons=rec["reasons"], warnings=())
    assert scored.unrounded_score == Decimal("81.333")
    ranked = RankingResult(recommendations=(rec,), feasible_rotation_count=1,
                           exclusions=(), warnings=())
    assert ranked.recommendations[0].rank == 1
    with pytest.raises(ValidationError):
        ScoredRotation(crop_ids=("chickpea",), components=rec["components"],
                       effective_weights=rec["effective_weights"],
                       unrounded_score="NaN", reasons=rec["reasons"], warnings=())


def test_exception_attributes_and_protocol_signatures():
    error = ProviderError("power", "outage", True)
    assert (error.provider, error.message, error.retryable) == ("power", "outage", True)
    unavailable = RequiredDataUnavailable("no baseline", False)
    assert (unavailable.message, unavailable.retryable) == ("no baseline", False)
    assert FixtureMismatch("point mismatch").message == "point mismatch"
    assert inspect.iscoroutinefunction(JsonFetcher.fetch_json)
    assert inspect.iscoroutinefunction(PowerProvider.get_daily)
    assert inspect.iscoroutinefunction(SoilProvider.get_topsoil)
    assert inspect.iscoroutinefunction(SmapProvider.get_surface)
    assert "deadline" in inspect.signature(SmapProvider.get_surface).parameters
    assert date.fromisoformat("2025-10-15") == daily().day
