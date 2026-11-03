import asyncio
import json
from datetime import UTC, date, datetime
from pathlib import Path

import pytest
from app.providers.power import NasaPowerProvider
from app.schemas.contracts import Location
from app.schemas.domain import HttpPayload, ProviderError

ARCHIVE = Path(__file__).parent / "fixtures" / "power_archive.json"
LOCATION = Location(latitude=31.4504, longitude=73.135)


class Fetcher:
    def __init__(self, body):
        self.body = body
        self.calls = []

    async def fetch_json(self, **kwargs):
        self.calls.append(kwargs)
        return HttpPayload(body=self.body, mode="cache", retrieved_at=datetime(2026, 9, 26, tzinfo=UTC))


def get(fetcher):
    return asyncio.run(NasaPowerProvider(fetcher).get_daily(LOCATION, date(2025, 7, 18), date(2025, 10, 15), deadline=99.0))


def test_fixture_replay_exact_query_and_daily_conversion():
    request = json.loads(ARCHIVE.read_text())["requests"][0]
    fetcher = Fetcher(request["payload"])
    result = get(fetcher)
    assert fetcher.calls[0]["url"] == request["url"]
    assert fetcher.calls[0]["params"] == tuple(map(tuple, request["params"]))
    assert fetcher.calls[0]["deadline"] == 99.0
    assert len(result.rows) == 90 and result.rows[0].rainfall_mm == 2.98
    assert result.rows[-1].day == date(2025, 10, 15)
    assert result.source.mode == "cache" and "31.45" in result.source.spatial_support


def test_fill_values_and_malformed_units():
    body = json.loads(ARCHIVE.read_text())["requests"][0]["payload"]
    body["properties"]["parameter"]["T2M"]["20250718"] = -999
    assert get(Fetcher(body)).rows[0].temperature_c is None
    body["parameters"]["PRECTOTCORR"]["units"] = "inches"
    with pytest.raises(ProviderError, match="Invalid NASA POWER response"):
        get(Fetcher(body))


def test_rejects_nonfinite_value():
    body = json.loads(ARCHIVE.read_text())["requests"][0]["payload"]
    body["properties"]["parameter"]["T2M"]["20250718"] = float("nan")
    with pytest.raises((ProviderError, ValueError)):
        get(Fetcher(body))


def test_rejects_wrong_native_point():
    body = json.loads(ARCHIVE.read_text())["requests"][0]["payload"]
    body["geometry"]["coordinates"][:2] = [0, 0]
    with pytest.raises(ProviderError, match="Invalid NASA POWER response"):
        get(Fetcher(body))


def test_multi_year_baseline_chunks_complete_years():
    body = json.loads(ARCHIVE.read_text())["requests"][0]["payload"]

    class YearFetcher:
        def __init__(self):
            self.calls = []

        async def fetch_json(self, **kwargs):
            self.calls.append(kwargs)
            start = dict(kwargs["params"])["start"]
            end = dict(kwargs["params"])["end"]
            payload = json.loads(json.dumps(body))
            payload["header"]["start"] = start
            payload["header"]["end"] = end
            # Minimal daily maps for the requested year chunk.
            rain, temp = {}, {}
            day = date(int(start[:4]), int(start[4:6]), int(start[6:8]))
            last = date(int(end[:4]), int(end[4:6]), int(end[6:8]))
            while day <= last:
                key = day.strftime("%Y%m%d")
                rain[key] = 1.0
                temp[key] = 20.0
                day = date.fromordinal(day.toordinal() + 1)
            payload["properties"]["parameter"]["PRECTOTCORR"] = rain
            payload["properties"]["parameter"]["T2M"] = temp
            return HttpPayload(body=payload, mode="cache", retrieved_at=datetime(2026, 9, 26, tzinfo=UTC))

    fetcher = YearFetcher()
    series = asyncio.run(
        NasaPowerProvider(fetcher).get_daily(LOCATION, date(1991, 1, 1), date(1992, 12, 31), deadline=99.0)
    )
    assert len(fetcher.calls) == 2
    assert series.source.observed_start == date(1991, 1, 1)
    assert series.source.observed_end == date(1992, 12, 31)
    assert len(series.rows) == 365 + 366
