> Current status (14 November 2026): see [readiness audit](READINESS_AUDIT.md), [model contract](ATLAS_MODEL_CONTRACT.md), and [implementation plan](IMPLEMENTATION_PLAN.md). Historical verification sections below describe earlier releases, not current scientific readiness.

# Rotation Atlas

The Midwest rotation workspace is at `/atlas`, with its presentation page at `/`.
Rotation Atlas is the sole application experience. The legacy `/planner`, `/weather`, FastAPI recommendation service, v1 contracts, and their UI dependencies have been removed; those URLs and APIs are no longer part of the product. NASA capture and harmonization tooling remains under `backend/atlas/`.

## Run and build

Use the repository's existing Node 22 dependencies. No additional frontend packages are required.

```sh
# From the repository root
node scripts/build-atlas.mjs
npm run dev --prefix frontend
# Open http://localhost:3000/atlas
```

The comparison service is `POST /api/atlas/compare` in Next.js. It runs the same pure TypeScript engine as the browser; the Iowa experience does not require a Python server. Python is used only for optional capture, QA and harmonization.

`node scripts/build-atlas.mjs` also produces `dist-atlas/`, a portable static demonstration, and the self-contained offline shell in `frontend/public/atlas/`. Serve the static demonstration at `/atlas/` for service-worker coverage. The static artifact calculates locally; it has no server comparison endpoint. Saved edits remain on the device and can be exported. On the full Next.js application, pending saved scenarios are synced to the decision storage service when connectivity returns. The `POST/GET /api/atlas/decisions` service stores the latest decision behind a per-device UUID capability key (no public listing). It uses `.atlas-decisions/` or `ATLAS_DECISIONS_DIR`; production hosting needs a persistent writable volume. This demo mechanism is not account-based cross-device storage or a multi-user authentication system. Keep the device key private. Static hosting has no sync endpoint and retains the pending device copy.

Build the offline bundle before the Next.js production build. The build script hashes HTML, scripts, CSS and the evidence package into the service-worker cache version. A new release replaces older Atlas caches without touching other applications' caches. The initial visit must be online. Raw NASA archives are cached only when opened; the weather package, comparison engine and export work offline without them.

## Captured evidence

- Illustrative Iowa location: 42.025° N, 93.650° W. The name and boundary are demonstration inputs, not a participating farm.
- NASA POWER: all 4,383 UTC days from 2013-01-01 through 2024-12-31; no missing required parameters in the captured package.
- Parameters: PRECTOTCORR, T2M_MIN, T2M_MAX, RH2M, WS2M, ALLSKY_SFC_SW_DWN.
- Raw replies, provider metadata, exact request URLs, retrieval time and SHA-256 hashes are retained in `frontend/public/atlas/`.
- NASA POWER provides regional meteorology/assimilation and satellite-derived solar radiation, not field sensor readings. POWER rain is **not** presented as IMERG.
- Current historical evidence includes Landsat, SSURGO, POWER, MODIS and NASADEM; March–November 2024 SMAP/IMERG; May–June ECOSTRESS; and 2005–2024 regional GRACE. QA limits and native support are explicit. HLS remains uncaptured. See `IMPLEMENTATION_PLAN.md` for current coverage. These evidence integrations do not automatically replace model forcing or farmer soil assumptions.
- The field locator is schematic; evidence panels also provide georeferenced native-support maps with QA gating. Posting size is not effective observational resolution.

Reproduce the capture (public NASA network access required):

```sh
python3 backend/atlas/pipeline.py --output frontend/public/atlas/iowa.json
node scripts/build-atlas.mjs
```

Existing raw responses are reused so repeated packaging remains reproducible. To deliberately refresh, capture to a new output directory and review the changed provider metadata and hashes before replacing the published package.

### Optional authenticated Earthdata extension

Install `backend/atlas/requirements-geospatial.txt` in a separate Python environment. Configure Earthdata authentication outside the app using earthaccess's environment or netrc mechanism; never commit credentials.

```sh
python backend/atlas/earthdata_capture.py --product hls --start 2024-06-01 --end 2024-06-15 --out /tmp/atlas-hls
```

The bounded capture tool records product/version, bounding box, dates, granule metadata and asset hashes. It does **not** mark raw downloads as valid observations. `harmonize.py` provides product-specific HLS, ECOSTRESS and SMAP QA helpers, NDVI, projected native-pixel/field intersection aggregation, COG export and JSON/optional Parquet output. Its binary-mask raster mode accepts an explicitly prepared valid-pixel mask; it does not guess arbitrary raw product bit fields. Preserve product-specific fill values, scale factors and acquisition times when preparing assets. IMERG rate-to-accumulation conversion is in `pipeline.py`.

