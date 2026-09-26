# Field Shift — parallel execution contract

This document supplements ARCHITECTURE.md, DATA_SCHEMA.md and AGRONOMY_RULES.md. It freezes module names, shared types and ownership for the Linear backlog. The application is not implemented by this document.

## Ownership and merge protocol

- Each issue owns exactly the one or two repository-relative files listed in its Target File Paths. All other files, including context documents, are read-only. Tests count toward the two-file limit. Generated fixtures, schemas and lockfiles have explicit owners.
- Work in a separate Git worktree on the issue's exact `codex/feat/...` branch. Start from the integration branch after the issue's blockers have merged. Commit only the owned files. Do not commit temporary capture files, runtime caches, build output or tool-generated lockfiles owned by another issue.
- File ownership is exclusive within each phase. Reusing a file in a later phase is permitted only after its earlier owner has merged. Branches prevent worktree interference; ownership prevents merge conflicts.
- Shared Python models, TypeScript exports and tooling merge before consumers. Consumer agents import frozen symbols without adding new fields or changing shared files. Report a contract defect to the contract owner rather than patching it locally.
- Each ticket provides one terminal DoD command, run from the repository root. All commands must exit 0. Python uses `pytest -q PATH`; frontend uses `npm run build --prefix frontend`. The frontend build script runs Vitest with `--passWithNoTests`, TypeScript checks and Next.js production build. Network-dependent capture is opt-in; DoD tests are offline.
- Environment preparation is separate from DoD: Python 3.11 with `pip install -e '.[dev]'`; Node 22 with `npm install --prefix frontend --package-lock=false`. Only the Phase 4 lockfile owner commits lockfiles. Pin actual compatible package releases during bootstrap; do not leave dependency placeholders.
- Runtime files may be written only to injected temporary/cache directories and are never committed. A provider capture writes only its owned archive path; its self-tests write to pytest's temporary directory.
- A phase is an ownership group, not a promise that all its tickets can begin simultaneously. Follow blocker edges: tooling → contracts → independent modules → integration. Do not assign engineers before they are known.

## Shared public Python models

Owner: `backend/app/schemas/contracts.py`. All named wire models and constraints from DATA_SCHEMA.md are exported under these exact names:

`Location`, `Slot`, `History`, `SoilOverride`, `RecommendationRequest`, `Climate`, `SoilFieldSources`, `Soil`, `Moisture`, `SlotScenario`, `Features`, `Components`, `Weights`, `PlannedCrop`, `Message`, `Exclusion`, `Source`, `Recommendation`, `RecommendationResponse`, `ErrorDetail`, `Error`, `ErrorEnvelope`.

The same module exports `WireModel` (forbid extra keys, finite strict numbers and explicit ISO date parsing) and these additional models:

| Model | Exact fields |
| --- | --- |
| `PlantingWindow` | `start_mmdd: str`, `end_mmdd: str`; valid four-digit MMDD, February 29 rejected; start>end denotes a window crossing New Year |
| `Crop` | `crop_id: str`, `crop_name: str`, `family: str`, `region_ids: tuple[str, ...]`, `planting_windows: tuple[PlantingWindow, ...]`, `maturity_min_days: int`, `maturity_max_days: int`, `nitrogen_demand: Literal['low','medium','high']`, `legume: bool`, `root_class: Literal['shallow','medium','deep']`, `rainfall_min_mm: float`, `rainfall_max_mm: float`, `temperature_min_c: float`, `temperature_max_c: float`, `ph_min: float`, `ph_max: float`, `drought_tolerant: bool`, `waterlogging_tolerant: bool`, `irrigation_required: bool`, `family_break_crops: int`, `references: tuple[str, ...]`. Nonempty names/arrays, unique IDs, finite numbers; maturity 1–366 and min≤max; rainfall≥0; pH 0–14; all intervals ordered; family break 0–8; references are nonempty HTTPS URLs. No implicit crop defaults. |
| `CropCatalogResponse` | `schema_version: Literal['1.0.0']`, `catalog_version: str`, `region_id: Literal['punjab_pk_demo_v1']`, `crops: tuple[Crop, ...]` (1–12 unique crops) |
| `ContractDocument` | `recommendation_request: RecommendationRequest`, `recommendation_response: RecommendationResponse`, `error_response: ErrorEnvelope`, `crop_catalog_response: CropCatalogResponse`; schema root `$id=https://field-shift.local/contracts/1.0.0.json` |

No ticket may reinterpret field names in DATA_SCHEMA.md. Collection fields may be immutable tuples in Python; their JSON representation remains arrays. `CropCatalogResponse` is the response for `GET /api/v1/crops?region_id=punjab_pk_demo_v1`; unknown regions return the documented 422 envelope.

## Shared internal Python types

Owner: `backend/app/schemas/domain.py`. Import `JsonValue` from Pydantic, `date/datetime` from datetime, `Decimal` from decimal, `Path` from pathlib, and public wire models from `app.schemas.contracts`.

All internal records below are frozen Pydantic models with extra fields forbidden. All dates/timestamps are typed; datetimes require UTC. All floats are finite and nullable fields are required unless a default is explicitly listed.

