"""Version 1 public JSON contract for Field Shift.

Raw provider archives are deliberately absent from this module. They are
``fixture-1`` inputs to adapters, not public API responses.
"""

from __future__ import annotations

import math
import re
from datetime import UTC, date, datetime, timedelta
from typing import Annotated, Any, Literal, get_args
from uuid import UUID

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, JsonValue, StrictBool, ValidationInfo
from pydantic import field_validator, model_validator


def _number(value: Any) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError("Expected a JSON number")
    if not math.isfinite(value):
        raise ValueError("Number must be finite")
    return float(value)


def _integer(value: Any) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError("Expected a JSON integer")
    return value


def _iso_date(value: Any) -> date:
    if isinstance(value, datetime):
        raise ValueError("Expected an ISO date, not a timestamp")
    if isinstance(value, date):
        return value
    if not isinstance(value, str) or re.fullmatch(r"\d{4}-\d{2}-\d{2}", value) is None:
        raise ValueError("Expected YYYY-MM-DD")
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError("Invalid calendar date") from exc


def _utc_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str) and re.fullmatch(
        r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)", value
    ):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValueError("Invalid UTC timestamp") from exc
    else:
        raise ValueError("Expected a UTC RFC3339 timestamp")
    if parsed.tzinfo is None or parsed.utcoffset() != timedelta(0):
        raise ValueError("Timestamp must be UTC")
    return parsed.astimezone(UTC)


Number = Annotated[float, BeforeValidator(_number)]
Integer = Annotated[int, BeforeValidator(_integer)]
IsoDate = Annotated[date, BeforeValidator(_iso_date)]
UtcDateTime = Annotated[datetime, BeforeValidator(_utc_datetime)]

RegionId = Literal["punjab_pk_demo_v1"]
ProviderName = Literal["power", "soilgrids", "smap", "farmer_input"]
SoilOrigin = Literal["soilgrids", "farmer_input", "unavailable"]
ComponentName = Literal["nitrogen", "roots", "water", "temperature", "soil"]
ReasonCode = Literal[
    "LEGUME_AFTER_HIGH_DEMAND", "LEGUME_BEFORE_HIGH_DEMAND", "ROOT_DEPTH_ALTERNATION",
    "WATER_STRESS_TOLERANCE", "SEASONAL_CLIMATE_FIT", "SOIL_PH_FIT",
    "LIMITED_RESIDUE_BENEFIT", "ROTATION_DIVERSITY",
]
WarningCode = Literal[
    "DEMO_FIXTURE", "SOURCE_STALE", "SOILGRIDS_UNAVAILABLE", "SMAP_UNAVAILABLE",
    "SMAP_PERCENTILE_UNAVAILABLE", "CLIMATE_COVERAGE_LOW", "BASELINE_TOO_DRY",
    "HISTORY_UNKNOWN", "SOIL_SCREEN_INCOMPLETE", "PARTIAL_COMPONENT_COVERAGE",
    "SOIL_TEXTURE_INCONSISTENT", "NO_FEASIBLE_ROTATION",
]
ExclusionCode = Literal[
    "CROP_EXCLUDED", "CROP_NOT_ALLOWED", "CALENDAR_INCOMPATIBLE",
    "MATURITY_WINDOW_TOO_SHORT", "IRRIGATION_REQUIRED", "FAMILY_BREAK_REQUIRED",
    "SOIL_PH_OUT_OF_RANGE",
]
ErrorCode = Literal[
    "PAYLOAD_TOO_LARGE", "UNSUPPORTED_MEDIA_TYPE", "VALIDATION_ERROR", "RATE_LIMITED",
    "REQUIRED_DATA_UNAVAILABLE", "INTERNAL_ERROR",
]


class WireModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, validate_default=True)


class Location(WireModel):
    latitude: Number = Field(ge=-90, le=90)
    longitude: Number = Field(ge=-180, le=180)


