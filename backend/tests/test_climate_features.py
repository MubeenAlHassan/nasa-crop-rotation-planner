from datetime import date, timedelta

import pytest
from app.features.climate import _heat_band, _historical_day, _rain_band, calculate_climate_features
from app.schemas.contracts import Location, Slot, Source
from app.schemas.domain import PowerDaily, PowerSeries

LOCATION = Location(latitude=31.4504, longitude=73.135)
SOURCE = Source(provider="power", mode="snapshot", product="POWER", observed_start=None, observed_end=None, retrieved_at=None, grid_resolution_km=None, spatial_support=None, fixture_id=None, used_for=())


def series(rows):
    return PowerSeries(location=LOCATION, rows=tuple(sorted(rows, key=lambda row: row.day)), source=SOURCE)


def sample(*, observed_days=90, baseline_years=30, rain=0.6):
    end = date(2025, 10, 15)
    slot = Slot(slot_id="rabi", start_date=date(2025, 11, 1), end_date=date(2025, 11, 30))
    observed = [PowerDaily(day=end - timedelta(days=n), rainfall_mm=rain, temperature_c=25) for n in range(observed_days)]
    baseline = {}
    for year in range(1991, 1991 + baseline_years):
        for offset in range(90):
            day = (end - timedelta(days=offset)).replace(year=year)
            baseline[day] = PowerDaily(day=day, rainfall_mm=1, temperature_c=24)
        for offset in range(30):
            day = (slot.start_date + timedelta(days=offset)).replace(year=year)
            baseline[day] = PowerDaily(day=day, rainfall_mm=2, temperature_c=18)
    return series(observed), series(baseline.values()), end, (slot,)


def test_matched_anomaly_and_seasonal_scenario():
    result = calculate_climate_features(*sample())
    assert result.climate.rainfall_anomaly_pct == pytest.approx(-40)
    assert result.climate.rainfall_band == "severe_dry"
    assert result.climate.temperature_anomaly_c == pytest.approx(1)
    assert result.climate.heat_band == "elevated"
    assert result.slot_scenarios[0].rainfall_mm == pytest.approx(36)
    assert result.slot_scenarios[0].temperature_c == pytest.approx(19)
    assert result.climate.rainfall_baseline_years == 30


def test_coverage_and_year_boundaries():
    result = calculate_climate_features(*sample(observed_days=80))
    assert result.climate.rainfall_anomaly_pct is None
    assert result.climate.rainfall_coverage == pytest.approx(80 / 90)
    assert any(w.code == "CLIMATE_COVERAGE_LOW" for w in result.warnings)
    result = calculate_climate_features(*sample(baseline_years=24))
    assert result.climate.rainfall_baseline_years == 24
    assert result.climate.rainfall_anomaly_pct is None
    assert calculate_climate_features(*sample(baseline_years=25)).climate.rainfall_baseline_years == 25


def test_leap_cross_year_and_threshold_bands():
    assert _historical_day(date(2024, 2, 29), 2024, 2020) == date(2020, 2, 29)
    assert _historical_day(date(2024, 2, 29), 2024, 2019) is None
    assert _historical_day(date(2025, 12, 1), 2026, 1991) is None
    assert [_rain_band(x) for x in (-40, -20, 20, 40, None)] == ["severe_dry", "dry", "wet", "severe_wet", "unknown"]
    assert [_heat_band(x) for x in (0.99, 1, 2, None)] == ["normal", "elevated", "high", "unknown"]


def test_too_dry_baseline_has_null_percent_but_valid_total():
    observed, baseline, end, slots = sample()
    adjusted = series([row.model_copy(update={"rainfall_mm": 0.05}) for row in baseline.rows])
    result = calculate_climate_features(observed, adjusted, end, slots)
    assert result.climate.rainfall_observed_mm is not None
    assert result.climate.rainfall_anomaly_pct is None
    assert any(w.code == "BASELINE_TOO_DRY" for w in result.warnings)


def test_cross_year_leap_day_is_omitted_from_full_anomaly():
    end = date(2024, 3, 15)
    start = end - timedelta(days=89)
    observed = [PowerDaily(day=start + timedelta(days=n), rainfall_mm=1000 if (start + timedelta(days=n)) == date(2024, 2, 29) else 1, temperature_c=25) for n in range(90)]
    baseline = {}
    for year in range(1992, 2021):
        for row in observed:
            if row.day == date(2024, 2, 29):
                continue
            mapped = row.day.replace(year=year + row.day.year - 2024)
            baseline[mapped] = PowerDaily(day=mapped, rainfall_mm=1, temperature_c=24)
    for year in range(1991, 2021):
        for n in range(30):
            day = date(year, 11, 1) + timedelta(days=n)
            baseline[day] = PowerDaily(day=day, rainfall_mm=1, temperature_c=20)
    slot = Slot(slot_id="next", start_date=date(2024, 11, 1), end_date=date(2024, 11, 30))
    result = calculate_climate_features(series(observed), series(baseline.values()), end, (slot,))
    assert result.climate.rainfall_observed_mm == 89
    assert result.climate.rainfall_anomaly_pct == 0
    assert result.climate.rainfall_baseline_years == 29