| Export | Exact fields/signature |
| --- | --- |
| `PowerDaily` | `day: date`, `rainfall_mm: float \| None` (≥0), `temperature_c: float \| None` |
| `PowerSeries` | `location: Location`, `rows: tuple[PowerDaily, ...]` (sorted unique days), `source: Source` |
| `SoilLayer` | `property: Literal['phh2o','soc','nitrogen','sand','silt','clay']`, `depth_top_cm: int`, `depth_bottom_cm: int`, `mean_raw: float \| None`, `q05_raw: float \| None`, `q95_raw: float \| None`, `conversion_factor: float` (>0). Raw units must match the verified property table. |
| `SoilProfile` | `location: Location`, `layers: tuple[SoilLayer, ...]` (unique property/depth pairs), `source: Source` |
| `SmapObservation` | `day: date`, `surface_m3_m3: float \| None` ([0,1]), `retrieval_quality_flag: int`, `pass_id: Literal['AM']` |
| `SmapSeries` | `location: Location`, `cell_id: str`, `rows: tuple[SmapObservation, ...]`, `reference_rows: tuple[SmapObservation, ...]`, `source: Source`. Reference rows precede the assessment year. |
| `HttpPayload` | `body: dict[str, JsonValue]`, `mode: Literal['live','cache','stale_cache']`, `retrieved_at: datetime` |
| `FetchedInputs` | `observations: PowerSeries`, `baseline: PowerSeries`, `soil: SoilProfile \| None`, `smap: SmapSeries \| None`, `sources: tuple[Source, ...]` |
| `ClimateResult` | `climate: Climate`, `slot_scenarios: tuple[SlotScenario, ...]`, `warnings: tuple[Message, ...]` |
| `SoilResult` | `soil: Soil`, `warnings: tuple[Message, ...]` |
| `MoistureResult` | `moisture: Moisture`, `warnings: tuple[Message, ...]` |
| `ScoredRotation` | `crop_ids: tuple[str, ...]`, `components: Components`, `effective_weights: Weights`, `unrounded_score: Decimal`, `reasons: tuple[Message, ...]`, `warnings: tuple[Message, ...]` |
| `RankingResult` | `recommendations: tuple[Recommendation, ...]`, `feasible_rotation_count: int`, `exclusions: tuple[Exclusion, ...]`, `warnings: tuple[Message, ...]` |
| `ProviderError` | Exception constructor `ProviderError(provider: Literal['power','soilgrids','smap'], message: str, retryable: bool) -> None`; exposes those three attributes |
| `RequiredDataUnavailable` | Exception constructor `RequiredDataUnavailable(message: str, retryable: bool) -> None`; exposes those two attributes |
| `FixtureMismatch` | Exception constructor `FixtureMismatch(message: str) -> None`; maps to 422 |
| `JsonFetcher` | Protocol: `async fetch_json(self, *, provider: Literal['power','soilgrids'], url: str, params: tuple[tuple[str, str], ...], deadline: float) -> HttpPayload`; deadline is absolute `time.monotonic()` seconds |
| `PowerProvider` | Protocol: `async get_daily(self, location: Location, start: date, end: date, *, deadline: float) -> PowerSeries` |
| `SoilProvider` | Protocol: `async get_topsoil(self, location: Location, *, deadline: float) -> SoilProfile` |
| `SmapProvider` | Protocol: `async get_surface(self, location: Location, assessment_end: date, *, deadline: float) -> SmapSeries \| None` |
| `ProviderBundle` | Frozen dataclass `power: PowerProvider`, `soil: SoilProvider`, `smap: SmapProvider`; interfaces injected, no module globals |

Internal exceptions never become raw API responses. The production app translates them into ErrorEnvelope with request IDs; service-only tests assert exception attributes.

## Immutable fixture formats and pinned scenario

Phase 0 scripts are self-contained, use standard types plus `pydantic.JsonValue`, and do not import Phase 1 modules. Their tests are collected directly from the script file. Do not fabricate successful provider observations when capture is unavailable.

One farm is pinned for capture: `farm_id='faisalabad_2025'`, latitude 31.4504, longitude 73.1350, assessment_end 2025-10-15, slot `rabi_2025` 2025-11-01–2026-03-31, completed maize 2025-05-01–2025-09-30, residues retained, irrigation rainfed. Baseline covers 1991-01-01–2020-12-31; observed POWER covers 2025-07-18–2025-10-15. Capture baseline in complete-year chunks. Genuine fixture recommendation restricts candidates to the verified catalog, never assumes chickpea is feasible without catalog checks.

