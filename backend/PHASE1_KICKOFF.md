# Phase 1 kickoff: contract lock

This is the requested next-phase plan, not implemented application behavior.
The source of truth remains `agent_docs/DATA_SCHEMA.md` and
`agent_docs/PARALLEL_EXECUTION.md`. Linear tickets were read in full. Catalog
version is now `1.0.1`; public wire schema remains `1.0.0`. Optional soil/SMAP
unavailability must be represented through required nullable fields and source
entries. Provider transport, feature calculations, scoring and farmer UI belong
to later phases.

## 1. FS-08: merge the Python wire contract first

[Linear FS-08](https://linear.app/scrum-agent/issue/SCR-17)

Owned paths: `backend/app/schemas/contracts.py`,
`backend/tests/test_contracts.py`. Branch: `codex/feat/fs-08-pydantic-contracts`.
Dependency: FS-01's tooling preparation.

Export `WireModel` using Pydantic v2 `ConfigDict(extra='forbid',
allow_inf_nan=False)`. Use strict numeric/bool fields and explicit ISO-date
parsing; do not enable strict dates that reject legitimate JSON strings.
Response nullable fields have no omission defaults. Inject fixed UTC time and
known catalog IDs through validation context for deterministic checks.

Export these exact public model names and the frozen fields from the two context
documents:

`Location`, `Slot`, `History`, `SoilOverride`, `RecommendationRequest`,
`Climate`, `SoilFieldSources`, `Soil`, `Moisture`, `SlotScenario`, `Features`,
`Components`, `Weights`, `PlannedCrop`, `Message`, `Exclusion`, `Source`,
`Recommendation`, `RecommendationResponse`, `ErrorDetail`, `Error`,
`ErrorEnvelope`, `PlantingWindow`, `Crop`, `CropCatalogResponse`,
`ContractDocument`.

Export `contract_json_schema() -> dict[str, JsonValue]`, based on
`ContractDocument.model_json_schema()`. Set
`$id=https://field-shift.local/contracts/1.0.0.json` and retain every model in
`$defs`. The root properties are `recommendation_request`,
`recommendation_response`, `error_response`, `crop_catalog_response`.

Tests must cover the documented request, synthetic success/error samples, and
catalog; coordinate bounds; 1–4 unique dated nonoverlapping slots; 0–8 completed
history rows; ISO parsing/leap dates; MMDD windows including New Year and
rejection of February29; integer and finite-number strictness; unknown fields,
IDs and enums; texture overrides; min/max intervals; source cardinality exactly
power/soilgrids/smap/farmer_input; unavailable metadata; fixture IDs; component
weights; and JSON serialization retaining every required null key. Source and
response invariants must reject inconsistent combinations.

Completion command: `pytest -q backend/tests/test_contracts.py`.

## 2. FS-09: lock internal types after FS-08

[Linear FS-09](https://linear.app/scrum-agent/issue/SCR-18)

Owned paths: `backend/app/schemas/domain.py`,
`backend/tests/test_domain_types.py`. Branch: `codex/feat/fs-09-domain-types`.

Export the exact frozen records from `PARALLEL_EXECUTION.md`: `PowerDaily`,
`PowerSeries`, `SoilLayer`, `SoilProfile`, `SmapObservation`, `SmapSeries`,
`HttpPayload`, `FetchedInputs`, `ClimateResult`, `SoilResult`, `MoistureResult`,
`ScoredRotation`, `RankingResult`, and frozen dataclass `ProviderBundle`.
They forbid extra fields, reject nonfinite/coerced numbers, require UTC
timestamps, preserve nulls and validate sorted unique observation days/layers.
SMAP remains a nullable `FetchedInputs.smap`; an unavailable soil profile is
`None`. No Phase 0 producer imports these models.

Export exact exceptions:

```python
ProviderError(provider: Literal['power', 'soilgrids', 'smap'],
              message: str, retryable: bool) -> None
RequiredDataUnavailable(message: str, retryable: bool) -> None
FixtureMismatch(message: str) -> None
```

Export these interfaces as Protocols:

```python
JsonFetcher.fetch_json(self, *, provider: Literal['power', 'soilgrids'],
                       url: str, params: tuple[tuple[str, str], ...],
                       deadline: float) -> HttpPayload  # async
PowerProvider.get_daily(self, location: Location, start: date, end: date,
                        *, deadline: float) -> PowerSeries  # async
SoilProvider.get_topsoil(self, location: Location,
                        *, deadline: float) -> SoilProfile  # async
SmapProvider.get_surface(self, location: Location,
                        assessment_end: date) -> SmapSeries | None  # async
```

Test frozen mutation rejection, date/layer uniqueness and order, raw unit
divisors, quality flags, bounds/nullability, UTC-only time and exception
attributes. Implement declarations and validation, not fetching or scoring.

Completion command: `pytest -q backend/tests/test_domain_types.py`.

## 3. FS-12: expose the contract through a synthetic mock API

[Linear FS-12](https://linear.app/scrum-agent/issue/SCR-19)

This can proceed alongside FS-09 after FS-08. Owned paths:
`backend/app/mock_server.py`, `backend/tests/test_mock_server.py`.
Branch: `codex/feat/fs-12-mock-api`.

Export `app: FastAPI` at `app.mock_server:app` and register:

- `GET /api/v1/crops?region_id=punjab_pk_demo_v1` → `CropCatalogResponse`.
  `region_id` is the required query parameter; unknown values return the strict
  422 `ErrorEnvelope`.
- `POST /api/v1/recommend-rotation`, JSON `RecommendationRequest` →
  `RecommendationResponse`. No recommendation query parameters are introduced.

Use response models from FS-08, a fixed/injectable clock and clearly synthetic
data carrying `DEMO_FIXTURE`. Do not load provider success archives. Translate
request validation failures into the specified error envelope rather than
FastAPI's default `detail` payload. HTTPX ASGI tests cover both routes, missing
and unknown region, invalid requests, null serialization, all four source
entries and stable JSON apart from UUID/timestamp, with external sockets blocked.
Check its OpenAPI models against `contract_json_schema()`.

Completion command: `pytest -q backend/tests/test_mock_server.py`.

## 4. FS-10: generate and freeze browser types/schema

[Linear FS-10](https://linear.app/scrum-agent/issue/SCR-20)

Depends on FS-01 and merged FS-08. Owned paths:
`frontend/src/lib/generated/contracts.ts`,
`frontend/src/lib/generated/contracts.schema.json`.
Branch: `codex/feat/fs-10-generated-contracts`.

Call `contract_json_schema()` to write canonical, deterministically ordered JSON
Schema; generate interfaces with the pinned `json-schema-to-typescript` CLI.
Export every public model name. Preserve string dates, nullable unions and
arrays compatible with `ReadonlyArray<T>`, the exact schema `$id`, and Ajv
draft-2020-12 `$defs` references. No duplicate handwritten wire interfaces.

Verify two regenerations produce identical bytes, then require a clean diff on
regeneration. Type-check required null keys and representative sample payloads;
compare schema/types with the mock server's OpenAPI shapes. The configured
frontend build must include Vitest, `tsc --noEmit`, and the production build.

Completion command: `npm run build --prefix frontend`.

## 5. FS-11: validate responses at the API client boundary

[Linear FS-11](https://linear.app/scrum-agent/issue/SCR-21)

Depends on merged FS-10. Owned paths: `frontend/src/lib/api/client.ts`,
`frontend/src/lib/api/client.test.ts`. Branch: `codex/feat/fs-11-api-client`.

Export these exact signatures using the generated types:

```typescript
export function validateRecommendationResponse(payload: unknown): RecommendationResponse;
export function validateCropCatalogResponse(payload: unknown): CropCatalogResponse;
export async function recommendRotation(request: RecommendationRequest, signal?: AbortSignal): Promise<RecommendationResponse>;
export async function fetchCropCatalog(regionId: 'punjab_pk_demo_v1', signal?: AbortSignal): Promise<CropCatalogResponse>;
export class ApiError extends Error {
  readonly status: number;
  readonly envelope: ErrorEnvelope | null;
}
```

Use Ajv's draft-2020-12 implementation plus `ajv-formats` against the generated
schema. Parse HTTP bodies as `unknown`, validate before returning typed data,
preserve null versus absent, and propagate cancellation. Browser calls are
same-origin `POST /api/recommend-rotation` and
`GET /api/recommend-rotation?region_id=punjab_pk_demo_v1`. The proxy itself is
FS-34 and is not implemented in Phase 1; use mocked fetch in these tests.

Tests cover valid responses, missing/extra fields, nulls, unknown enums, HTTP
failures, strict error envelopes, malformed JSON and AbortSignal. No backend
base URL or `as RecommendationResponse` assertion in browser code.

Completion command: `npm run build --prefix frontend`.

Phase 1 is locked only when all five DoD commands pass, synthetic samples
validate in Python and TypeScript, generated artifacts are byte-stable, and
Phase 0 still passes `python backend/scripts/verify_phase0.py` unchanged.