class Slot(WireModel):
    slot_id: str = Field(pattern=r"^[a-z0-9_-]{1,32}$")
    start_date: IsoDate
    end_date: IsoDate

    @model_validator(mode="after")
    def check_dates(self) -> Slot:
        days = (self.end_date - self.start_date).days + 1
        if not 30 <= days <= 366:
            raise ValueError("Slot duration must be 30–366 inclusive days")
        return self


class History(WireModel):
    crop_id: str = Field(min_length=1)
    start_date: IsoDate
    end_date: IsoDate
    residue_management: Literal["retained", "removed", "unknown"]

    @model_validator(mode="after")
    def check_dates(self) -> History:
        if self.end_date < self.start_date:
            raise ValueError("History end precedes start")
        return self


class SoilOverride(WireModel):
    sampled_on: IsoDate
    depth_top_cm: Literal[0]
    depth_bottom_cm: Literal[30]
    ph: Number | None = Field(default=None, ge=0, le=14)
    soc_g_kg: Number | None = Field(default=None, ge=0, le=1000)
    total_n_g_kg: Number | None = Field(default=None, ge=0, le=1000)
    sand_pct: Number | None = Field(default=None, ge=0, le=100)
    silt_pct: Number | None = Field(default=None, ge=0, le=100)
    clay_pct: Number | None = Field(default=None, ge=0, le=100)

    @field_validator("depth_top_cm", "depth_bottom_cm", mode="before")
    @classmethod
    def strict_depth(cls, value: Any) -> int:
        return _integer(value)

    @model_validator(mode="after")
    def check_properties(self) -> SoilOverride:
        values = (self.ph, self.soc_g_kg, self.total_n_g_kg,
                  self.sand_pct, self.silt_pct, self.clay_pct)
        if all(value is None for value in values):
            raise ValueError("At least one soil property is required")
        texture = (self.sand_pct, self.silt_pct, self.clay_pct)
        if any(value is not None for value in texture):
            if any(value is None for value in texture):
                raise ValueError("All texture percentages must be supplied together")
            if abs(sum(value for value in texture if value is not None) - 100) > 2:
                raise ValueError("Texture percentages must sum to 100±2")
        return self


class RecommendationRequest(WireModel):
    location: Location
    region_id: RegionId
    assessment_end: IsoDate
    slots: tuple[Slot, ...] = Field(min_length=1, max_length=4)
    crop_history: tuple[History, ...] = Field(default=(), max_length=8)
    irrigation: Literal["rainfed", "available"]
    allowed_crop_ids: tuple[str, ...] = Field(default=(), max_length=12)
    excluded_crop_ids: tuple[str, ...] = Field(default=(), max_length=12)
    soil_override: SoilOverride | None = None
    data_mode: Literal["auto", "fixture"] = "auto"
    top_k: Integer = Field(default=3, ge=1, le=3)

    @model_validator(mode="after")
    def check_request(self, info: ValidationInfo) -> RecommendationRequest:
        context = info.context if isinstance(info.context, dict) else {}
        today = context.get("today_utc", datetime.now(UTC).date())
        known = context.get("known_crop_ids", frozenset(("wheat", "chickpea", "maize")))
        if self.assessment_end > today:
            raise ValueError("Assessment date is in the future")
        if self.assessment_end - timedelta(days=89) < date(1991, 1, 1):
            raise ValueError("The 90-day assessment window predates provider coverage")
        if len({slot.slot_id for slot in self.slots}) != len(self.slots):
            raise ValueError("Slot IDs must be unique")
        previous_end = self.assessment_end
        for slot in self.slots:
            if slot.start_date <= previous_end:
                raise ValueError("Slots must be future, ordered and nonoverlapping")
            if slot.end_date > self.assessment_end + timedelta(days=730):
                raise ValueError("Slot exceeds planning horizon")
            previous_end = slot.end_date
        previous_end = None
        for history in self.crop_history:
            if history.end_date > self.assessment_end:
                raise ValueError("History must be completed by assessment date")
            if previous_end is not None and history.start_date <= previous_end:
                raise ValueError("History must be ordered and nonoverlapping")
            previous_end = history.end_date
        if self.soil_override is not None and self.soil_override.sampled_on > self.assessment_end:
            raise ValueError("Soil sample is after assessment")
        for ids in (self.allowed_crop_ids, self.excluded_crop_ids):
            if len(set(ids)) != len(ids) or not set(ids).issubset(known):
                raise ValueError("Crop IDs must be unique and known to the region")
        if set(self.allowed_crop_ids) & set(self.excluded_crop_ids):
            raise ValueError("Allowed and excluded crop IDs overlap")
        if any(history.crop_id not in known for history in self.crop_history):
            raise ValueError("History contains an unknown crop ID")
        return self