| Exact owned archive path | Required JSON shape |
| --- | --- |
| `backend/tests/fixtures/power_archive.json` | `{schema_version:'fixture-1', provider:'power', farm_id, location:{latitude,longitude}, requests:[{start_date:ISO-date,end_date:ISO-date,retrieved_at:UTC-timestamp,url:HTTPS-string,params:[[string,string]],status_code:integer,payload:JSON-object}]}`; one observation request plus 30 complete-year baseline requests; JSON numbers finite, POWER fill values retained in raw payload |
| `backend/tests/fixtures/soilgrids_archive.json` | `{schema_version:'fixture-1', provider:'soilgrids', farm_id, location, acquisition:'rest'\|'wcs', retrieved_at:UTC-timestamp, product:'SoilGrids-2.0', source_urls:[HTTPS-string], available:boolean, unavailable_reason:string\|null, layers:[{property:one-of-six,depth_top_cm:integer,depth_bottom_cm:integer,mean_raw:number\|null,q05_raw:number\|null,q95_raw:number\|null,conversion_factor:number}]}`; available data has exactly 18 property/depth pairs; unavailable data has layers=[] and a nonempty reason. WCS-derived layers retain raw scale and source raster URLs. |
| `backend/tests/fixtures/smap_archive.json` | `{schema_version:'fixture-1',provider:'smap',farm_id,location,product:'SPL3SMP_E',version:'6',cell_id:string\|null,grid_posting_km:9,retrieved_at:UTC-timestamp,granule_ids:[string],available:boolean,unavailable_reason:string\|null,rows:[{day:ISO-date,surface_m3_m3:number\|null,retrieval_quality_flag:integer,pass_id:'AM'}],reference_rows:[same-row-shape]}`; source granules must be supplied or retrieved through authorized Earthdata credentials. If absent, emit honest unavailable metadata with rows/reference_rows=[], cell_id=null. |
| `backend/tests/fixtures/manifest.json` | `{schema_version:'fixture-1',fixture_id:'faisalabad_2025',farm_id,location,assessment_end:'2025-10-15',slots:[{slot_id:'rabi_2025',start_date:'2025-11-01',end_date:'2026-03-31'}],catalog_version:string,transform_version:'features-v1',synthetic:false,files:[{provider:'power'\|'soilgrids'\|'smap',path:exact-relative-archive-path,sha256:64-lowercase-hex,available:boolean}]}`; files sorted by provider; paths confined to the three owned archives; no hash placeholders. |

Optional unavailable soil/SMAP archives are valid. POWER observations/baseline and sourced catalog traits are required for the real recommendation demo. A synthetic wire example may be used only by mock-server/contract tests, always labeled `DEMO_FIXTURE` and never loaded by the real FixtureStore.

## Frontend exports and shared props

Owner `frontend/src/lib/generated/contracts.ts`: generate exported TypeScript interfaces with exactly the public Python model names. Dates/timestamps serialize to strings; nullable values remain `number | null` or the appropriate nullable type. `frontend/src/lib/generated/contracts.schema.json` is the combined ContractDocument JSON Schema with its fixed `$id` and `$defs`. Export interfaces from this schema using `json-schema-to-typescript`; do not manually rewrite fields. No internal Python domain records cross the browser boundary.

Component props and callbacks are explicitly defined by each ticket as exported interfaces in the component's owned file. `ReactElement` is imported from React. Arrays are `ReadonlyArray<T>`. Components use generated model types and do not compute agronomic scores.

The client helper owner exports:

```typescript
export function validateRecommendationResponse(payload: unknown): RecommendationResponse;
export function validateCropCatalogResponse(payload: unknown): CropCatalogResponse;
export async function recommendRotation(request: RecommendationRequest, signal?: AbortSignal): Promise<RecommendationResponse>;
export async function fetchCropCatalog(regionId: 'punjab_pk_demo_v1', signal?: AbortSignal): Promise<CropCatalogResponse>;
export class ApiError extends Error { readonly status: number; readonly envelope: ErrorEnvelope | null; }
```

Use Ajv's draft-2020-12 implementation plus ajv-formats and the schema `$defs` references. Runtime validation throws a typed ApiError on malformed/error responses. `POST /api/recommend-rotation` and `GET /api/recommend-rotation?region_id=punjab_pk_demo_v1` are the browser's same-origin proxy endpoints; the proxy maps GET to backend `/api/v1/crops` and POST to backend `/api/v1/recommend-rotation`.

Default development backend is `http://127.0.0.1:8000`. Mock server entry point is `app.mock_server:app`; production is `app.main:app`. The frontend proxy uses server-only `BACKEND_BASE_URL`, defaults to the loopback URL, and accepts no arbitrary user-controlled upstream host. Fixture mode requires `ENABLE_DEMO_FIXTURES=true` on the production backend. Tests inject a fixed UTC clock and transports; real request generation uses datetime.now(UTC).

## Integration construction order

1. Python tooling; independent provider archives and crop catalog; manifest hashes after archive owners merge.
2. Public contracts and internal records; mock API and frontend tooling/shell; generated types/schema; typed API client.
3. Transport + fixture loader; independent provider clients and features; constraints/scoring; ranking; recommendation service.
4. Styles, map, form, timeline, climate, soil and alternative cards implemented in separate modules. All frontend tickets build against the merged shell/types.
5. Offline guard; production app; same-origin proxy; page/dashboard wiring; judge script; owned lockfiles; release CI.

The offline guard prevents external HTTP traffic in fixture mode while permitting local app communication. It is constructed before production wiring so the production-app ticket never needs to modify another owner's file. Prove offline behavior using injected clients/socket guards in tests rather than altering the developer's machine-wide network settings.
