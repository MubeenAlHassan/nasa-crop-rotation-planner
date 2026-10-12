# Field Shift — API contract

Contract `1.0.0`. Canonical route: `POST /api/v1/recommend-rotation`, `Content-Type: application/json`. WGS84 decimal degrees, UTC timestamps, ISO `YYYY-MM-DD` dates, snake_case keys. Every documented object forbids extra fields. All response keys are required; unavailable values use JSON `null`, never omitted fields, NaN, sentinels, or numeric strings. Defaults below apply only to omitted request keys, not explicit nulls.

Implement Pydantic v2 models and export OpenAPI/JSON Schema as the source of generated TypeScript types and runtime response validation. Numeric fields reject strings and booleans. Dates accept valid ISO date strings through an explicit parser; integers reject floats. All numbers must be finite.

## Request

| Field | Type | Required/default | Validation |
| --- | --- | --- | --- |
| `location` | `Location` | Required | Latitude/longitude below |
| `region_id` | string | Required | Must match an enabled catalog; initially `punjab_pk_demo_v1` |
| `assessment_end` | date | Required | Latest requested observation date; 90-day window must fit provider coverage; ≤UTC today |
| `slots` | `Slot[]` | Required | 1–4 dated, ordered, nonoverlapping slots |
| `crop_history` | `History[]` | `[]` | 0–8 ordered completed crops; empty history explicitly degrades quality |
| `irrigation` | enum | Required | `rainfed` or `available`; available does not quantify water |
| `allowed_crop_ids` | string[] | `[]` | Empty = all regional candidates; unique known IDs, at most 12 |
| `excluded_crop_ids` | string[] | `[]` | Unique known IDs, at most 12; must not overlap allowed IDs |
| `soil_override` | `SoilOverride` or null | null | Partial, dated farmer observations at 0–30 cm |
| `data_mode` | enum | `auto` | `auto` or `fixture`; fixture requires server configuration and exact manifest match |
| `farmer_objective` | enum | `balanced` | `balanced`, `water_conservation`, `soil_health`, or `climate_adaptation`; remaps agronomy-v1 component base weights before renormalization |
| `top_k` | integer | 3 | 1–3 |

Nested request objects:

| Object | Fields and constraints |
| --- | --- |
| `Location` | `latitude`: number [-90,90]; `longitude`: number [-180,180]. Never accept GeoJSON coordinate order in these named fields. |
| `Slot` | `slot_id`: unique string matching `^[a-z0-9_-]{1,32}$`; `start_date`, `end_date`: dates. `assessment_end < start_date ≤ end_date`; inclusive length 30–366 days; final end ≤assessment_end+730 days. |
| `History` | `crop_id`: known regional ID; `start_date`, `end_date`: dates with start≤end≤assessment_end; `residue_management`: `retained|removed|unknown`. No overlapping records; use the latest record for the first transition. |
| `SoilOverride` | `sampled_on`: date ≤assessment_end; `depth_top_cm`: integer literal 0; `depth_bottom_cm`: integer literal 30; `ph`: number [0,14] or null; `soc_g_kg`: number [0,1000] or null; `total_n_g_kg`: number [0,1000] or null; `sand_pct`, `silt_pct`, `clay_pct`: number [0,100] or null. All six property keys optional, default null; at least one nonnull property required. Texture overrides must supply all three together and sum to 100±2 percentage points. No silent texture renormalization. |

Unknown region/crop IDs, conflicting constraints, invalid fixtures, dates or coordinates produce 422. If `assessment_end` is ahead of usable upstream data, do not substitute another date; return 503 when required observations cannot satisfy coverage.

```json
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
  "soil_override": null,
  "data_mode": "fixture",
  "farmer_objective": "balanced",
  "top_k": 3
}
```

## Success response — HTTP 200

| Field | Type | Meaning/invariants |
| --- | --- | --- |
| `schema_version` | literal `"1.0.0"` | Public contract version |
| `request_id` | UUID string | Also returned in `X-Request-ID` |
| `generated_at` | RFC3339 UTC timestamp | Response generation time, not observation time |
| `status` | `ok|degraded|no_feasible_rotation` | Precedence: empty feasible set → no_feasible_rotation; else limited quality → degraded; else ok |
| `rules_version` | string | Initially `agronomy-v1` |
| `catalog_version` | string | Exact pinned catalog version |
| `location` | `Location` | Echoes requested point, not snapped grid center |
| `data_quality` | `complete|limited` | Completeness rubric in agronomy rules; never a probability |
| `features` | `Features` | Normalized observations and dated planning scenarios |
| `sources` | `Source[]` | Exactly one entry each for power, soilgrids, smap, farmer_input, including unavailable sources |
| `recommendations` | `Recommendation[]` | Up to top_k; ranked descending by unrounded scores |
| `feasible_rotation_count` | integer ≥0 | All feasible sequences before top_k |
| `exclusions` | `Exclusion[]` | Crop/slot exclusion reasons; [] if none |
| `warnings` | `Message[]` | [] if none; source, uncertainty, coverage and demo notices |