class Climate(WireModel):
    window_start: IsoDate
    window_end: IsoDate
    baseline_start_year: Literal[1991]
    baseline_end_year: Literal[2020]
    rainfall_observed_mm: Number | None = Field(ge=0)
    rainfall_baseline_mm: Number | None = Field(ge=0)
    rainfall_anomaly_pct: Number | None = Field(ge=-100)
    temperature_observed_c: Number | None
    temperature_baseline_c: Number | None
    temperature_anomaly_c: Number | None
    rainfall_band: Literal["severe_dry", "dry", "normal", "wet", "severe_wet", "unknown"]
    heat_band: Literal["normal", "elevated", "high", "unknown"]
    rainfall_coverage: Number = Field(ge=0, le=1)
    temperature_coverage: Number = Field(ge=0, le=1)
    rainfall_baseline_years: Integer = Field(ge=0, le=30)
    temperature_baseline_years: Integer = Field(ge=0, le=30)

    @field_validator("baseline_start_year", "baseline_end_year", mode="before")
    @classmethod
    def strict_year(cls, value: Any) -> int:
        return _integer(value)

    @model_validator(mode="after")
    def check_window(self) -> Climate:
        if self.window_end < self.window_start:
            raise ValueError("Climate window is reversed")
        return self


class SoilFieldSources(WireModel):
    ph: SoilOrigin
    soc_g_kg: SoilOrigin
    total_n_g_kg: SoilOrigin
    sand_pct: SoilOrigin
    silt_pct: SoilOrigin
    clay_pct: SoilOrigin


class Soil(WireModel):
    depth_top_cm: Literal[0]
    depth_bottom_cm: Literal[30]
    ph: Number | None = Field(ge=0, le=14)
    soc_g_kg: Number | None = Field(ge=0, le=1000)
    total_n_g_kg: Number | None = Field(ge=0, le=1000)
    sand_pct: Number | None = Field(ge=0, le=100)
    silt_pct: Number | None = Field(ge=0, le=100)
    clay_pct: Number | None = Field(ge=0, le=100)
    field_sources: SoilFieldSources

    @field_validator("depth_top_cm", "depth_bottom_cm", mode="before")
    @classmethod
    def strict_depth(cls, value: Any) -> int:
        return _integer(value)

    @model_validator(mode="after")
    def check_sources(self) -> Soil:
        for key in ("ph", "soc_g_kg", "total_n_g_kg", "sand_pct", "silt_pct", "clay_pct"):
            if (getattr(self, key) is None) != (getattr(self.field_sources, key) == "unavailable"):
                raise ValueError(f"Soil field source disagrees with {key}")
        return self


class Moisture(WireModel):
    surface_m3_m3: Number | None = Field(ge=0, le=1)
    percentile: Number | None = Field(ge=0, le=100)
    accepted_overpasses: Integer = Field(ge=0)
    latest_observation: IsoDate | None
    depth_cm: Literal[5]

    @field_validator("depth_cm", mode="before")
    @classmethod
    def strict_depth(cls, value: Any) -> int:
        return _integer(value)


