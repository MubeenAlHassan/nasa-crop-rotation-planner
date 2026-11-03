"""Frozen internal records and injected provider interfaces.

These types represent normalized, attributed inputs. Raw ``fixture-1`` archive
objects are validated by their Phase 0 producers before adapter conversion.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Annotated, Any, Literal, Protocol

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, JsonValue, model_validator

from app.schemas.contracts import (
    Climate, Components, Exclusion, IsoDate, Integer, Location, Message,
    Moisture, Number, Recommendation, SlotScenario, Soil, Source, UtcDateTime,
    Weights,
)

ProviderLiteral = Literal["power", "soilgrids", "smap"]
SoilProperty = Literal["phh2o", "soc", "nitrogen", "sand", "silt", "clay"]
SOIL_DIVISORS = {"phh2o": 10, "soc": 10, "nitrogen": 100, "sand": 10, "silt": 10, "clay": 10}
DEPTH_PAIRS = {(0, 5), (5, 15), (15, 30)}
PROPERTY_ORDER = {name: index for index, name in enumerate(SOIL_DIVISORS)}
DEPTH_ORDER = {(0, 5): 0, (5, 15): 1, (15, 30): 2}


def _finite_decimal(value: Any) -> Decimal:
    if isinstance(value, bool) or not isinstance(value, (Decimal, int, float)):
        raise ValueError("Expected a decimal score")
    try:
        result = Decimal(str(value))
    except Exception as exc:
        raise ValueError("Invalid decimal score") from exc
    if not result.is_finite() or result < 0 or result > 100:
        raise ValueError("Score must be finite and between 0 and 100")
    return result


FiniteScore = Annotated[Decimal, BeforeValidator(_finite_decimal)]


class DomainModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, allow_inf_nan=False, validate_default=True)


class PowerDaily(DomainModel):
    day: IsoDate
    rainfall_mm: Number | None = Field(ge=0)
    temperature_c: Number | None


class PowerSeries(DomainModel):
    location: Location
    rows: tuple[PowerDaily, ...]
    source: Source

    @model_validator(mode="after")
    def check_rows(self) -> PowerSeries:
        days = [row.day for row in self.rows]
        if days != sorted(set(days)):
            raise ValueError("POWER days must be sorted and unique")
        if self.source.provider != "power":
            raise ValueError("POWER series requires a power source")
        if self.source.mode == "unavailable":
            raise ValueError("A POWER series cannot have an unavailable source")
        return self


class SoilLayer(DomainModel):
    property: SoilProperty
    depth_top_cm: Integer
    depth_bottom_cm: Integer
    mean_raw: Number | None
    q05_raw: Number | None
    q95_raw: Number | None
    conversion_factor: Number = Field(gt=0)

    @model_validator(mode="after")
    def check_layer(self) -> SoilLayer:
        if (self.depth_top_cm, self.depth_bottom_cm) not in DEPTH_PAIRS:
            raise ValueError("Unsupported topsoil depth")
        if self.conversion_factor != SOIL_DIVISORS[self.property]:
            raise ValueError("Conversion factor disagrees with verified raw units")
        return self


class SoilProfile(DomainModel):
    location: Location
    layers: tuple[SoilLayer, ...]
    source: Source

    @model_validator(mode="after")
    def check_layers(self) -> SoilProfile:
        pairs = [
            (PROPERTY_ORDER[layer.property], DEPTH_ORDER[(layer.depth_top_cm, layer.depth_bottom_cm)])
            for layer in self.layers
        ]
        if pairs != sorted(set(pairs)):
            raise ValueError("Soil layers must be sorted and unique")
        if self.source.provider != "soilgrids":
            raise ValueError("Soil profile requires a soilgrids source")
        if self.source.mode == "unavailable":
            raise ValueError("A soil profile cannot have an unavailable source")
        return self


class SmapObservation(DomainModel):
    day: IsoDate
    surface_m3_m3: Number | None = Field(ge=0, le=1)
    retrieval_quality_flag: Integer = Field(ge=0)
    pass_id: Literal["AM"]


class SmapSeries(DomainModel):
    location: Location
    cell_id: str = Field(min_length=1)
    rows: tuple[SmapObservation, ...]
    reference_rows: tuple[SmapObservation, ...]
    source: Source

    @model_validator(mode="after")
    def check_rows(self) -> SmapSeries:
        for series in (self.rows, self.reference_rows):
            days = [row.day for row in series]
            if days != sorted(set(days)):
                raise ValueError("SMAP days must be sorted and unique")
        if self.rows and any(row.day.year >= self.rows[0].day.year for row in self.reference_rows):
            raise ValueError("SMAP reference rows must precede assessment year")
        if self.source.provider != "smap":
            raise ValueError("SMAP series requires a smap source")
        if self.source.mode == "unavailable":
            raise ValueError("A SMAP series cannot have an unavailable source")
        return self


def _check_json(value: JsonValue) -> None:
    if isinstance(value, float) and not math.isfinite(value):
        raise ValueError("HTTP JSON numbers must be finite")
    if isinstance(value, dict):
        if any(not isinstance(key, str) for key in value):
            raise ValueError("HTTP JSON object keys must be strings")
        for child in value.values():
            _check_json(child)
    elif isinstance(value, list):
        for child in value:
            _check_json(child)


class HttpPayload(DomainModel):
    body: dict[str, JsonValue]
    mode: Literal["live", "cache", "stale_cache"]
    retrieved_at: UtcDateTime

    @model_validator(mode="after")
    def check_body(self) -> HttpPayload:
        _check_json(self.body)
        return self


class FetchedInputs(DomainModel):
    observations: PowerSeries
    baseline: PowerSeries
    soil: SoilProfile | None
    smap: SmapSeries | None
    sources: tuple[Source, ...]

    @model_validator(mode="after")
    def check_inputs(self) -> FetchedInputs:
        if {source.provider for source in self.sources} != {"power", "soilgrids", "smap", "farmer_input"} or len(self.sources) != 4:
            raise ValueError("Fetched inputs require exactly four source entries")
        if self.observations.location != self.baseline.location:
            raise ValueError("POWER observations and baseline are for different points")
        if self.soil is not None and self.soil.location != self.observations.location:
            raise ValueError("Soil profile is for a different point")
        if self.smap is not None and self.smap.location != self.observations.location:
            raise ValueError("SMAP series is for a different point")
        return self


class ClimateResult(DomainModel):
    climate: Climate
    slot_scenarios: tuple[SlotScenario, ...]
    warnings: tuple[Message, ...]


class SoilResult(DomainModel):
    soil: Soil
    warnings: tuple[Message, ...]


class MoistureResult(DomainModel):
    moisture: Moisture
    warnings: tuple[Message, ...]


class ScoredRotation(DomainModel):
    crop_ids: tuple[str, ...] = Field(min_length=1, max_length=4)
    components: Components
    effective_weights: Weights
    unrounded_score: FiniteScore
    reasons: tuple[Message, ...]
    warnings: tuple[Message, ...]


class RankingResult(DomainModel):
    recommendations: tuple[Recommendation, ...]
    feasible_rotation_count: Integer = Field(ge=0)
    exclusions: tuple[Exclusion, ...]
    warnings: tuple[Message, ...]

    @model_validator(mode="after")
    def check_count(self) -> RankingResult:
        if len(self.recommendations) > self.feasible_rotation_count:
            raise ValueError("Returned recommendations exceed feasible count")
        return self


class ProviderError(Exception):
    def __init__(self, provider: ProviderLiteral, message: str, retryable: bool) -> None:
        if provider not in ("power", "soilgrids", "smap"):
            raise ValueError("Unknown provider")
        self.provider = provider
        self.message = message
        self.retryable = retryable
        super().__init__(message)


class RequiredDataUnavailable(Exception):
    def __init__(self, message: str, retryable: bool) -> None:
        self.message = message
        self.retryable = retryable
        super().__init__(message)


class FixtureMismatch(Exception):
    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


class JsonFetcher(Protocol):
    async def fetch_json(
        self, *, provider: Literal["power", "soilgrids"], url: str,
        params: tuple[tuple[str, str], ...], deadline: float,
    ) -> HttpPayload: ...


class PowerProvider(Protocol):
    async def get_daily(
        self, location: Location, start: date, end: date, *, deadline: float,
    ) -> PowerSeries: ...


class SoilProvider(Protocol):
    async def get_topsoil(self, location: Location, *, deadline: float) -> SoilProfile: ...


class SmapProvider(Protocol):
    async def get_surface(
        self, location: Location, assessment_end: date, *, deadline: float,
    ) -> SmapSeries | None: ...


@dataclass(frozen=True)
class ProviderBundle:
    power: PowerProvider
    soil: SoilProvider
    smap: SmapProvider
