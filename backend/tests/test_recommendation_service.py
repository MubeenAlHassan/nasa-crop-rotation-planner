import asyncio
from datetime import UTC, date, datetime, timedelta
from uuid import UUID

import pytest
from app.schemas.contracts import Location, RecommendationRequest, Source
from app.schemas.domain import (
    FixtureMismatch,
    PowerDaily,
    PowerSeries,
    ProviderBundle,
    ProviderError,
    RequiredDataUnavailable,
    SmapObservation,
    SmapSeries,
    SoilProfile,
)
from app.services.recommendation import build_recommendation_response

LOCATION = Location(latitude=31.4504, longitude=73.135)
SOURCE = Source(provider="power", mode="snapshot", product="POWER daily AG UTC", observed_start=None, observed_end=None, retrieved_at=None, grid_resolution_km=None, spatial_support="provider point", fixture_id=None, used_for=())


def records():
    end = date(2025, 10, 15)
    observed = tuple(PowerDaily(day=end - timedelta(days=n), rainfall_mm=1, temperature_c=25) for n in range(89, -1, -1))
    baseline = {}
    for year in range(1991, 2021):
        for row in observed:
            day = row.day.replace(year=year)
            baseline[day] = PowerDaily(day=day, rainfall_mm=1, temperature_c=24)
    slot_start, slot_end = date(2025, 10, 25), date(2026, 3, 31)
    for year in range(1992, 2021):
        for offset in range((slot_end - slot_start).days + 1):
            day = slot_start + timedelta(days=offset)
            if day.month == 2 and day.day == 29:
                continue
            old = day.replace(year=year + day.year - 2026)
            baseline[old] = PowerDaily(day=old, rainfall_mm=2, temperature_c=18)
    return (PowerSeries(location=LOCATION, rows=observed, source=SOURCE),
            PowerSeries(location=LOCATION, rows=tuple(sorted(baseline.values(), key=lambda row: row.day)), source=SOURCE))


class Power:
    def __init__(self, wrong_point=False, fail=False):
        self.observations, self.baseline = records()
        self.calls = []
        self.wrong_point = wrong_point
        self.fail = fail

    async def get_daily(self, location, start, end, *, deadline):
        self.calls.append((start, end, deadline))
        if self.fail:
            raise ProviderError("power", "offline", True)
        result = self.baseline if start.year == 1991 else self.observations
        return result.model_copy(update={"location": Location(latitude=30, longitude=70)}) if self.wrong_point else result


class Soil:
    async def get_topsoil(self, location, *, deadline):
        raise ProviderError("soilgrids", "REST paused", False)


class Smap:
    async def get_surface(self, location, assessment_end, *, deadline):
        return None


def request(allowed=()):
    return RecommendationRequest.model_validate({
        "location": LOCATION.model_dump(), "region_id": "punjab_pk_demo_v1",
        "assessment_end": "2025-10-15", "slots": [{"slot_id": "rabi", "start_date": "2025-10-25", "end_date": "2026-03-31"}],
        "crop_history": [{"crop_id": "maize", "start_date": "2025-05-01", "end_date": "2025-09-30", "residue_management": "retained"}],
        "irrigation": "rainfed", "allowed_crop_ids": allowed,
    }, context={"today_utc": date(2025, 10, 15)})


def build(req, power):
    return asyncio.run(build_recommendation_response(req, ProviderBundle(power=power, soil=Soil(), smap=Smap()), request_id=UUID(int=1), generated_at=datetime(2026, 9, 30, tzinfo=UTC)))


def test_degraded_success_and_bounded_calls():
    power = Power()
    result = build(request(), power)
    assert result.status == "degraded" and result.data_quality == "limited"
    assert result.feasible_rotation_count == 1
    assert result.recommendations[0].slots[0].crop_id == "chickpea"
    assert {source.provider for source in result.sources} == {"power", "soilgrids", "smap", "farmer_input"}
    assert {w.code for w in result.warnings} >= {"SOILGRIDS_UNAVAILABLE", "SMAP_UNAVAILABLE"}
    assert len(power.calls) == 2 and all(call[2] > 0 for call in power.calls)
    assert result.request_id == UUID(int=1)


def test_no_feasible_and_required_power_policy():
    result = build(request(("wheat",)), Power())
    assert result.status == "no_feasible_rotation" and result.recommendations == ()
    with pytest.raises(RequiredDataUnavailable) as error:
        build(request(), Power(fail=True))
    assert error.value.retryable is True
    with pytest.raises(RequiredDataUnavailable, match="point"):
        build(request(), Power(wrong_point=True))


def test_complete_envelope_with_qualified_optional_sources():
    history = [{"crop_id": "maize", "start_date": f"{year}-08-01", "end_date": f"{year}-08-31", "residue_management": "retained"} for year in range(2019, 2025)]
    body = request().model_dump(mode="json")
    body["crop_history"] = history
    body["soil_override"] = {"sampled_on": "2025-10-01", "depth_top_cm": 0, "depth_bottom_cm": 30, "ph": 7}
    req = RecommendationRequest.model_validate(body, context={"today_utc": date(2025, 10, 15)})
    soil_source = Source(provider="soilgrids", mode="snapshot", product="SoilGrids 2.0", observed_start=None, observed_end=None, retrieved_at=None, grid_resolution_km=.25, spatial_support="grid", fixture_id=None, used_for=())
    smap_source = Source(provider="smap", mode="snapshot", product="SPL3SMP_E V6", observed_start=None, observed_end=None, retrieved_at=None, grid_resolution_km=9, spatial_support="cell", fixture_id=None, used_for=())

    class AvailableSoil:
        async def get_topsoil(self, location, *, deadline):
            return SoilProfile(location=location, layers=(), source=soil_source)

    class AvailableSmap:
        async def get_surface(self, location, assessment_end, *, deadline):
            recent = tuple(SmapObservation(day=date(2025, 10, day), surface_m3_m3=.2, retrieval_quality_flag=0, pass_id="AM") for day in (11, 13, 15))
            reference = tuple(SmapObservation(day=date(year, 10, day), surface_m3_m3=.1, retrieval_quality_flag=8, pass_id="AM") for year in range(2019, 2025) for day in range(1, 6))
            return SmapSeries(location=location, cell_id="cell", rows=recent, reference_rows=reference, source=smap_source)

    response = asyncio.run(build_recommendation_response(req, ProviderBundle(power=Power(), soil=AvailableSoil(), smap=AvailableSmap()), request_id=UUID(int=2), generated_at=datetime(2026, 9, 30, tzinfo=UTC)))
    assert response.status == "ok" and response.data_quality == "complete"
    assert response.features.slot_scenarios[0].smap_adjustment_applied is True
    assert response.sources[3].used_for == ("/features/soil/ph",)


def test_rejects_mixed_fixture_sources_and_wrong_period():
    power = Power()
    wrong = power.observations.rows[0].model_copy(update={"day": date(2024, 7, 18)})
    power.observations = power.observations.model_copy(update={"rows": (wrong, *power.observations.rows[1:])})
    with pytest.raises(RequiredDataUnavailable, match="period"):
        build(request(), power)
    power = Power()
    power.baseline = power.baseline.model_copy(update={"source": SOURCE.model_copy(update={"mode": "fixture", "fixture_id": "farm"})})
    with pytest.raises(FixtureMismatch):
        build(request(), power)
