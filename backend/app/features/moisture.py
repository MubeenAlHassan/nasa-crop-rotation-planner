"""Conservative AM-pass SMAP context with optional local-season percentile."""

from __future__ import annotations

from datetime import date, timedelta
from statistics import mean

from app.schemas.contracts import Message, Moisture
from app.schemas.domain import MoistureResult, SmapObservation, SmapSeries


def _valid(row: SmapObservation) -> bool:
    return row.pass_id == "AM" and row.retrieval_quality_flag in (0, 8) and row.surface_m3_m3 is not None


def _season_distance(day: date, assessment_end: date) -> int:
    try:
        anchor = day.replace(year=assessment_end.year)
    except ValueError:
        anchor = date(assessment_end.year, 2, 28)
    distances = [abs((anchor - assessment_end).days)]
    for shift in (-1, 1):
        try:
            other = day.replace(year=assessment_end.year + shift)
        except ValueError:
            continue
        distances.append(abs((other - assessment_end).days))
    return min(distances)


def build_moisture_result(series: SmapSeries | None, assessment_end: date) -> MoistureResult:
    if series is None:
        return MoistureResult(
            moisture=Moisture(surface_m3_m3=None, percentile=None, accepted_overpasses=0, latest_observation=None, depth_cm=5),
            warnings=(Message(code="SMAP_UNAVAILABLE", message="Verified SMAP surface moisture is unavailable."),),
        )
    recent = tuple(row for row in series.rows
                   if assessment_end - timedelta(days=13) <= row.day <= assessment_end and _valid(row))
    latest = recent[-1].day if recent else None
    surface = (mean(row.surface_m3_m3 for row in recent) if len(recent) >= 3
               and latest is not None and (assessment_end - latest).days <= 7 else None)
    warnings = []
    if surface is None:
        warnings.append(Message(code="SMAP_UNAVAILABLE", message="Recent quality-approved SMAP coverage is insufficient."))
    reference = tuple(row for row in series.reference_rows
                      if row.day.year < assessment_end.year and _valid(row)
                      and _season_distance(row.day, assessment_end) <= 15)
    percentile = None
    if surface is not None and len(reference) >= 30 and len({row.day.year for row in reference}) >= 5:
        percentile = 100 * sum(row.surface_m3_m3 <= surface for row in reference) / len(reference)
    elif surface is not None:
        warnings.append(Message(code="SMAP_PERCENTILE_UNAVAILABLE", message="The same-cell seasonal SMAP reference is insufficient for a percentile."))
    return MoistureResult(
        moisture=Moisture(surface_m3_m3=surface, percentile=percentile, accepted_overpasses=len(recent), latest_observation=latest, depth_cm=5),
        warnings=tuple(warnings),
    )