Nested feature objects:

| Object | Fields/types |
| --- | --- |
| `Features` | `climate`: `Climate`; `soil`: `Soil`; `moisture`: `Moisture`; `slot_scenarios`: `SlotScenario[]`, exactly one per requested slot in request order |
| `Climate` | `window_start`, `window_end`: dates; `baseline_start_year`: literal 1991; `baseline_end_year`: literal 2020; `rainfall_observed_mm`, `rainfall_baseline_mm`: number≥0 or null; `rainfall_anomaly_pct`: number≥-100 or null; `temperature_observed_c`, `temperature_baseline_c`, `temperature_anomaly_c`: number or null; `rainfall_band`: `severe_dry|dry|normal|wet|severe_wet|unknown`; `heat_band`: `normal|elevated|high|unknown`; `rainfall_coverage`, `temperature_coverage`: number [0,1]; `rainfall_baseline_years`, `temperature_baseline_years`: integer [0,30]. Each variable's totals/means use its final matched mask. |
| `Soil` | `depth_top_cm`: literal 0; `depth_bottom_cm`: literal 30; `ph`, `soc_g_kg`, `total_n_g_kg`, `sand_pct`, `silt_pct`, `clay_pct`: nullable numbers with request ranges; `field_sources`: `SoilFieldSources`. Mapped texture need not sum to 100 exactly; warn when sum deviates >2 points. |
| `SoilFieldSources` | Exactly six keys `ph`, `soc_g_kg`, `total_n_g_kg`, `sand_pct`, `silt_pct`, `clay_pct`; each value `soilgrids|farmer_input|unavailable`, matching nonnull/null fields. |
| `Moisture` | `surface_m3_m3`: number [0,1] or null; `percentile`: number [0,100] or null; `accepted_overpasses`: integer≥0; `latest_observation`: date or null; `depth_cm`: literal 5. Mean/percentile use ruleset coverage/quality; a null mean may still report rejected/insufficient coverage via warnings. |
| `SlotScenario` | `slot_id`: string; `kind`: literal `historical_stress_scenario`; `rainfall_mm`: number≥0 or null; `temperature_c`: number or null; `rainfall_baseline_years`, `temperature_baseline_years`: integer [0,30]; `smap_adjustment_applied`: boolean. No forecast semantics. |

Nested recommendation/provenance objects:

| Object | Fields/types and invariants |
| --- | --- |
| `Recommendation` | `rank`: integer 1..top_k, contiguous; `rotation_id`: string stable hash of catalog/rules and ordered slot/crop IDs; `score`: number [0,100], one decimal using decimal ROUND_HALF_UP; `components`: `Components`; `effective_weights`: `Weights`; `slots`: `PlannedCrop[]`; `reasons`: `Message[]`, ≥1. |
| `Components` | Exactly `nitrogen`, `roots`, `water`, `temperature`, `soil`: number [0,100] or null. Each averages known slot/transition evaluations. |
| `Weights` | Exactly the same five keys: number [0,1]. Missing component weight=0; available weights sum to 1 within 1e-6. Retain sufficient precision; do not round weights to one decimal. |
| `PlannedCrop` | `slot_id`, `crop_id`, `crop_name`: nonempty strings; `start_date`, `end_date`: dates matching the requested slot. Exactly one crop per requested slot in request order. |
| `Message` | `code`: closed reason/warning enum below; `message`: nonempty string ≤500 characters. Numeric outcomes come from engine calculations; prose must not introduce unsupported benefits. |
| `Exclusion` | `slot_id`, `crop_id`: known strings; `code`: exclusion enum below; `message`: string ≤500 characters. Sort/deduplicate by slot/crop/code. |
| `Source` | `provider`: `power|soilgrids|smap|farmer_input`; `mode`: `live|cache|stale_cache|snapshot|fixture|farmer_input|unavailable`; `product`: string or null; `observed_start`, `observed_end`: dates or null; `retrieved_at`: UTC timestamp or null; `grid_resolution_km`: number>0 or null; `spatial_support`: string or null; `fixture_id`: string or null; `used_for`: string[] of JSON-pointer paths to consumed feature fields. |

