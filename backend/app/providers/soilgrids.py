"""ISRIC SoilGrids point REST adapter, disabled when upstream REST is paused."""

from __future__ import annotations

from app.schemas.contracts import Location, Source
from app.schemas.domain import (
    SOIL_DIVISORS,
    JsonFetcher,
    ProviderError,
    SoilLayer,
    SoilProfile,
    SoilProvider,
)

_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"
_DEPTHS = (("0-5cm", 0, 5), ("5-15cm", 5, 15), ("15-30cm", 15, 30))


class IsricSoilProvider(SoilProvider):
    def __init__(self, fetcher: JsonFetcher, rest_enabled: bool) -> None:
        self._fetcher = fetcher
        self._rest_enabled = rest_enabled

    async def get_topsoil(self, location: Location, *, deadline: float) -> SoilProfile:
        if not self._rest_enabled:
            raise ProviderError("soilgrids", "SoilGrids REST is paused", False)
        params = (("lon", str(location.longitude)), ("lat", str(location.latitude)))
        params += tuple(("property", name) for name in SOIL_DIVISORS)
        params += tuple(("depth", label) for label, _, _ in _DEPTHS)
        params += (("value", "mean"), ("value", "Q0.05"), ("value", "Q0.95"))
        payload = await self._fetcher.fetch_json(provider="soilgrids", url=_URL, params=params, deadline=deadline)
        try:
            by_name = {}
            for layer in payload.body["properties"]["layers"]:
                name = layer["name"]
                if name in by_name:
                    raise ValueError("Duplicate SoilGrids property")
                by_name[name] = layer
            if set(by_name) != set(SOIL_DIVISORS):
                raise ValueError("Missing SoilGrids property")
            layers = []
            for name, expected_factor in SOIL_DIVISORS.items():
                layer = by_name[name]
                factor = layer["unit_measure"]["d_factor"]
                if factor != expected_factor:
                    raise ValueError("Unexpected SoilGrids raw units")
                depths = {}
                for depth in layer["depths"]:
                    label = depth["label"]
                    if label in depths:
                        raise ValueError("Duplicate SoilGrids depth")
                    depths[label] = depth
                if set(depths) != {label for label, _, _ in _DEPTHS}:
                    raise ValueError("Missing SoilGrids depth")
                for label, top, bottom in _DEPTHS:
                    values = depths[label]["values"]
                    layers.append(SoilLayer(
                        property=name, depth_top_cm=top, depth_bottom_cm=bottom,
                        mean_raw=values["mean"], q05_raw=values["Q0.05"],
                        q95_raw=values["Q0.95"], conversion_factor=factor,
                    ))
            source = Source(
                provider="soilgrids", mode=payload.mode, product="SoilGrids 2.0 modeled soil properties",
                observed_start=None, observed_end=None, retrieved_at=payload.retrieved_at,
                grid_resolution_km=0.25, spatial_support="Modeled 250 m point grid",
                fixture_id=None, used_for=("/features/soil",),
            )
            return SoilProfile(location=location, layers=tuple(layers), source=source)
        except (KeyError, TypeError, ValueError) as exc:
            raise ProviderError("soilgrids", "Invalid SoilGrids response", False) from exc
