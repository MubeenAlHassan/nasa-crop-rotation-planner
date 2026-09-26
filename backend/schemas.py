from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal
from datetime import date, datetime

class Location(BaseModel):
    model_config = ConfigDict(extra="forbid")
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)

class Slot(BaseModel):
    model_config = ConfigDict(extra="forbid")
    slot_id: str = Field(..., pattern=r'^[a-z0-9_-]{1,32}$')
    start_date: date
    end_date: date

class History(BaseModel):
    model_config = ConfigDict(extra="forbid")
    crop_id: str
    start_date: date
    end_date: date
    residue_management: Literal['retained', 'removed', 'unknown']

class SoilOverride(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sampled_on: date
    depth_top_cm: Literal[0] = 0
    depth_bottom_cm: Literal[30] = 30
    ph: Optional[float] = Field(None, ge=0, le=14)
    soc_g_kg: Optional[float] = Field(None, ge=0, le=1000)
    total_n_g_kg: Optional[float] = Field(None, ge=0, le=1000)
    sand_pct: Optional[float] = Field(None, ge=0, le=100)
    silt_pct: Optional[float] = Field(None, ge=0, le=100)
    clay_pct: Optional[float] = Field(None, ge=0, le=100)

class RecommendationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    location: Location
    region_id: str
    assessment_end: date
    slots: List[Slot]
    crop_history: List[History] = []
    irrigation: Literal['rainfed', 'available']
    allowed_crop_ids: List[str] = []
    excluded_crop_ids: List[str] = []
    soil_override: Optional[SoilOverride] = None
    data_mode: Literal['auto', 'fixture'] = 'auto'
    top_k: int = Field(3, ge=1, le=3)

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "location": {"latitude": 31.4504, "longitude": 73.1350},
                    "region_id": "punjab_pk_demo_v1",
                    "assessment_end": "2025-10-15",
                    "slots": [
                        {"slot_id": "rabi_2025", "start_date": "2025-11-01", "end_date": "2026-03-31"}
                    ],
                    "crop_history": [
                        {"crop_id": "maize", "start_date": "2025-05-01", "end_date": "2025-09-30", "residue_management": "retained"}
                    ],
                    "irrigation": "rainfed",
                    "allowed_crop_ids": ["chickpea"],
                    "excluded_crop_ids": [],
                    "soil_override": None,
                    "data_mode": "fixture",
                    "top_k": 3
                }
            ]
        }
    }

