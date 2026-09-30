import asyncio
from datetime import UTC, datetime

import pytest
from app.providers.soilgrids import IsricSoilProvider
from app.schemas.contracts import Location
from app.schemas.domain import SOIL_DIVISORS, HttpPayload, ProviderError

LOCATION = Location(latitude=31.4504, longitude=73.135)


class Fetcher:
    def __init__(self, body):
        self.body = body
        self.calls = []

    async def fetch_json(self, **kwargs):
        self.calls.append(kwargs)
        return HttpPayload(body=self.body, mode="cache", retrieved_at=datetime(2026, 9, 26, tzinfo=UTC))


def body():
    return {"properties": {"layers": [
        {"name": name, "unit_measure": {"d_factor": factor}, "depths": [
            {"label": label, "values": {"mean": 100 + index, "Q0.05": 80 + index, "Q0.95": 120 + index}}
            for index, label in enumerate(("15-30cm", "0-5cm", "5-15cm"))]}
        for name, factor in reversed(list(SOIL_DIVISORS.items()))]}}


def test_named_lookup_query_and_raw_quantiles():
    fetcher = Fetcher(body())
    result = asyncio.run(IsricSoilProvider(fetcher, True).get_topsoil(LOCATION, deadline=99.0))
    assert len(result.layers) == 18
    assert result.layers[0].property == "phh2o" and result.layers[0].depth_top_cm == 0
    assert result.layers[0].mean_raw == 101 and result.layers[0].q05_raw == 81
    assert result.layers[6].property == "nitrogen" and result.layers[6].conversion_factor == 100
    assert fetcher.calls[0]["url"].endswith("/soilgrids/v2.0/properties/query")
    assert fetcher.calls[0]["params"].count(("depth", "0-5cm")) == 1
    assert result.source.grid_resolution_km == .25
    assert "available nitrogen" not in result.source.product.lower()


def test_pause_and_bad_shape():
    fetcher = Fetcher(body())
    with pytest.raises(ProviderError, match="paused"):
        asyncio.run(IsricSoilProvider(fetcher, False).get_topsoil(LOCATION, deadline=99.0))
    assert fetcher.calls == []
    bad = body()
    bad["properties"]["layers"].pop()
    with pytest.raises(ProviderError, match="Invalid SoilGrids response"):
        asyncio.run(IsricSoilProvider(Fetcher(bad), True).get_topsoil(LOCATION, deadline=99.0))