The legacy generic harmonization helpers are not the numerical authority for current mission evidence. Product-specific processors have been exercised on authenticated scientific subsets; see the mission evidence documents for actual coverage and QA. The standard-library POWER capture and the published JSON archive were exercised end to end. Optional packages are not needed by the shipped demonstration.

## Model and interfaces

`FieldContext`, `EvidenceSeries`, `ScenarioRequest`, `ComparisonResult`, and sensitivity result types are in `frontend/src/lib/atlas/types.ts`.

The API accepts a `ScenarioRequest` and returns an annualized comparison with daily arrays omitted. Invalid or out-of-region requests return 422; oversized bodies return 413; unavailable archives return 503. Missing essential soil or weather produces `status: insufficient-information`, with no recommendation. Only the maize–soybean baseline and the cached Iowa region are supported. The UI says so rather than running the Iowa model globally.

Four sequences: maize–soybean; maize–winter rye–soybean; maize–soybean–wheat/red clover; maize–soybean–oats/alfalfa–alfalfa. Compare a shared 2027–2030 four-year horizon using three paired historical four-year members. The timeline shows the first member; totals retain all members.

- ET0: daily FAO-56 Penman–Monteith, radiation in MJ/m²/day, 2 m wind, mean RH approximation. Temperature scenarios recompute ET0.
- ETc: crop coefficients vary by growth stage. Below 3°C a dormancy factor applies. Maize/soybean planting and harvest dates are farmer-correctable; other windows remain illustrative; rye termination is constrained to precede soybean planting.
- Water: one 1.5 m profile, farmer-entered initial storage, root-access fraction, stress-dependent actual ET, 10% runoff on liquid input, capped drainage, simple snow accumulation and 3 mm/°C/day melt. This is a transparent reduced model, not calibrated hydrology. Irrigation applies only with explicit access and respects the annual cap. Water is conserved daily, including snow.
- Yield: bounded FAO-style yield response to the cash crop's ET deficit. Historical reference yields are scenario inputs; heat, fertility, disease and cultivar yield effects are not fitted. Autumn wheat/understory resource partitioning is simplified. No NDVI-to-yield regression.
- Nitrogen: a **partial** fertilizer + fixation − harvest-removal budget, excluding soil mineralization and losses. Following-crop credits reduce fertilizer once; no additional nitrogen is created by a credit. No soil-carbon or fertilizer-prescription claim.
- Economics: constant 2026 USD/ha assumptions adapted from extension budget references, excluding land and financing. Prices are scenario prices, not market quotes. Hay revenue is zero without a buyer. Establishment is charged once; costs and revenue assumptions are visible in Evidence.
- Ranking: pass/fail/unknown constraints precede scoring. Fixed versioned normalization covers unmet demand, calendar living cover and gross margin; Pareto status uses their physical means. Unknown feasibility withholds ranking. See the model contract for ranges and units.
- Sensitivity: 11 rainfall levels (40–140%), 12 price levels (50–160%), 11 soil-capacity levels (60–260 mm/m), changing one variable at a time while preserving the daily weather sequence. Switches are nearest **tested** values, not exact break-even thresholds. Counts are not probabilities. Confirmation of forage buyer/equipment is tested separately to suggest a next observation.
- Constraints: buyers, equipment, annual operating-cost cap and irrigation access. Do not infer cultivar suitability, disease safety or local marketing feasibility from these templates.

## Evidence references

- NASA POWER: https://power.larc.nasa.gov/docs/services/api/temporal/daily/
- FAO-56: https://www.fao.org/4/x0490e/x0490e00.htm
- Water response: https://www.fao.org/4/X5647E/x5647e0e.htm
- Iowa enterprise budgets (2026): https://www.extension.iastate.edu/agdm/crops/pdf/a1-20.pdf
- SARE rotations: https://www.sare.org/publications/managing-cover-crops-profitably/Crop-Rotation-with-Cover-Crops/
- Iowa red clover: https://crops.extension.iastate.edu/encyclopedia/red-clover-cover-crop
- Alfalfa nitrogen review: https://extension.umn.edu/agriculture/crop-production/corn/managing-the-rotation-from-alfalfa-to-corn

Numeric prices, wheat budgets, management dates and nitrogen-credit scenarios are explicitly assumptions; source links are not claims that every parameter is a verbatim local recommendation. Use local agronomic review before a field decision.

## Verification

```sh
npm run test --prefix frontend -- --run --cache=false
node scripts/build-atlas.mjs
npm run build --prefix frontend
# With a preview at http://127.0.0.1:4173 and Chrome installed:
node scripts/atlas-browser-smoke.mjs
```