class SlotScenario(WireModel):
    slot_id: str = Field(pattern=r"^[a-z0-9_-]{1,32}$")
    kind: Literal["historical_stress_scenario"]
    rainfall_mm: Number | None = Field(ge=0)
    temperature_c: Number | None
    rainfall_baseline_years: Integer = Field(ge=0, le=30)
    temperature_baseline_years: Integer = Field(ge=0, le=30)
    smap_adjustment_applied: StrictBool


class Features(WireModel):
    climate: Climate
    soil: Soil
    moisture: Moisture
    slot_scenarios: tuple[SlotScenario, ...] = Field(min_length=1, max_length=4)


class Components(WireModel):
    nitrogen: Number | None = Field(ge=0, le=100)
    roots: Number | None = Field(ge=0, le=100)
    water: Number | None = Field(ge=0, le=100)
    temperature: Number | None = Field(ge=0, le=100)
    soil: Number | None = Field(ge=0, le=100)


class Weights(WireModel):
    nitrogen: Number = Field(ge=0, le=1)
    roots: Number = Field(ge=0, le=1)
    water: Number = Field(ge=0, le=1)
    temperature: Number = Field(ge=0, le=1)
    soil: Number = Field(ge=0, le=1)


class PlannedCrop(WireModel):
    slot_id: str = Field(min_length=1)
    crop_id: str = Field(min_length=1)
    crop_name: str = Field(min_length=1)
    start_date: IsoDate
    end_date: IsoDate

    @model_validator(mode="after")
    def check_dates(self) -> PlannedCrop:
        if self.end_date < self.start_date:
            raise ValueError("Planned crop end precedes start")
        return self


class Message(WireModel):
    code: ReasonCode | WarningCode
    message: str = Field(min_length=1, max_length=500)


class Exclusion(WireModel):
    slot_id: str = Field(min_length=1)
    crop_id: str = Field(min_length=1)
    code: ExclusionCode
    message: str = Field(min_length=1, max_length=500)


class Source(WireModel):
    provider: ProviderName
    mode: Literal["live", "cache", "stale_cache", "snapshot", "fixture", "farmer_input", "unavailable"]
    product: str | None
    observed_start: IsoDate | None
    observed_end: IsoDate | None
    retrieved_at: UtcDateTime | None
    grid_resolution_km: Number | None = Field(gt=0)
    spatial_support: str | None
    fixture_id: str | None
    used_for: tuple[str, ...]

    @model_validator(mode="after")
    def check_source(self) -> Source:
        if self.provider == "farmer_input":
            if self.mode not in ("farmer_input", "unavailable"):
                raise ValueError("Farmer input has an invalid source mode")
        elif self.mode == "farmer_input":
            raise ValueError("Only farmer input may use farmer_input mode")
        if (self.mode == "fixture") != (self.fixture_id is not None):
            raise ValueError("fixture_id must be present exactly for fixture mode")
        if self.mode == "unavailable":
            fields = (self.product, self.observed_start, self.observed_end, self.retrieved_at,
                      self.grid_resolution_km, self.spatial_support, self.fixture_id)
            if any(value is not None for value in fields) or self.used_for:
                raise ValueError("Unavailable source must have null metadata and no usage")
        if self.observed_start and self.observed_end and self.observed_end < self.observed_start:
            raise ValueError("Source observation dates are reversed")
        if any(not pointer.startswith("/") for pointer in self.used_for):
            raise ValueError("Source used_for values must be JSON pointers")
        return self


