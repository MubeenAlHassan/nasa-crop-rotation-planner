"""NASA POWER daily point adapter with strict units and fill handling."""

from __future__ import annotations

import asyncio
import math
from datetime import date, timedelta

from app.schemas.contracts import Location, Source
from app.schemas.domain import JsonFetcher, PowerDaily, PowerProvider, PowerSeries, ProviderError

_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
_MAX_SPAN_DAYS = 366
_MAX_CONCURRENT_CHUNKS = 5


class NasaPowerProvider(PowerProvider):
    def __init__(self, fetcher: JsonFetcher) -> None:
        self._fetcher = fetcher

    async def get_daily(
        self, location: Location, start: date, end: date, *, deadline: float,
    ) -> PowerSeries:
        if end < start or start < date(1991, 1, 1):
            raise ProviderError("power", "Unsupported POWER date interval", False)
        span = (end - start).days + 1
        if span <= _MAX_SPAN_DAYS:
            return await self._fetch_range(location, start, end, deadline=deadline)

        # Climatology baselines are captured as complete-year chunks (Phase 0 pattern).
        chunks: list[tuple[date, date]] = []
        year = start.year
        while year <= end.year:
            chunk_start = max(start, date(year, 1, 1))
            chunk_end = min(end, date(year, 12, 31))
            if (chunk_end - chunk_start).days + 1 > _MAX_SPAN_DAYS:
                raise ProviderError("power", "Unsupported POWER date interval", False)
            chunks.append((chunk_start, chunk_end))
            year += 1

        semaphore = asyncio.Semaphore(_MAX_CONCURRENT_CHUNKS)

        async def fetch_chunk(chunk_start: date, chunk_end: date) -> PowerSeries:
            async with semaphore:
                return await self._fetch_range(location, chunk_start, chunk_end, deadline=deadline)

        parts = await asyncio.gather(*[fetch_chunk(a, b) for a, b in chunks])
        rows: list[PowerDaily] = []
        modes: set[str] = set()
        for part in parts:
            rows.extend(part.rows)
            modes.add(part.source.mode)
        rows.sort(key=lambda row: row.day)
        if modes == {"cache"}:
            mode = "cache"
        elif "stale_cache" in modes:
            mode = "stale_cache"
        elif "live" in modes:
            mode = "live"
        else:
            mode = parts[0].source.mode
        source = parts[0].source.model_copy(update={
            "mode": mode,
            "observed_start": start,
            "observed_end": end,
            "used_for": ("/features/climate", "/features/slot_scenarios"),
        })
        return PowerSeries(location=location, rows=tuple(rows), source=source)

    async def _fetch_range(
        self, location: Location, start: date, end: date, *, deadline: float,
    ) -> PowerSeries:
        params = (
            ("parameters", "PRECTOTCORR,T2M"), ("community", "AG"),
            ("format", "JSON"), ("time-standard", "UTC"),
            ("latitude", str(location.latitude)), ("longitude", str(location.longitude)),
            ("start", start.strftime("%Y%m%d")), ("end", end.strftime("%Y%m%d")),
        )
        payload = await self._fetcher.fetch_json(
            provider="power", url=_URL, params=params, deadline=deadline,
        )
        try:
            body = payload.body
            header, parameters = body["header"], body["parameters"]
            if (header["time_standard"] != "UTC"
                or header["start"] != start.strftime("%Y%m%d")
                or header["end"] != end.strftime("%Y%m%d")
                or parameters["PRECTOTCORR"]["units"] != "mm/day"
                or parameters["T2M"]["units"] != "C"):
                raise ValueError("POWER metadata mismatch")
            fill = header["fill_value"]
            if isinstance(fill, bool) or not isinstance(fill, (int, float)) or not math.isfinite(fill):
                raise ValueError("Invalid POWER fill value")
            data = body["properties"]["parameter"]
            rain, temp = data["PRECTOTCORR"], data["T2M"]
            if not isinstance(rain, dict) or not isinstance(temp, dict):
                raise ValueError("Invalid POWER parameter maps")
            coordinates = body["geometry"]["coordinates"]
            lon, lat = coordinates[:2]
            if any(isinstance(x, bool) or not isinstance(x, (int, float)) or not math.isfinite(x)
                   for x in (lon, lat)) or not (-180 <= lon <= 180 and -90 <= lat <= 90):
                raise ValueError("Invalid POWER native point")
            if abs(lon - location.longitude) > 1 or abs(lat - location.latitude) > 1:
                raise ValueError("POWER native point does not match requested location")
            rows = []
            for offset in range((end - start).days + 1):
                day = start + timedelta(days=offset)
                key = day.strftime("%Y%m%d")
                values = []
                for raw in (rain.get(key, fill), temp.get(key, fill)):
                    if isinstance(raw, bool) or not isinstance(raw, (int, float)) or not math.isfinite(raw):
                        raise ValueError("Invalid POWER daily value")
                    values.append(None if raw == fill else float(raw))
                if values[0] is not None and values[0] < 0:
                    raise ValueError("Negative rainfall")
                rows.append(PowerDaily(day=day, rainfall_mm=values[0], temperature_c=values[1]))
            source = Source(
                provider="power", mode=payload.mode, product="POWER daily AG UTC",
                observed_start=start, observed_end=end, retrieved_at=payload.retrieved_at,
                grid_resolution_km=None, spatial_support=f"Provider native point sample ({lat}, {lon})",
                fixture_id=None, used_for=("/features/climate", "/features/slot_scenarios"),
            )
            return PowerSeries(location=location, rows=tuple(rows), source=source)
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise ProviderError("power", "Invalid NASA POWER response", False) from exc