`Source` rules: `fixture_id` is nonnull iff mode=fixture; unavailable entries have all metadata null and `used_for=[]`. A farmer_input entry uses mode=farmer_input or unavailable. Soil maps have observation dates null; acquisition time/product version conveys provenance. Unknown grid resolution remains null. Preserve product-specific geometry/native cell IDs in the internal manifest; do not guess POWER resolution. Snapshot mode means genuine preprocessed data; fixture mode means explicitly selected demonstration playback. Even genuine captured data used in fixture mode carries the demo label.

Closed message codes:

- Reasons: `LEGUME_AFTER_HIGH_DEMAND`, `LEGUME_BEFORE_HIGH_DEMAND`, `ROOT_DEPTH_ALTERNATION`, `WATER_STRESS_TOLERANCE`, `SEASONAL_CLIMATE_FIT`, `SOIL_PH_FIT`, `LIMITED_RESIDUE_BENEFIT`, `ROTATION_DIVERSITY`, `FARMER_OBJECTIVE`.
- Warnings: `DEMO_FIXTURE`, `SOURCE_STALE`, `SOILGRIDS_UNAVAILABLE`, `SMAP_UNAVAILABLE`, `SMAP_PERCENTILE_UNAVAILABLE`, `CLIMATE_COVERAGE_LOW`, `BASELINE_TOO_DRY`, `HISTORY_UNKNOWN`, `SOIL_SCREEN_INCOMPLETE`, `PARTIAL_COMPONENT_COVERAGE`, `SOIL_TEXTURE_INCONSISTENT`, `NO_FEASIBLE_ROTATION`.
- Exclusions: `CROP_EXCLUDED`, `CROP_NOT_ALLOWED`, `CALENDAR_INCOMPATIBLE`, `MATURITY_WINDOW_TOO_SHORT`, `IRRIGATION_REQUIRED`, `FAMILY_BREAK_REQUIRED`, `SOIL_PH_OUT_OF_RANGE`.

Example below uses **invented illustrative values** to show the complete wire shape. It is not a downloaded NASA/ISRIC fixture or a verified regional recommendation. Phase 0 replaces this example fixture ID with captured manifests; Phase 1 uses this only as a synthetic contract case.

```json
{
  "schema_version": "1.0.0",
  "request_id": "258c4465-0862-49b7-bc73-a3d08eacda09",
  "generated_at": "2026-09-26T09:00:00Z",
  "status": "degraded",
  "rules_version": "agronomy-v1",
  "catalog_version": "punjab_pk_demo_v1.0.0",
  "location": {"latitude": 31.4504, "longitude": 73.1350},
  "data_quality": "limited",
  "features": {
    "climate": {
      "window_start": "2025-07-18", "window_end": "2025-10-15",
      "baseline_start_year": 1991, "baseline_end_year": 2020,
      "rainfall_observed_mm": 108.0, "rainfall_baseline_mm": 180.0,
      "rainfall_anomaly_pct": -40.0, "rainfall_band": "severe_dry",
      "temperature_observed_c": 26.0, "temperature_baseline_c": 24.5,
      "temperature_anomaly_c": 1.5, "heat_band": "elevated",
      "rainfall_coverage": 1.0, "temperature_coverage": 1.0,
      "rainfall_baseline_years": 30, "temperature_baseline_years": 30
    },
    "soil": {
      "depth_top_cm": 0, "depth_bottom_cm": 30,
      "ph": 7.2, "soc_g_kg": 8.0, "total_n_g_kg": 0.8,
      "sand_pct": 40.0, "silt_pct": 35.0, "clay_pct": 25.0,
      "field_sources": {
        "ph": "soilgrids", "soc_g_kg": "soilgrids", "total_n_g_kg": "soilgrids",
        "sand_pct": "soilgrids", "silt_pct": "soilgrids", "clay_pct": "soilgrids"
      }
    },
    "moisture": {
      "surface_m3_m3": null, "percentile": null, "accepted_overpasses": 0,
      "latest_observation": null, "depth_cm": 5
    },
    "slot_scenarios": [
      {"slot_id": "rabi_2025", "kind": "historical_stress_scenario", "rainfall_mm": 90.0,
       "temperature_c": 18.0, "rainfall_baseline_years": 29, "temperature_baseline_years": 29,
       "smap_adjustment_applied": false}
    ]
  },
  "sources": [
    {"provider": "power", "mode": "fixture", "product": "POWER daily AG UTC",
     "observed_start": "1991-01-01", "observed_end": "2025-10-15",
     "retrieved_at": "2026-09-26T08:00:00Z", "grid_resolution_km": null,
     "spatial_support": "Provider native grids; point sample", "fixture_id": "synthetic-contract-example",
     "used_for": ["/features/climate", "/features/slot_scenarios"]},
    {"provider": "soilgrids", "mode": "fixture", "product": "SoilGrids 2.0 mean, 0-30 cm",
     "observed_start": null, "observed_end": null, "retrieved_at": "2026-09-26T08:00:00Z",
     "grid_resolution_km": 0.25, "spatial_support": "Modeled soil grid",
     "fixture_id": "synthetic-contract-example", "used_for": ["/features/soil"]},
    {"provider": "smap", "mode": "unavailable", "product": null,
     "observed_start": null, "observed_end": null, "retrieved_at": null,
     "grid_resolution_km": null, "spatial_support": null, "fixture_id": null, "used_for": []},
    {"provider": "farmer_input", "mode": "unavailable", "product": null,
     "observed_start": null, "observed_end": null, "retrieved_at": null,
     "grid_resolution_km": null, "spatial_support": null, "fixture_id": null, "used_for": []}
  ],
  "recommendations": [
    {
      "rank": 1, "rotation_id": "rot_example_chickpea", "score": 81.3,
      "components": {"nitrogen": 90.0, "roots": 75.0, "water": 70.0, "temperature": 85.0, "soil": 100.0},
      "effective_weights": {"nitrogen": 0.25, "roots": 0.2, "water": 0.3, "temperature": 0.15, "soil": 0.1},
      "slots": [
        {"slot_id": "rabi_2025", "crop_id": "chickpea", "crop_name": "Chickpea",
         "start_date": "2025-11-01", "end_date": "2026-03-31"}
      ],
      "reasons": [
        {"code": "LEGUME_AFTER_HIGH_DEMAND", "message": "A legume follows the high-demand maize crop in this illustrative plan."},
        {"code": "ROOT_DEPTH_ALTERNATION", "message": "The catalog rooting class changes between the two crops."}
      ]
    }
  ],
  "feasible_rotation_count": 1,
  "exclusions": [],
  "warnings": [
    {"code": "DEMO_FIXTURE", "message": "Synthetic contract example; values are not verified observations."},
    {"code": "SMAP_UNAVAILABLE", "message": "Surface soil moisture is unavailable; its establishment adjustment is omitted."}
  ]
}
```