class Recommendation(WireModel):
    rank: Integer = Field(ge=1, le=3)
    rotation_id: str = Field(min_length=1)
    score: Number = Field(ge=0, le=100)
    components: Components
    effective_weights: Weights
    slots: tuple[PlannedCrop, ...] = Field(min_length=1, max_length=4)
    reasons: tuple[Message, ...] = Field(min_length=1)

    @model_validator(mode="after")
    def check_weights(self) -> Recommendation:
        keys = ("nitrogen", "roots", "water", "temperature", "soil")
        if any(getattr(self.components, key) is None and getattr(self.effective_weights, key) != 0
               for key in keys):
            raise ValueError("Unavailable component must have zero effective weight")
        if abs(sum(getattr(self.effective_weights, key) for key in keys) - 1) > 1e-6:
            raise ValueError("Effective weights must sum to one")
        if any(reason.code not in get_args(ReasonCode) for reason in self.reasons):
            raise ValueError("Recommendation reasons require reason codes")
        return self


class RecommendationResponse(WireModel):
    schema_version: Literal["1.0.0"]
    request_id: UUID
    generated_at: UtcDateTime
    status: Literal["ok", "degraded", "no_feasible_rotation"]
    rules_version: str = Field(min_length=1)
    catalog_version: str = Field(min_length=1)
    location: Location
    data_quality: Literal["complete", "limited"]
    features: Features
    sources: tuple[Source, ...] = Field(min_length=4, max_length=4)
    recommendations: tuple[Recommendation, ...] = Field(max_length=3)
    feasible_rotation_count: Integer = Field(ge=0)
    exclusions: tuple[Exclusion, ...]
    warnings: tuple[Message, ...]

    @model_validator(mode="after")
    def check_response(self, info: ValidationInfo) -> RecommendationResponse:
        if {source.provider for source in self.sources} != {"power", "soilgrids", "smap", "farmer_input"}:
            raise ValueError("Exactly one source entry is required per provider")
        if self.feasible_rotation_count < len(self.recommendations):
            raise ValueError("Returned recommendations exceed feasible count")
        if [item.rank for item in self.recommendations] != list(range(1, len(self.recommendations) + 1)):
            raise ValueError("Recommendation ranks must be contiguous")
        if self.feasible_rotation_count == 0:
            if self.status != "no_feasible_rotation" or self.recommendations:
                raise ValueError("Empty candidate set requires no_feasible_rotation")
            if not any(warning.code == "NO_FEASIBLE_ROTATION" for warning in self.warnings):
                raise ValueError("Empty candidate set requires a NO_FEASIBLE_ROTATION warning")
        elif self.status == "no_feasible_rotation":
            raise ValueError("Nonempty candidate set cannot be no_feasible_rotation")
        elif self.status != ("ok" if self.data_quality == "complete" else "degraded"):
            raise ValueError("Status disagrees with data quality")
        if any(warning.code not in get_args(WarningCode) for warning in self.warnings):
            raise ValueError("Response warnings require warning codes")
        context = info.context if isinstance(info.context, dict) else {}
        request = context.get("request")
        if isinstance(request, RecommendationRequest):
            slot_ids = [slot.slot_id for slot in request.slots]
            if [slot.slot_id for slot in self.features.slot_scenarios] != slot_ids:
                raise ValueError("Scenarios must match requested slots")
            for item in self.recommendations:
                if [(slot.slot_id, slot.start_date, slot.end_date) for slot in item.slots] != [
                    (slot.slot_id, slot.start_date, slot.end_date) for slot in request.slots
                ]:
                    raise ValueError("Planned crops must match requested slots")
        return self


class ErrorDetail(WireModel):
    path: str
    message: str = Field(min_length=1, max_length=500)


class Error(WireModel):
    code: ErrorCode
    message: str = Field(min_length=1, max_length=500)
    retryable: StrictBool
    details: tuple[ErrorDetail, ...]


class ErrorEnvelope(WireModel):
    schema_version: Literal["1.0.0"]
    request_id: UUID
    error: Error