Automated tests cover water conservation, runoff/drainage/snow storage bounds, rainfall monotonicity, cover-crop costs and water, N-credit accounting, missing inputs, market eligibility, price effects, baseline deltas, weights/Pareto behavior, service validation, queued save/restore, raw archive checksums, QA masks and precipitation-unit conversion.

The browser smoke test uses a fresh headless Chrome profile and writes screenshots/reports to ignored `artifacts/`. It verifies four strategy cards, 34 sensitivity cases, report contents, mobile overflow, cached offline reload and offline recalculation. It does not substitute for farmer usability testing.

## Judge demonstration

1. Open `/atlas` and show the observed 829 mm/year regional rainfall mean alongside **modeled** cover and water shortfall.
2. Compare the baseline and three alternatives; explain why forage is conditional without a buyer and equipment.
3. Use Farm assumptions to emphasize soil protection. Show that preference weights change the selected option.
4. Move rainfall or price, then run Find the turning points. Show the evidence behind a switch or explain that no switch was found.
5. Export the decision report; disable the network, reload `/atlas`, and repeat the comparison.

The 2026 judging rules were not independently verified. The supplied challenge and published 2025 criteria informed this build. Confirm current rules and submission format before submitting. Declare AI assistance in code/design and explanatory copy. No NASA branding is reproduced.

## Human validation still required

No farmer interviews, five-person trial or agronomic validation were performed by this implementation. Recruit five participants (record farmers/advisers separately from other testers), ask each to compare a rotation, explain one tradeoff and one uncertainty, and save the report without coaching. Target four successful completions. Record actual completion, misunderstandings and revisions; do not report this target as achieved.

## Original implementation verification (before legacy UI removal)

- Backend regression suite: **321 passed**, including 7 Atlas pipeline/QA checks.
- Frontend suite: **83 passed**, including model invariants, comparison API, decision persistence and the offline queue.
- Full Next.js production build and TypeScript validation: passed.
- Fresh Chrome desktop/mobile checks: passed; no JavaScript exceptions and no 390 px horizontal overflow.
- Browser checks: four comparison cards, 34 sensitivity cases, valid JSON report export, offline reload and recalculation, real server persistence, and queued synchronization after reconnection all passed.
- Private hosted **static demonstration**: https://rotation-atlas-iowa-2026.famedotter2.chatgpt.site . This published artifact evaluates locally; server sync is available in the full Next.js deployment, not the static demo.
- At that historical release authenticated granules remained outstanding. Current mission acquisitions are recorded in the implementation plan; measured soil data, farmer usability trials and agronomic validation still remain outstanding.

## Legacy frontend removal — 2026-11-03

Before deletion, the import audit found 35 legacy source files with no incoming imports from retained code. A repository search additionally found one backend test that read legacy UI files. The baseline build passed all 83 frontend tests, route type generation, TypeScript checks and production compilation after clearing stale generated `.next` route types from earlier work.

Removed the planner/weather pages, their components and UI-only tests, unused presets and the obsolete unvalidated API wrapper, legacy navigation and global styles, Leaflet vendor assets and unused starter assets. The current landing page now links only to Atlas. The app uses its existing Atlas system fonts and a new Atlas sprout icon. Six exclusive direct dependencies were removed along with their unused transitive lockfile entries; no retained package versions changed.

The validated API client, generated contracts, regional API proxy, reusable weather utilities, backend and Atlas data/model code remain available. The old judge script is marked as historical; only its test requiring deleted UI source was removed. Pre-existing Atlas implementation changes were preserved.

Post-cleanup verification:

- Full production build and TypeScript checks passed; `/planner` and `/weather` are absent from the route manifest.
- All **44 remaining frontend tests** and **320 backend tests** passed. The 39 retired frontend tests and one retired backend test specifically covered deleted UI.
- The separate offline fixture audit passed **156 checks** (a subset of the backend coverage).
- No unresolved local imports or legacy visual branding remain in frontend source. Stable contract schema identifiers are intentionally unchanged.
- Production Chrome smoke test passed: retired routes (including `/planner?demo=1`) return 404; the landing page has no legacy navigation; four rotations, 34 sensitivity cases, report export, mobile layout, offline reload/recalculation and decision save/sync work without browser exceptions.
- Desktop and mobile screenshots were captured in ignored `artifacts/`; landing and workspace screenshots were visually reviewed.

The initial sandboxed backend run stalled and was interrupted; the complete successful backend rerun took place outside the sandbox. The static Atlas bundle is unchanged by the legacy UI cleanup. No hosting deployment is needed to remove these local Next.js routes from the already separate static demonstration.