class ClimateSummary(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    window_start: date
    window_end: date
    baseline_start_year: Literal[1991] = 1991
    baseline_end_year: Literal[2020] = 2020
    rainfall_observed_mm: Optional[float] = Field(None, ge=0)
    rainfall_baseline_mm: Optional[float] = Field(None, ge=0)
    rainfall_anomaly_pct: Optional[float] = Field(None, ge=-100)
    temperature_observed_c: Optional[float] = None
    temperature_baseline_c: Optional[float] = None
    temperature_anomaly_c: Optional[float] = None
    rainfall_band: Literal['severe_dry', 'dry', 'normal', 'wet', 'severe_wet', 'unknown']
    heat_band: Literal['normal', 'elevated', 'high', 'unknown']
    rainfall_coverage: float = Field(..., ge=0, le=1)
    temperature_coverage: float = Field(..., ge=0, le=1)
    rainfall_baseline_years: int = Field(..., ge=0, le=30)
    temperature_baseline_years: int = Field(..., ge=0, le=30)

class SoilFieldSources(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ph: Literal['soilgrids', 'farmer_input', 'unavailable']
    soc_g_kg: Literal['soilgrids', 'farmer_input', 'unavailable']
    total_n_g_kg: Literal['soilgrids', 'farmer_input', 'unavailable']
    sand_pct: Literal['soilgrids', 'farmer_input', 'unavailable']
    silt_pct: Literal['soilgrids', 'farmer_input', 'unavailable']
    clay_pct: Literal['soilgrids', 'farmer_input', 'unavailable']

class Soil(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    depth_top_cm: Literal[0] = 0
    depth_bottom_cm: Literal[30] = 30
    ph: Optional[float] = Field(None, ge=0, le=14)
    soc_g_kg: Optional[float] = Field(None, ge=0, le=1000)
    total_n_g_kg: Optional[float] = Field(None, ge=0, le=1000)
    sand_pct: Optional[float] = Field(None, ge=0, le=100)
    silt_pct: Optional[float] = Field(None, ge=0, le=100)
    clay_pct: Optional[float] = Field(None, ge=0, le=100)
    field_sources: SoilFieldSources

class Moisture(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    surface_m3_m3: Optional[float] = Field(None, ge=0, le=1)
    percentile: Optional[float] = Field(None, ge=0, le=100)
    accepted_overpasses: int = Field(..., ge=0)
    latest_observation: Optional[date] = None
    depth_cm: Literal[5] = 5

class SlotScenario(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    slot_id: str
    kind: Literal['historical_stress_scenario'] = 'historical_stress_scenario'
    rainfall_mm: Optional[float] = Field(None, ge=0)
    temperature_c: Optional[float] = None
    rainfall_baseline_years: int = Field(..., ge=0, le=30)
    temperature_baseline_years: int = Field(..., ge=0, le=30)
    smap_adjustment_applied: bool

class Features(BaseModel):
    model_config = ConfigDict(extra="forbid")
    climate: ClimateSummary  # Using ClimateSummary to match prompt & DATA_SCHEMA conceptually
    soil: Soil
    moisture: Moisture
    slot_scenarios: List[SlotScenario]

class Source(BaseModel):
    model_config = ConfigDict(extra="forbid")
    provider: Literal['power', 'soilgrids', 'smap', 'farmer_input']
    mode: Literal['live', 'cache', 'stale_cache', 'snapshot', 'fixture', 'farmer_input', 'unavailable']
    product: Optional[str] = None
    observed_start: Optional[date] = None
    observed_end: Optional[date] = None
    retrieved_at: Optional[datetime] = None
    grid_resolution_km: Optional[float] = Field(None, gt=0)
    spatial_support: Optional[str] = None
    fixture_id: Optional[str] = None
    used_for: List[str]

class Components(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    nitrogen: Optional[float] = Field(None, ge=0, le=100)
    roots: Optional[float] = Field(None, ge=0, le=100)
    water: Optional[float] = Field(None, ge=0, le=100)
    temperature: Optional[float] = Field(None, ge=0, le=100)
    soil: Optional[float] = Field(None, ge=0, le=100)

class Weights(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    nitrogen: float = Field(..., ge=0, le=1)
    roots: float = Field(..., ge=0, le=1)
    water: float = Field(..., ge=0, le=1)
    temperature: float = Field(..., ge=0, le=1)
    soil: float = Field(..., ge=0, le=1)

class PlannedCrop(BaseModel):
    model_config = ConfigDict(extra="forbid")
    slot_id: str = Field(..., min_length=1)
    crop_id: str = Field(..., min_length=1)
    crop_name: str = Field(..., min_length=1)
    start_date: date
    end_date: date

class Message(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str
    message: str = Field(..., max_length=500)

class RotationPath(BaseModel):
    model_config = ConfigDict(extra="forbid")
    rank: int = Field(..., ge=1, le=3)
    rotation_id: str
    score: float = Field(..., ge=0, le=100)
    components: Components
    effective_weights: Weights
    slots: List[PlannedCrop]
    reasons: List[Message]

class Exclusion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    slot_id: str
    crop_id: str
    code: str
    message: str = Field(..., max_length=500)

class RecommendationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: Literal['1.0.0'] = '1.0.0'
    request_id: str
    generated_at: datetime
    status: Literal['ok', 'degraded', 'no_feasible_rotation']
    rules_version: str
    catalog_version: str
    location: Location
    data_quality: Literal['complete', 'limited']
    features: Features
    sources: List[Source]
    recommendations: List[RotationPath]  # Using RotationPath to match prompt & DATA_SCHEMA conceptual Recommendation
    feasible_rotation_count: int = Field(..., ge=0)
    exclusions: List[Exclusion]
    warnings: List[Message]