class PlantingWindow(WireModel):
    start_mmdd: str = Field(pattern=r"^\d{4}$")
    end_mmdd: str = Field(pattern=r"^\d{4}$")

    @model_validator(mode="after")
    def check_mmdd(self) -> PlantingWindow:
        for value in (self.start_mmdd, self.end_mmdd):
            try:
                date(2001, int(value[:2]), int(value[2:]))
            except ValueError as exc:
                raise ValueError("Invalid planting MMDD") from exc
        return self


class Crop(WireModel):
    crop_id: str = Field(min_length=1)
    crop_name: str = Field(min_length=1)
    family: str = Field(min_length=1)
    region_ids: tuple[str, ...] = Field(min_length=1)
    planting_windows: tuple[PlantingWindow, ...] = Field(min_length=1)
    maturity_min_days: Integer = Field(ge=1, le=366)
    maturity_max_days: Integer = Field(ge=1, le=366)
    nitrogen_demand: Literal["low", "medium", "high"]
    legume: StrictBool
    root_class: Literal["shallow", "medium", "deep"]
    rainfall_min_mm: Number = Field(ge=0)
    rainfall_max_mm: Number = Field(ge=0)
    temperature_min_c: Number
    temperature_max_c: Number
    ph_min: Number = Field(ge=0, le=14)
    ph_max: Number = Field(ge=0, le=14)
    drought_tolerant: StrictBool
    waterlogging_tolerant: StrictBool
    irrigation_required: StrictBool
    family_break_crops: Integer = Field(ge=0, le=8)
    references: tuple[str, ...] = Field(min_length=1)

    @model_validator(mode="after")
    def check_crop(self) -> Crop:
        intervals = ((self.maturity_min_days, self.maturity_max_days),
                     (self.rainfall_min_mm, self.rainfall_max_mm),
                     (self.temperature_min_c, self.temperature_max_c), (self.ph_min, self.ph_max))
        if any(low > high for low, high in intervals):
            raise ValueError("Crop trait interval is reversed")
        if len(set(self.region_ids)) != len(self.region_ids):
            raise ValueError("Crop region IDs must be unique")
        if any(not re.fullmatch(r"https://[^\s]+", ref) for ref in self.references):
            raise ValueError("Crop references must be HTTPS URLs")
        return self


class CropCatalogResponse(WireModel):
    schema_version: Literal["1.0.0"]
    catalog_version: str = Field(min_length=1)
    region_id: RegionId
    crops: tuple[Crop, ...] = Field(min_length=1, max_length=12)

    @model_validator(mode="after")
    def check_catalog(self) -> CropCatalogResponse:
        if len({crop.crop_id for crop in self.crops}) != len(self.crops):
            raise ValueError("Crop IDs must be unique")
        if any(self.region_id not in crop.region_ids for crop in self.crops):
            raise ValueError("All crops must belong to the catalog region")
        return self


class ContractDocument(WireModel):
    model_config = ConfigDict(
        extra="forbid", allow_inf_nan=False,
        json_schema_extra={
            "$id": "https://field-shift.local/contracts/1.0.0.json",
            "$schema": "https://json-schema.org/draft/2020-12/schema",
        },
    )
    recommendation_request: RecommendationRequest
    recommendation_response: RecommendationResponse
    error_response: ErrorEnvelope
    crop_catalog_response: CropCatalogResponse


def contract_json_schema() -> dict[str, JsonValue]:
    schema = ContractDocument.model_json_schema(mode="validation")

    def remove_property_titles(node: JsonValue) -> None:
        if isinstance(node, dict):
            properties = node.get("properties")
            if isinstance(properties, dict):
                for child in properties.values():
                    if isinstance(child, dict):
                        child.pop("title", None)
            for child in node.values():
                remove_property_titles(child)
        elif isinstance(node, list):
            for child in node:
                remove_property_titles(child)

    # json-schema-to-typescript otherwise claims model names such as Message
    # for similarly titled scalar properties and renames the public interface.
    remove_property_titles(schema)
    return schema
