# Field Shift — parallel Linear backlog

Created **37 issues** in the [NASA Crop Rotation Planner Linear project](https://linear.app/scrum-agent/project/nasa-crop-rotation-planner-7f7b1fabbcef), on team Scrum-agent. Each issue is in Backlog, carries its phase label, and has its dependency links set. Every issue description contains the required target branch, one or two exclusive phase-local paths, exact context-file mentions, typed I/O, acceptance checks, and one terminal DoD command.

Phase counts: **Phase 0: 7 · Phase 1: 5 · Phase 2: 13 · Phase 3: 6 · Phase 4: 6**. Paths may recur in later phases only after the earlier owner merges, following [PARALLEL_EXECUTION.md](/home/mubeenulhassan/fyp/nasa-crop-rotation-planner/agent_docs/PARALLEL_EXECUTION.md).

## Phase 0

| Ticket | Priority | Target branch | Exclusive target files |
| --- | --- | --- | --- |
| [FS-01](https://linear.app/scrum-agent/issue/SCR-14/fs-01-platform-bootstrap-pinned-python-and-nextjs-toolchains) [Platform] Bootstrap pinned Python and Next.js toolchains | Urgent | `codex/feat/fs-01-toolchains` | `pyproject.toml`<br>`frontend/package.json` |
| [FS-02](https://linear.app/scrum-agent/issue/SCR-12/fs-02-frontend-scaffold-the-empty-nextjs-app-router-shell) [Frontend] Scaffold the empty Next.js App Router shell | High | `codex/feat/fs-02-app-shell` | `frontend/app/layout.tsx`<br>`frontend/app/page.tsx` |
| [FS-03](https://linear.app/scrum-agent/issue/SCR-13/fs-03-data-capture-and-verify-the-nasa-power-daily-archive) [Data] Capture and verify the NASA POWER daily archive | Urgent | `codex/feat/fs-03-power-archive` | `backend/scripts/test_power_capture.py`<br>`backend/tests/fixtures/power_archive.json` |
| [FS-04](https://linear.app/scrum-agent/issue/SCR-10/fs-04-data-probe-soilgrids-rest-and-cache-genuine-topsoil-layers) [Data] Probe SoilGrids REST and cache genuine topsoil layers | Urgent | `codex/feat/fs-04-soil-archive` | `backend/scripts/test_soil_capture.py`<br>`backend/tests/fixtures/soilgrids_archive.json` |
| [FS-05](https://linear.app/scrum-agent/issue/SCR-11/fs-05-data-record-smap-version-6-fixture-availability-and-quality) [Data] Record SMAP Version 6 fixture availability and quality flags | High | `codex/feat/fs-05-smap-archive` | `backend/scripts/test_smap_capture.py`<br>`backend/tests/fixtures/smap_archive.json` |
| [FS-06](https://linear.app/scrum-agent/issue/SCR-15/fs-06-agronomy-source-and-validate-the-regional-crop-catalog) [Agronomy] Source and validate the regional crop catalog | Urgent | `codex/feat/fs-06-crop-catalog` | `backend/data/punjab_crops.json`<br>`backend/scripts/test_crop_catalog.py` |
| [FS-07](https://linear.app/scrum-agent/issue/SCR-16/fs-07-data-hash-and-validate-immutable-source-fixture-manifests) [Data] Hash and validate immutable source fixture manifests | Urgent | `codex/feat/fs-07-fixture-manifest` | `backend/scripts/test_fixture_manifest.py`<br>`backend/tests/fixtures/manifest.json` |

## Phase 1

| Ticket | Priority | Target branch | Exclusive target files |
| --- | --- | --- | --- |
| [FS-08](https://linear.app/scrum-agent/issue/SCR-17/fs-08-backend-freeze-strict-pydantic-v2-wire-contracts) [Backend] Freeze strict Pydantic v2 wire contracts | Urgent | `codex/feat/fs-08-pydantic-contracts` | `backend/app/schemas/contracts.py`<br>`backend/tests/test_contracts.py` |
| [FS-09](https://linear.app/scrum-agent/issue/SCR-18/fs-09-backend-add-frozen-internal-provider-and-scoring-models) [Backend] Add frozen internal provider and scoring models | High | `codex/feat/fs-09-domain-types` | `backend/app/schemas/domain.py`<br>`backend/tests/test_domain_types.py` |
| [FS-10](https://linear.app/scrum-agent/issue/SCR-20/fs-10-frontend-generate-typescript-contracts-and-json-schema) [Frontend] Generate TypeScript contracts and JSON Schema | Urgent | `codex/feat/fs-10-generated-contracts` | `frontend/src/lib/generated/contracts.ts`<br>`frontend/src/lib/generated/contracts.schema.json` |
| [FS-11](https://linear.app/scrum-agent/issue/SCR-21/fs-11-frontend-implement-the-contract-validating-api-client) [Frontend] Implement the contract-validating API client | High | `codex/feat/fs-11-api-client` | `frontend/src/lib/api/client.ts`<br>`frontend/src/lib/api/client.test.ts` |
| [FS-12](https://linear.app/scrum-agent/issue/SCR-19/fs-12-backend-expose-a-deterministic-contract-valid-mock-api) [Backend] Expose a deterministic contract-valid mock API | High | `codex/feat/fs-12-mock-api` | `backend/app/mock_server.py`<br>`backend/tests/test_mock_server.py` |

## Phase 2

| Ticket | Priority | Target branch | Exclusive target files |
| --- | --- | --- | --- |
| [FS-13](https://linear.app/scrum-agent/issue/SCR-22/fs-13-backend-add-bounded-async-json-provider-transport) [Backend] Add bounded async JSON provider transport | Urgent | `codex/feat/fs-13-http-transport` | `backend/app/providers/http.py`<br>`backend/tests/test_http.py` |
| [FS-14](https://linear.app/scrum-agent/issue/SCR-26/fs-14-backend-implement-the-nasa-power-daily-provider) [Backend] Implement the NASA POWER daily provider | Urgent | `codex/feat/fs-14-power-provider` | `backend/app/providers/power.py`<br>`backend/tests/test_power_provider.py` |
| [FS-15](https://linear.app/scrum-agent/issue/SCR-27/fs-15-backend-implement-the-isric-soilgrids-point-adapter) [Backend] Implement the ISRIC SoilGrids point adapter | Urgent | `codex/feat/fs-15-soil-provider` | `backend/app/providers/soilgrids.py`<br>`backend/tests/test_soilgrids_provider.py` |
| [FS-16](https://linear.app/scrum-agent/issue/SCR-29/fs-16-backend-read-quality-filtered-smap-fixture-series) [Backend] Read quality-filtered SMAP fixture series | High | `codex/feat/fs-16-smap-provider` | `backend/app/providers/smap.py`<br>`backend/tests/test_smap_provider.py` |
| [FS-17](https://linear.app/scrum-agent/issue/SCR-23/fs-17-backend-compute-matched-period-climate-anomalies) [Backend] Compute matched-period climate anomalies | Urgent | `codex/feat/fs-17-climate-features` | `backend/app/features/climate.py`<br>`backend/tests/test_climate_features.py` |
| [FS-18](https://linear.app/scrum-agent/issue/SCR-24/fs-18-backend-normalize-soilgrids-layers-and-farmer-overrides) [Backend] Normalize SoilGrids layers and farmer overrides | High | `codex/feat/fs-18-soil-features` | `backend/app/features/soil.py`<br>`backend/tests/test_soil_features.py` |
| [FS-19](https://linear.app/scrum-agent/issue/SCR-25/fs-19-backend-derive-conservative-smap-moisture-context) [Backend] Derive conservative SMAP moisture context | High | `codex/feat/fs-19-moisture-features` | `backend/app/features/moisture.py`<br>`backend/tests/test_moisture_features.py` |
| [FS-20](https://linear.app/scrum-agent/issue/SCR-28/fs-20-backend-load-the-cited-regional-crop-registry) [Backend] Load the cited regional crop registry | High | `codex/feat/fs-20-crop-registry` | `backend/app/catalog/registry.py`<br>`backend/tests/test_crop_registry.py` |
| [FS-21](https://linear.app/scrum-agent/issue/SCR-31/fs-21-backend-filter-rotations-by-hard-agronomic-constraints) [Backend] Filter rotations by hard agronomic constraints | Urgent | `codex/feat/fs-21-rotation-constraints` | `backend/app/engine/constraints.py`<br>`backend/tests/test_rotation_constraints.py` |
| [FS-22](https://linear.app/scrum-agent/issue/SCR-30/fs-22-backend-score-nitrogen-roots-water-temperature-and-soil) [Backend] Score nitrogen, roots, water, temperature and soil | Urgent | `codex/feat/fs-22-component-scoring` | `backend/app/engine/scoring.py`<br>`backend/tests/test_rotation_scoring.py` |
| [FS-23](https://linear.app/scrum-agent/issue/SCR-32/fs-23-backend-enumerate-and-deterministically-rank-feasible-rotations) [Backend] Enumerate and deterministically rank feasible rotations | Urgent | `codex/feat/fs-23-rotation-ranking` | `backend/app/engine/ranking.py`<br>`backend/tests/test_rotation_ranking.py` |
| [FS-24](https://linear.app/scrum-agent/issue/SCR-33/fs-24-backend-orchestrate-recommendation-features-and-ranking) [Backend] Orchestrate recommendation features and ranking | Urgent | `codex/feat/fs-24-recommendation-service` | `backend/app/services/recommendation.py`<br>`backend/tests/test_recommendation_service.py` |
| [FS-25](https://linear.app/scrum-agent/issue/SCR-34/fs-25-backend-expose-versioned-crop-and-recommendation-routes) [Backend] Expose versioned crop and recommendation routes | Urgent | `codex/feat/fs-25-api-routes` | `backend/app/api/v1/recommendations.py`<br>`backend/tests/test_recommendation_routes.py` |

## Phase 3

| Ticket | Priority | Target branch | Exclusive target files |
| --- | --- | --- | --- |
| [FS-26](https://linear.app/scrum-agent/issue/SCR-35/fs-26-frontend-build-the-accessible-leaflet-coordinate-picker) [Frontend] Build the accessible Leaflet coordinate picker | Urgent | `codex/feat/fs-26-field-map` | `frontend/src/components/field-map.tsx`<br>`frontend/src/components/field-map.test.tsx` |
| [FS-27](https://linear.app/scrum-agent/issue/SCR-36/fs-27-frontend-build-the-validated-planting-rotation-form) [Frontend] Build the validated planting rotation form | Urgent | `codex/feat/fs-27-recommendation-form` | `frontend/src/components/recommendation-form.tsx`<br>`frontend/src/components/recommendation-form.test.tsx` |
| [FS-28](https://linear.app/scrum-agent/issue/SCR-37/fs-28-frontend-draw-returned-crop-choices-on-the-seasonal-timeline) [Frontend] Draw returned crop choices on the seasonal timeline | High | `codex/feat/fs-28-rotation-timeline` | `frontend/src/components/rotation-timeline.tsx`<br>`frontend/src/components/rotation-timeline.test.tsx` |
| [FS-29](https://linear.app/scrum-agent/issue/SCR-39/fs-29-frontend-visualize-rainfall-and-temperature-anomalies) [Frontend] Visualize rainfall and temperature anomalies | Urgent | `codex/feat/fs-29-climate-charts` | `frontend/src/components/climate-charts.tsx`<br>`frontend/src/components/climate-charts.test.tsx` |
| [FS-30](https://linear.app/scrum-agent/issue/SCR-38/fs-30-frontend-render-source-aware-soil-property-radar-and-table) [Frontend] Render source-aware soil property radar and table | High | `codex/feat/fs-30-soil-radar` | `frontend/src/components/soil-radar.tsx`<br>`frontend/src/components/soil-radar.test.tsx` |
| [FS-31](https://linear.app/scrum-agent/issue/SCR-40/fs-31-frontend-present-ranked-alternatives-and-data-quality-reasons) [Frontend] Present ranked alternatives and data-quality reasons | Urgent | `codex/feat/fs-31-recommendation-results` | `frontend/src/components/recommendation-results.tsx`<br>`frontend/src/components/recommendation-results.test.tsx` |

## Phase 4

| Ticket | Priority | Target branch | Exclusive target files |
| --- | --- | --- | --- |
| [FS-32](https://linear.app/scrum-agent/issue/SCR-41/fs-32-backend-enforce-hash-pinned-zero-network-fixture-mode) [Backend] Enforce hash-pinned zero-network fixture mode | Urgent | `codex/feat/fs-32-offline-fixtures` | `backend/app/providers/fixtures.py`<br>`backend/tests/test_offline_fixtures.py` |
| [FS-33](https://linear.app/scrum-agent/issue/SCR-42/fs-33-backend-wire-production-fastapi-app-and-lifespan-providers) [Backend] Wire production FastAPI app and lifespan providers | Urgent | `codex/feat/fs-33-production-app` | `backend/app/main.py`<br>`backend/tests/test_main.py` |
| [FS-34](https://linear.app/scrum-agent/issue/SCR-43/fs-34-frontend-add-the-safe-same-origin-recommendation-proxy) [Frontend] Add the safe same-origin recommendation proxy | Urgent | `codex/feat/fs-34-api-proxy` | `frontend/app/api/recommend-rotation/route.ts`<br>`frontend/app/api/recommend-rotation/route.test.ts` |
| [FS-35](https://linear.app/scrum-agent/issue/SCR-44/fs-35-frontend-wire-the-full-farmer-recommendation-dashboard) [Frontend] Wire the full farmer recommendation dashboard | Urgent | `codex/feat/fs-35-integrated-dashboard` | `frontend/app/page.tsx`<br>`frontend/app/page.integration.test.tsx` |
| [FS-36](https://linear.app/scrum-agent/issue/SCR-45/fs-36-pitch-write-and-verify-the-three-minute-judge-story) [Pitch] Write and verify the three-minute judge story | High | `codex/feat/fs-36-judge-story` | `agent_docs/JUDGE_DEMO.md`<br>`backend/scripts/test_demo_story.py` |
| [FS-37](https://linear.app/scrum-agent/issue/SCR-46/fs-37-release-commit-reproducible-python-and-frontend-locks) [Release] Commit reproducible Python and frontend locks | High | `codex/feat/fs-37-dependency-locks` | `uv.lock`<br>`frontend/package-lock.json` |

## Linear CSV snapshot

[Download the CSV snapshot](/home/mubeenulhassan/fyp/nasa-crop-rotation-planner/agent_docs/LINEAR_BACKLOG.csv). It mirrors issues already created in Linear; do not import it again. Full I/O signatures, context references, acceptance criteria and the single-command DoD are in each linked issue.

