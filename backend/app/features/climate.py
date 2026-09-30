"""Matched-calendar historical anomalies and seasonal stress scenarios."""

from __future__ import annotations

from datetime import date, timedelta
from statistics import mean

from app.schemas.contracts import Climate, Message, Slot, SlotScenario
from app.schemas.domain import ClimateResult, PowerSeries


def _days(start: date, end: date) -> tuple[date, ...]:
    return tuple(
        day for offset in range((end - start).days + 1)
        if (day := start + timedelta(days=offset)).month != 2 or day.day != 29
    )


def _historical_day(day: date, end_year: int, target_end_year: int) -> date | None:
    year = target_end_year + day.year - end_year
    if not 1991 <= year <= 2020:
        return None
    try:
        return day.replace(year=year)
    except ValueError:
        return None


def _matched(
    days: tuple[date, ...], end_year: int, baseline: dict[date, float],
    observed: dict[date, float] | None,
) -> tuple[float | None, float | None, float, int]:
    """Return observed aggregate, mean yearly baseline aggregate, coverage, years."""
    if not days:
        return None, None, 0.0, 0
    accepted = tuple(day for day in days if observed is None or day in observed)
    observed_coverage = len(accepted) / len(days)
    if observed_coverage < 0.9:
        return None, None, observed_coverage, 0
    years: dict[int, dict[date, float]] = {}
    for year in range(1991, 2021):
        mapped = {_day: baseline[historic] for _day in accepted
                  if (historic := _historical_day(_day, end_year, year)) is not None
                  and historic in baseline}
        if len(mapped) / len(accepted) >= 0.9:
            years[year] = mapped
    if len(years) < 25:
        return None, None, observed_coverage, len(years)
    matched = set(accepted)
    for values in years.values():
        matched.intersection_update(values)
    coverage = len(matched) / len(days)
    if coverage < 0.9:
        return None, None, coverage, len(years)
    ordered = sorted(matched)
    current = sum(observed[day] for day in ordered) if observed is not None else None
    historical = mean(sum(values[day] for day in ordered) for values in years.values())
    return current, historical, coverage, len(years)


def _rain_band(value: float | None) -> str:
    if value is None:
        return "unknown"
    if value <= -40:
        return "severe_dry"
    if value <= -20:
        return "dry"
    if value < 20:
        return "normal"
    if value < 40:
        return "wet"
    return "severe_wet"


def _heat_band(value: float | None) -> str:
    if value is None:
        return "unknown"
    if value < 1:
        return "normal"
    if value < 2:
        return "elevated"
    return "high"


def calculate_climate_features(
    observations: PowerSeries, baseline: PowerSeries, assessment_end: date,
    slots: tuple[Slot, ...],
) -> ClimateResult:
    if observations.location != baseline.location:
        raise ValueError("POWER point mismatch")
    window_start = assessment_end - timedelta(days=89)
    window = _days(window_start, assessment_end)
    observed_rain = {row.day: row.rainfall_mm for row in observations.rows if row.rainfall_mm is not None}
    observed_temp = {row.day: row.temperature_c for row in observations.rows if row.temperature_c is not None}
    baseline_rain = {row.day: row.rainfall_mm for row in baseline.rows if row.rainfall_mm is not None}
    baseline_temp = {row.day: row.temperature_c for row in baseline.rows if row.temperature_c is not None}
    rain_current, rain_normal, rain_coverage, rain_years = _matched(window, assessment_end.year, baseline_rain, observed_rain)
    temp_sum, temp_normal_sum, temp_coverage, temp_years = _matched(window, assessment_end.year, baseline_temp, observed_temp)
    temp_count = round(temp_coverage * len(window)) if temp_sum is not None else 0
    temp_current = temp_sum / temp_count if temp_count else None
    temp_normal = temp_normal_sum / temp_count if temp_count else None
    rain_anomaly = (round(100 * (rain_current - rain_normal) / rain_normal, 10)
                    if rain_current is not None and rain_normal is not None and rain_normal >= 10 else None)
    temp_anomaly = temp_current - temp_normal if temp_current is not None and temp_normal is not None else None
    warnings: dict[str, Message] = {}
    if rain_current is None or temp_current is None:
        warnings["CLIMATE_COVERAGE_LOW"] = Message(code="CLIMATE_COVERAGE_LOW", message="Matched climate coverage is insufficient for one or more variables.")
    if rain_current is not None and rain_normal is not None and rain_normal < 10:
        warnings["BASELINE_TOO_DRY"] = Message(code="BASELINE_TOO_DRY", message="Matched baseline rainfall is below 10 mm; percent anomaly is omitted.")
    scenarios = []
    for slot in slots:
        slot_days = _days(slot.start_date, slot.end_date)
        _, seasonal_rain, rain_slot_coverage, seasonal_rain_years = _matched(slot_days, slot.end_date.year, baseline_rain, None)
        _, seasonal_temp_sum, temp_slot_coverage, seasonal_temp_years = _matched(slot_days, slot.end_date.year, baseline_temp, None)
        seasonal_temp = seasonal_temp_sum / round(temp_slot_coverage * len(slot_days)) if seasonal_temp_sum is not None else None
        if seasonal_rain is None or seasonal_temp is None:
            warnings["CLIMATE_COVERAGE_LOW"] = Message(code="CLIMATE_COVERAGE_LOW", message="Matched climate coverage is insufficient for one or more variables.")
        scenarios.append(SlotScenario(
            slot_id=slot.slot_id, kind="historical_stress_scenario",
            rainfall_mm=max(0.0, seasonal_rain * (1 + rain_anomaly / 100)) if seasonal_rain is not None and rain_anomaly is not None else seasonal_rain,
            temperature_c=seasonal_temp + temp_anomaly if seasonal_temp is not None and temp_anomaly is not None else seasonal_temp,
            rainfall_baseline_years=seasonal_rain_years,
            temperature_baseline_years=seasonal_temp_years,
            smap_adjustment_applied=False,
        ))
    climate = Climate(
        window_start=window_start, window_end=assessment_end,
        baseline_start_year=1991, baseline_end_year=2020,
        rainfall_observed_mm=rain_current, rainfall_baseline_mm=rain_normal,
        rainfall_anomaly_pct=rain_anomaly, rainfall_band=_rain_band(rain_anomaly),
        temperature_observed_c=temp_current, temperature_baseline_c=temp_normal,
        temperature_anomaly_c=temp_anomaly, heat_band=_heat_band(temp_anomaly),
        rainfall_coverage=rain_coverage, temperature_coverage=temp_coverage,
        rainfall_baseline_years=rain_years, temperature_baseline_years=temp_years,
    )
    return ClimateResult(climate=climate, slot_scenarios=tuple(scenarios), warnings=tuple(warnings.values()))
