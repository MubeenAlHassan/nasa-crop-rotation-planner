from datetime import date, timedelta

import pytest
from app.features.moisture import build_moisture_result
from app.schemas.contracts import Location, Source
from app.schemas.domain import SmapObservation, SmapSeries

END = date(2025, 10, 15)
LOCATION = Location(latitude=31.4504, longitude=73.135)
SOURCE = Source(provider="smap", mode="snapshot", product="SPL3SMP_E V6", observed_start=None, observed_end=None, retrieved_at=None, grid_resolution_km=9, spatial_support="cell", fixture_id=None, used_for=())


def row(day, value=.2, flag=0):
    return SmapObservation(day=day, surface_m3_m3=value, retrieval_quality_flag=flag, pass_id="AM")


def series(rows, references=()):
    return SmapSeries(location=LOCATION, cell_id="cell", rows=tuple(sorted(rows, key=lambda x: x.day)), reference_rows=tuple(sorted(references, key=lambda x: x.day)), source=SOURCE)


def test_unavailable_and_recent_quality_cutoffs():
    assert build_moisture_result(None, END).moisture.surface_m3_m3 is None
    rows = [row(END - timedelta(days=offset), value=.1 * (index + 1), flag=flag) for index, (offset, flag) in enumerate(((0, 0), (2, 8), (4, 1), (6, 0)))]
    result = build_moisture_result(series(rows), END)
    assert result.moisture.accepted_overpasses == 3
    assert result.moisture.surface_m3_m3 == pytest.approx((.1 + .2 + .4) / 3)
    assert result.moisture.percentile is None
    assert any(w.code == "SMAP_PERCENTILE_UNAVAILABLE" for w in result.warnings)
    old = [row(END - timedelta(days=n)) for n in (8, 9, 10)]
    assert build_moisture_result(series(old), END).moisture.surface_m3_m3 is None


def test_reference_count_years_and_percentile():
    recent = [row(END - timedelta(days=n), .2) for n in (0, 2, 4)]
    reference = [row(date(year, 10, day), .1 if day <= 4 else .3)
                 for year in range(2019, 2025) for day in range(1, 6)]
    result = build_moisture_result(series(recent, reference), END)
    assert result.moisture.percentile == pytest.approx(80)
    assert build_moisture_result(series(recent, reference[:29]), END).moisture.percentile is None
    assert build_moisture_result(series(recent, reference[:20]), END).moisture.percentile is None
    four_years = [row(date(year, 10, day), .1) for year in range(2019, 2023) for day in range(1, 9)]
    assert len(four_years) >= 30
    assert build_moisture_result(series(recent, four_years), END).moisture.percentile is None