## Error contract

All error statuses use this shape, including FastAPI request validation failures; register a custom exception handler rather than returning the default `detail` array.

| Object | Required fields |
| --- | --- |
| Error envelope | `schema_version`: literal `1.0.0`; `request_id`: UUID; `error`: `Error` |
| `Error` | `code`: enum below; `message`: string≤500; `retryable`: boolean; `details`: `ErrorDetail[]` (empty allowed) |
| `ErrorDetail` | `path`: JSON pointer string (empty for service-wide failure); `message`: string≤500 |

| HTTP | Error code | Behavior |
| --- | --- | --- |
| 413 | `PAYLOAD_TOO_LARGE` | Body >64 KiB; reject before JSON parsing |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Require application/json |
| 422 | `VALIDATION_ERROR` | Invalid payload, region, crop or fixture; not retryable |
| 429 | `RATE_LIMITED` | Application rate limit; retryable; supply Retry-After |
| 503 | `REQUIRED_DATA_UNAVAILABLE` | Need ≥1 coverage-qualified observed POWER variable and ≥1 qualified seasonal baseline variable per slot; retryable only for a transient outage |
| 500 | `INTERNAL_ERROR` | Unexpected error or invalid catalog; generic message, internal request-ID logs |

```json
{
  "schema_version": "1.0.0",
  "request_id": "258c4465-0862-49b7-bc73-a3d08eacda09",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "retryable": false,
    "details": [{"path": "/location/latitude", "message": "Must be between -90 and 90."}]
  }
}
```

For no feasible rotation, return the full success envelope with `recommendations=[]`, `feasible_rotation_count=0`, status `no_feasible_rotation`, exclusions where applicable, and warning `NO_FEASIBLE_ROTATION`. Never return an invalid crop as a fallback.

## Contract release checks

Use a shared wire-model base: `ConfigDict(extra="forbid", allow_inf_nan=False)` plus strict numeric fields and explicit ISO date parsing. Test JSON serialization, not only Python-model construction. Export nullable fields as unions that preserve null in TypeScript. Snapshot OpenAPI and validate all sample payloads; require generated types to be unchanged after regeneration. Version breaking changes through a new API major route; additive changes require coordinated strict-validator regeneration and schema-version updates. Identifiers in examples are illustrative; production rotation IDs use `rot_` plus SHA-256 of canonical sorted-key JSON containing catalog_version, rules_version and the ordered slot_id/crop_id pairs.
