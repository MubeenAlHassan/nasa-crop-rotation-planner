# Field Shift implementation — updated 14 November 2026

## Drawing and slow-network recovery — 15 November 2026

Fixed the Draw field state transition: selecting the outline layer no longer
immediately cancels drawing. At least three corners are required; clearing,
canceling, applying a closed ring and restoring the captured boundary work.
Changed boundaries still withhold the original Landsat/soil overlays.

Evidence downloads now prefer cacheable static archives (including service-worker
copies), with API fallback when online. The full fetch and JSON body are bounded
at 120 seconds per file instead of the previous 3/15-second cutoffs. Caller
cancellation aborts obsolete work on retry/unmount. Field evidence is published as
soon as its verified base archive is available; optional NASA context and additional
Landsat seasons load concurrently and cannot remove valid base observations.
Schema/QA/boundary checks, scientific values, forcing and scoring are unchanged.

Overview/history/comparison expose download progress and a restart/retry control.
Failed field downloads are labeled unavailable in the map rather than permanently
loading. Extended-history failures have a separate retry control. Retries preserve
current farm inputs and device drafts. Source data are never invented or imputed.

Verification: 123 tests across 24 files passed, including a simulated 90-second
JSON transfer, stalled-body timeout, caller cancellation, early base publication,
optional-context failure, static/API history fallback, failed-field retry without
input loss, and drawing/clear/cancel/closed-boundary tests. Full ESLint, TypeScript,
production build and diff whitespace checks passed. The first lint run identified
state updates inside effects; moved reset transitions into retry event handlers and
reran lint/build successfully.

Browser checks on local static and production builds: drawing mode enters/cancels;
static preview placed four corners, applied the ring, withheld mismatched imagery,
restored the captured boundary and soil overlay, compared four rotations and saved
locally. Production history displayed 17 usable / 66 discovered 2024 acquisitions;
no captured browser errors. Production history had no page overflow at 390 and
1024 px. Slow/failing network behavior is verified through deterministic tests;
no claim of a newly completed live-Vercel or full offline browser suite.

No deployment performed. Owner must deploy these changes before the public Vercel
site receives the fixes; the earlier live-test report describes the previous build.



## Vercel demonstration saving — 15 November 2026

Device-local saving now applies to Next.js and static deployments. Save controls
identify the device scope and recommend report export as a backup. Automatic
sync and reconnect retries are removed; existing schema-1 pending drafts migrate
without losing inputs or timestamps. Readable drafts remain restorable if the
browser blocks migration writes. `/api/atlas/decisions` returns HTTP 501 with
`SERVER_SYNC_DISABLED`, no-store, and no filesystem access. No database or account
service added; no deployment performed. Historical sync test results below refer
to the previous implementation.

Live read-only checks of https://rotationatlas.vercel.app on 15 November: homepage,
workspace, evidence/history/season index/June/ECOSTRESS/GRACE APIs returned 200;
JSON endpoints decoded successfully. All nine live March–November seasonal APIs
returned 200 and matched their indexed SHA-256 checksums; report:
`artifacts/vercel-season-api-check.json`. These checks describe the existing deployment,
not deployment of the local save fix. All 113 frontend/API tests, ESLint, TypeScript and production build passed.
Production Chrome verified device-local save, export, offline reload/recalculation,
reconnect, tablet/phone layout and zero server-sync requests or browser exceptions.
Legacy pending migration and blocked-write restoration are covered by tests.
The browser smoke script was updated for the existing export-format menu after
its first run stopped before selecting JSON; the corrected production run passed.
Standalone static Chrome also passed device-local saving, JSON export, tablet/phone
layout, offline replay and zero sync requests/browser exceptions. These are software
checks, not new scientific validation.



## Evidence-linked per-strategy rationale — verified 14 November 2026

**Software acceptance for handoff priority item 2 delivered.** Scoring, forcing and
satellite acquisition unchanged. No farmer validation or production claim.

- [x] Added `frontend/src/lib/atlas/strategy-rationale.ts` (`strategy-rationale-v1`).
  Each strategy receives template disclosure, agronomic mechanisms with claim
  limits, observed-context citations, contrary/missing evidence and local-review
  questions. Projected benefits are explicitly labeled unvalidated.
- [x] `compare()` attaches forcing/history rationale; UI and export enrich with
  Landsat, seasonal, ECOSTRESS and GRACE packages when loaded. Mismatched
  boundary history, Landsat and ECOSTRESS are withheld from cited context;
  unavailable packages are listed under contrary/missing evidence.
- [x] Inspect panel shows rationale for the active strategy; export JSON includes
  enriched `result.strategies[].rationale` and `comparisonBasis.rationaleMethod`.

## Reviewed local enterprise inputs — verified 14 November 2026

**Software acceptance for handoff priority item 3 delivered.** No market quotes
invented; catalog defaults remain labeled unvalidated.

- [x] `enterprise-inputs-v1` on `ScenarioRequest`: per-crop price/cost overrides,
  clover N-credit range, N credit USD/kg, review flag and note.
- [x] Engine resolves overrides via `resolveCropEconomics`; water/cover objectives
  unchanged when only economic inputs change.
- [x] Farm assumptions UI section 4 edits and labels source; save/load migrates
  missing enterprise without inventing `reviewed: true`.
- [x] Verification: `enterprise.test.ts` + storage migration; full frontend suite
  **109 tests / 21 files**; `tsc --noEmit` and eslint on touched files passed.

Remaining: G0–G5 external gates (people, measurements, seasons, production ops).

## March–November 2024 seasonal milestone — verified 14 November 2026

**Acquisition complete; processing/replay complete; application integration verified.**
Scientific calibration remains unperformed. No deployment, forcing/scoring changes,
product substitution, QA relaxation or automatic cover/stress classification.

- [x] All nine months acquired using sequential months, two workers, provider delays,
  checksummed reuse and interruption-safe receipts. Completed months were reused;
  interrupted October resumed from cached subsets, followed by November.
- [x] 17,875 selected scientific subsets, 960,038,056 source bytes. Thirteen older
  L4 processing candidates retained with hashes/reasons but excluded from numerical
  interpretation. No unresolved acquisition failures or missing expected intervals.
- [x] Every month independently decoded/replayed byte-for-byte; daily precipitation
  and L4 aggregation independently reproduced for all nine native regional cells.
- [x] APIs, native maps, daily timelines, reviewed windows, source-aware comparisons,
  provenance exports and explicit offline save/replay/removal connected.
- [x] Full 275-day window: 6,600 expected/acquired/valid IMERG hours. Removing April
  gives 5,880 acquired hours and withholds the complete total. Corrupting March then
  gives 5,136 hours; the corrupt package is removed, not treated as zero rain.
- [x] Production and standalone static browsers replay all nine cached packages;
  full/partial/corrupt exports agree with actual intervals. March–April boundary
  windows, edited-boundary withholding, 1024/390 px layouts and no exceptions checked.
- [x] 99 frontend tests across 18 files; 31 Python checks; lint, TypeScript, production
  and standalone builds pass. Production seasonal/ECOSTRESS/GRACE/history/rotation
  browser regressions and static rotation workflows pass.

| Month | IMERG acquired/expected | L4 means / AUP snapshots | L3 accepted / 9-cell slots | Nearest-pilot L3 | Complete rain days |
|---|---|---|---|---|---|
| 2024-03 | 1488/1488 | 248 / 248 | 67 / 558 | 0/62 | 31 |
| 2024-04 | 1440/1440 | 240 / 240 | 76 / 540 | 0/60 | 30 |
| 2024-05 | 1488/1488 | 248 / 248 | 54 / 558 | 0/62 | 31 |
| 2024-06 | 1440/1440 | 240 / 240 | 87 / 540 | 0/60 | 30 |
| 2024-07 | 1488/1488 | 248 / 248 | 90 / 558 | 0/62 | 31 |
| 2024-08 | 1488/1488 | 248 / 248 | 93 / 558 | 0/62 | 31 |
| 2024-09 | 1440/1440 | 240 / 240 | 81 / 540 | 0/60 | 30 |
| 2024-10 | 1488/1488 | 248 / 248 | 92 / 558 | 0/62 | 31 |
| 2024-11 | 1440/1440 | 240 / 240 | 83 / 540 | 0/60 | 30 |

### QA coverage and withheld interpretation

IMERG Final V07B: 13,200 half-hour intervals, 118,800 valid native cell-intervals,
275 complete nearest-cell daily totals. Validity here means the implemented file,
unit, fill/range and temporal checks passed; it does not mean gauge calibration or
independent ground truth. Quality-index/error fields remain available and are not
converted into unsupported aggregate confidence intervals.

SMAP L3 SPL3SMP_E.006 R19240: 275 daily files / 550 AM-PM slots. Across nine cells,
723/4,950 cell-slots accepted and 4,227 withheld. Nearest pilot: **0/550 accepted**.
All nearest-pilot slots have non-recommended retrieval and surface-condition flags;
280 also lack time/coordinates and 284 lack a moisture value (reasons overlap).
No QA threshold was changed to populate the map. Native 9 km posting is not the
approximately 36 km radiometer footprint or a field measurement.

L4 SPL4SMGP.008 Vv8012: 2,200 three-hour means; 19,800 valid root-zone cell-intervals.
L4 SPL4SMAU.008: 2,200 analysis snapshots; 19,800 valid root-zone spread diagnostics.
Surface 0–5 cm and root zone 0–100 cm remain assimilation estimates on the native
9 km model grid. Snapshot ensemble spread is not GPH-mean confidence or total
predictive uncertainty. One season is not a climatology; no standardized anomalies.
Shared forcing/product inputs are not independent confirmation or causal evidence.
ECOSTRESS dates and GRACE regional support/reference baseline remain unchanged.

### Reproducibility, resources and current blockers

Compact monthly archives total **30,854,416 bytes** (~30.85 MB); selected source
subsets ~960 MB; complete private campaign cache including receipts, staging/replay
and excluded candidates occupies ~1.1 GiB. Offline months require explicit saving;
missing, rejected, loaded and device-cached support remain distinct.

Current acquisition/application blockers: **none**. Earlier authentication and
April processing-version stops are historical and resolved. A final Python failure
was a test choosing the earliest newly available file while assuming June 1;
its representative fixture is now explicitly June 1. Numerical products unchanged.
The interrupted healthy run was not duplicated or restarted while still alive.

Verification artifacts: `artifacts/nasa-season-delivery.json` (all 14 checks pass),
`artifacts/nasa-campaign-replay.json`, `artifacts/nasa-season-coverage.json`,
`artifacts/atlas-full-season-verification.json`,
`artifacts/atlas-full-season-static-verification.json`, and per-check delivery logs.
The tablet capture was visually inspected. Public JSON has no detected token/signed
URL parameters; diff whitespace checks pass. Original forcing SHA256 remains
`80a1c801e7cefebc404c9c4ed1a8323626a4f2e7d2abac90e19456f9fd8055a7`.

Resume/check commands (no new acquisition needed):
- `/tmp/fieldshift-evidence-env/bin/python backend/atlas/verify_nasa_campaign.py`
- `/tmp/fieldshift-evidence-env/bin/python backend/atlas/finish_nasa_campaign.py`
- Campaign `backend/atlas/nasa_season_campaign.py` skips matching verified files;
  private checkpoint `backend/.provider_cache/nasa-season/campaign-2024.json`.

### Remaining acceptance criteria outside this verified milestone

- Farmer/adviser confirmation of cropped boundary, management and exposure-window
  labels; independent crop/residue labels before any automated cover classifier.
- Depth/time-matched moisture sensors and local rain gauges with spatially blocked,
  forward-time independent evaluation before accuracy/uncertainty claims.
- Multi-season observed crop/water/yield/economic outcomes and alternative-rotation
  evidence before calibrated projections or causal agronomic benefit claims.
- Farmer usability evaluation, production authorization/privacy/durable-storage
  controls and monitored recovery before operational reliance (not deployed here).

Earlier dated sections below describe historical checkpoints; this section and the
current evidence table govern delivered coverage. See
[seasonal processing contract](../backend/atlas/SEASONAL_EVIDENCE.md).

## GRACE regional delivery — 13 November 2026

- [x] Read mandatory requirements; authenticated full current JPL CRI scientific file
  acquired (46,365,171 bytes), actual schema and current release notes inspected.
- [x] Six complete inland mascons selected around Iowa; native 0.5° posting is not
  independent resolution. No field clipping or optional gain-factor scaling.
- [x] 2005–2024: 210 accepted monthly estimates and 30 explicit missing months,
  including the mission gap. Exact shifted/overlapping source bounds preserved;
  nominal labels reconstructed against provider missing-month metadata.
- [x] Archive/API, regional map, gap-preserving series, descriptive monthly history,
  uncertainty diagnostics, exports and explicit offline controls implemented.
- [x] 30 Python checks (including independent source reads and byte-identical GRACE
  replay), 90 frontend tests, lint, types and production build pass. GRACE browser
  tests verify regional map, shifted dates, missing months, export, explicit offline
  save/reload/replay/removal and missing-package withholding. ECOSTRESS and core
  rotation browser regressions pass; no exceptions, 1024/390 px no overflow.
- [x] Updated current evidence table and UI registry; historical credential blockers
  explicitly superseded. No current authentication blocker. Public archive secret/
  signed-URL scan and diff whitespace checks pass. Forcing hash unchanged.

No trend or groundwater-depletion output. Anomaly reference remains provider
2004–2009; no independent-pixel/month uncertainty assumption. Current source has
legacy `product_version=v3.0` attribute despite RL06.3Mv04 CMR/title/source identity;
both are preserved. No full March–November expansion launched.

Region: six full inland mascons (IDs 683, 684, 771, 772, 863, 864), 294 posted
cells, 675,025.81 km²; exploratory Midwest context, not a watershed. Reference
baseline remains 2004–2009. Regional sigma diagnostic assumes perfect positive
correlation as a bound on represented random error; systematic errors remain unknown.
Sources stored privately: 46,365,171-byte NetCDF plus receipt/catalog/release notes.
Derived archive: 183,246 bytes, SHA256
`261bee2239d8744e264348535d4d3d1299acccbdda9ed49783632da7a95b9a1b`.
Only the index is auto-cached; full archive needs explicit offline save.
Documentation/reproduction: [GRACE evidence](../backend/atlas/GRACE_EVIDENCE.md).
Local reports: `artifacts/grace-replay.json`, `artifacts/atlas-grace-verification.json`,
`artifacts/atlas-ecostress-verification.json`, `artifacts/atlas-browser-verification.json`.
Tablet screenshot visually reviewed. Initial build sandbox error and local-server
approval timeout resolved on retry; neither is an outstanding blocker.

Next scientific acceptance criteria: support/region sensitivity, independent regional
water-budget evaluation, leakage/systematic-error assessment, covariance-aware
uncertainty and any future trend model with seasonality and temporal dependence.
Groundwater attribution requires other storage components and propagated errors.
No calibrated agronomic benefit or causal rotation response is claimed.

## ECOSTRESS delivery — verified 13 November 2026

Mandatory context and actual scientific files reviewed. Simulation forcing, rotation
scoring and June SMAP/IMERG package preserved. No six-hour expansion launched.
Definitions, primary references and reproduction commands:
[ECOSTRESS evidence](../backend/atlas/ECOSTRESS_EVIDENCE.md).

- [x] Authenticated acquisition: **24 Collection 002 product granules**, **117 scientific
  GeoTIFFs + 24 metadata JSON files**, zero failed downloads. Collection 003 June
  queries returned no pilot matches; current availability differs from historical coverage.
- [x] All **17 June LST granules** acquired: June 2, 8 (two), 11 (two), 12 (two),
  15, 20, 23, 24, 25, 26, 27, 28, 29 and 30. Only June 11 at 20:52 UTC and
  June 23 at 16:04 UTC yield usable field summaries (100% accepted area each).
  Other 15 have zero accepted field area and remain retained with rejection reasons.
- [x] June 27/28 JET and ESI acquired but **zero usable field area**. Nearest
  outside-June alternative **May 23 at 21:51 UTC** LST/JET/ESI acquired, 100%
  accepted field area. Explicit changed comparison date; no substituted June ET/ESI.
- [x] Verified native coordinates, masks, fill/scaling, time support, builds 0711/0712
  and PGE v1.11.5/v1.12.4. Native 70 m EPSG:32615 cells, 121-cell extraction,
  exact area weights, raw/rejected values, source hashes and metadata retained.
  Pixel spacing is not effective resolution or agronomic accuracy.
- [x] LST K→°C; ETdaily modeled sunrise–sunset integrated mm/day; instantaneous
  ET/PET W/m²; ESI actual/potential ET ratio. Documented PDF ETdaily units table
  inconsistency against corrected producer guide/code. Pixel LST error and
  instantaneous between-model ET spread are not field confidence intervals.
- [x] Acquisition → offline processing → archive → API → dated native maps/timeline
  → support-aware Landsat/SMAP/IMERG and reviewed-window comparison → exports →
  explicit offline save/replay/removal. Boundary edits withhold field attribution;
  time offsets and shared inputs disclosed. Only the small index is auto-cached.
- [x] **86 frontend tests and 28 Python checks pass**, plus lint, TypeScript and
  production build. Real-file decoding, QA rejection, units, missingness, support,
  boundary, provenance and API checks pass. Independent offline replay is byte-identical.
- [x] Final production browser checks: cloud rejection, May ET fallback, June SMAP,
  window association, export, edited boundary, offline save/replay/removal and missing
  package; 1024/390 px layouts. Existing history and core comparison browser regressions
  pass, including priority reversal, constraints, export and offline recalculation.

Storage: sources **75,982,452 bytes** in private provider cache; public derived package
**730,191 bytes**, SHA256
`aad7495b22ec5cebc8cc50caf6121135467c81c9d09db1d172c6a8285af54aee`.
No credentials or signed URLs exported. Local verification reports:
`artifacts/atlas-ecostress-verification.json`, `artifacts/ecostress-replay.json`,
`artifacts/atlas-history-verification.json` and core browser report/screenshots.

### Remaining acceptance criteria and scientific limits

No current authentication blocker. June ET/ESI is unavailable under retained QA;
this is a scientific coverage limitation. One May ET date does not support June or
seasonal water totals. Broader ECOSTRESS coverage and Collection 003 reprocessing
remain future work. Independent local LST/ET evaluation, calibrated uncertainty and
canopy/soil partitioning remain unfinished. CWSI, automatic stress/damage diagnosis,
bare-soil/residue classification and causal rotation benefits remain withheld.
Software checks do not establish agronomic calibration. March–November SMAP/IMERG
expansion remains resumable but was not launched in this increment.

## June seasonal delivery — verified 13 November 2026

- [x] Inspected actual SPL4SMAU.008 companion diagnostics and primary product
  specification (v1.7, 23 June 2025; documentation checked 12 November 2026).
  Four selected analysis arrays match the retained 96,279,390-byte original file
  exactly. Surface/root-zone ensemble SD describes analysis snapshots, not GPH
  three-hour means, calibrated total uncertainty, field accuracy or confidence.
- [x] Verified NASA OPeNDAP native-index subsets against representative full
  L3, GPH, AUP and IMERG files, including coordinates and time bounds. NetCDF
  character-array encoding is normalized only for comparison. Auto-generated
  x/y dimension placeholders are not used as geolocation; native lat/lon is used.
- [x] Completed **June 1–30 2024**, UTC end exclusive July 1, with 1,950
  authenticated scientific subsets. No failed downloads remain. Resume verified
  after interruption: 1,306 IMERG files reused, remaining 134 acquired.
- [x] Offline processing → compact monthly archive/index → read-only evidence API
  → dated regional maps/timeline → reviewed-window comparison → report export.
- [x] Explicit monthly load/save/remove controls; checksummed device cache survives
  offline replay. Only the small index enters the automatic offline core. Monthly
  data are never automatically installed. Storage eviction remains possible.
- [x] Real-file decoding/QA, missing and duplicate intervals, snapshot uncertainty,
  native support, provenance, export and offline tests; independent byte-identical
  processed replay; production build, lint, type checks and browser regressions.
- [x] Historical June scope expanded: March–November acquisition/verification is now complete. June was the bounded
  delivery; broader seasonal coverage is NOT claimed.

### Actual acquired coverage and withholding

| Product | Processing version | June acquisition | Usable evidence |
|---|---|---|---|
| SPL3SMP_E.006 | R19240 | 30 daily files / 60 AM-PM slots | 87/540 neighborhood cell-times accepted; **0/60 at nearest pilot cell** under unchanged conservative QA. Missing overpasses and rejected values retained with raw values, flags and reasons. |
| SPL4SMGP.008 | Vv8012 | 240 three-hour means | All 240 nearest-cell surface/root-zone means pass native fill/range checks; 30 complete daily root-zone means. Land-model assimilation, 9 km grid, 0–5 / 0–100 cm. |
| SPL4SMAU.008 | Vv8012 | 240 analysis snapshots | Surface/root-zone means and ensemble SD retained separately; native units m3 m-3, fill -9999, mean range 0–0.9, spread range 0–1. Research diagnostics, not validated predictive intervals. |
| GPM_3IMERGHH.07 | V07B Final | 1,440 half-hour intervals | 30 complete nearest-cell UTC daily accumulations; actual 1,800-second bounds, rates mm/hr, quality index and RMS error retained. Missing intervals withhold full totals; partial sums and time coverage remain explicit. |

L3 9 km posting does not improve the approximately 36 km radiometer footprint.
Regional grid geometry remains fixed to Iowa pilot support and does not move with
farmer boundary edits. Farmer-window association still requires the recorded
boundary. Daily maps aggregate within native cells; no spatial downscaling.
L4 snapshot spread is never attached to GPH means. No independent-error summation,
seasonal climatology, standardized anomaly, stress diagnosis or cover classification.
POWER, IMERG and L4 share inputs; comparison is not independent confirmation.

### Measured resources and bounded-scope decision

Before acquisition, full-file June was estimated at 68.9 GB excluding AUP versus
66.3 GB free disk; March–November approximately 632 GB excluding AUP. Regional
server subsets solved this storage problem without resampling. Retained June subset
bytes: L3 1,995,185; GPH 9,456,720; AUP 12,334,080; IMERG 80,946,516 — **104,732,501
bytes** plus receipts. Original representative files remain in the private cache.
Public June JSON is **3,367,513 bytes**; full report export is larger because it
includes other evidence and indentation. No signed URLs or credentials are retained.

Measured per-request medians: L3 4.14 s, GPH 2.29 s, AUP 2.73 s, IMERG 2.00 s.
June accumulated ~4,147 request-seconds plus per-request spacing; two workers imply
approximately 39 minutes of active acquisition, excluding outages/catalog overhead.
March–November scales to 17,875 requests, ~960 MB compact native subsets and roughly
six hours at that rate (remaining eight months ~5.3 hours). This is impractical for
this bounded interactive delivery; resumable commands are retained in
`backend/atlas/EARTHDATA_SETUP.md`. No unresolved authentication/provider gate exists.
Acquisition never relaxes QA, substitutes missing rain with zero or changes forcing.

### Verification and next acceptance criteria

81 frontend tests and 25 Python checks passed. Lint, generated route types, TypeScript
and production build passed (Next's sandboxed subprocess failed initially; build
succeeded with approved subprocess access). Restored missing Python test dependency
`requests`; no scientific test failure remains. Browser checks passed June loading,
18 mapped native cells, date changes, uncertain farmer window comparison, full source
export, explicit cache save/reopen/remove, missing offline month withholding, and
1024/390 px layouts. Existing history regression passed Landsat/POWER, confirmation,
boundary edits, missing evidence and offline behavior. Seasonal boundary withholding/restoration also passed. The existing comparison browser regression passed four strategies/four years, tri-state constraints, preference reversal, sensitivity, export and offline recalculation. Screenshot visually reviewed.
Independent network-free replay produced byte-identical monthly JSON/index. Original
`iowa.json` forcing SHA-256 remains `80a1c801e7cefebc404c9c4ed1a8323626a4f2e7d2abac90e19456f9fd8055a7`.
No scoring or simulation engine changes in this seasonal increment.
Reports: `artifacts/nasa-season-replay.json`, `artifacts/atlas-season-verification.json`,
and existing history/comparison browser reports. Full-file cache is required for the
real-file equivalence Python test; public processing and browser replay need only the
compact archive. Local .env values were checked against exported files without display.

Next: acquire remaining months one at a time, process each month explicitly, verify
all counts/QA and replay, then expose the additional index entries. Test cross-month
window aggregation before claiming complete March–November window totals: the current
view deliberately compares only one loaded month, so longer windows are partial.
Independent field soil-moisture observations, depth/time matching and representative
labels are still required for local calibration or reliable cover detection. Software
verification does not establish calibrated agronomic benefits.

## Authenticated SMAP / IMERG integration — 12 November 2026

Earthdata authentication and GES DISC agreement gates are resolved. Credentials
are explicitly loaded from ignored `.env` with interpolation disabled, never sent
to the browser or retained in reports. No fallback acquisition was repeated.

- [x] SMAP L3 V006 daily file and L4 V008 GPH files authenticated and inspected.
- [x] IMERG Final V07B representative file inspected, then expanded to 48 intervals.
- [x] Native 3×3 subsets, full-file and subset hashes, exact units, fill and QA.
- [x] Evidence API/static loading, regional registry, dated maps/tables, exports,
  complete/partial rainfall coverage, offline core package and native subset caching.
- [x] 75 frontend tests, 17 Python checks, lint, types and production build.
- [x] Offline processing replay: 51 outputs byte-identical; POWER forcing unchanged.
- [x] Final production/static browser missing-package check and final review.
- [x] Broader seasonal coverage and L4 diagnostics now delivered; local scientific validation remains a separate requirement above.

Actually acquired and integrated:
- **SMAP surface:** SPL3SMP_E.006, R19240, June 1 2024 AM/PM. Full native file
  690,081,639 bytes. Six of eighteen surrounding cell-time retrievals pass the
  conservative flag/range policy; both nearest-pilot retrievals are withheld.
  Missing error estimates remain null. Native posting is 9 km; radiometer footprint
  approximately 36 km with ~33 km contributing domain. No field moisture claim.
- **SMAP assimilation:** SPL4SMGP.008, Vv8012, June 1 2024 00:00–03:00 UTC mean,
  149,588,024 bytes. Eighteen cell/layer values (surface 0–5 cm, root zone 0–100 cm)
  pass native fill/range checks. This is model output, not retrieval QA or calibration.
  GPH lacks the selected uncertainty fields; AUP diagnostics remain unacquired.
  An earlier representative 149,190,608-byte file ending at midnight is retained
  privately but excluded from the June 1 numerical package. Bounds come from the
  file's explicit UTC Metadata/Extent, not a guessed J2000 conversion.
- **IMERG:** GPM_3IMERGHH.07 V07B, June 1 2024, 48 actual half-hourly files,
  409,701,748 bytes. All 432 neighborhood cell-interval rates are valid. Pilot-cell
  precipitation is 1.33 mm over the complete UTC day (regional estimate). Rate units
  mm/hr × actual 1,800-second bounds; incomplete totals are withheld, with partial
  sums and valid seconds shown separately. Quality index and RMS error are retained,
  not converted to invented probabilities or independent uncertainty intervals.

`backend/atlas/acquire_nasa_pilot.py` resumes bounded acquisition; its cached L4
resume was verified. Full scientific files and manifests stay in ignored
`backend/.provider_cache/earthdata/`. `nasa_context.py` performs network-free
processing into `frontend/public/atlas/nasa-context.json` and fifty native subset
JSON files. All source IDs, unsigned source URLs, full-file hashes, coordinates,
attributes and subset hashes are retained. SMAP local grid outlines use adjacent
coordinate midpoints and are explicitly approximate, not footprint boundaries.

The evidence API merges this package without changing field observations or
boundary association; an edited field cannot turn these fixed regional cells into
field measurements. Exports retain the package and original simulation provenance.
L4 metadata identifies IMERG-derived precipitation forcing (`IMGv7BFnCPCUcorrv3`);
POWER/IMERG also share meteorological inputs. Agreement is not independent evidence.
No rotation scoring, weather forcing, vulnerability classification or irrigation
calculation changed. This first verified slice is one day, not a seasonal record.

Verification reports: `artifacts/nasa-offline-replay.json`,
`artifacts/atlas-history-production-verification.json`, and
`artifacts/atlas-history-static-verification.json`. Production/static history
checks passed maps (27 native cells), timeline selections, 100% versus partial
coverage, export, previously viewed native-subset replay, preserved farmer history,
and tablet/phone layout without exceptions. Final missing-NASA-package checks pass: values are withheld, and farmer
records remain intact. The 51 public JSON assets contain no configured credential
values; pipeline hashes and diff whitespace checks pass. The native-grid screenshot
was visually reviewed; displayed units and withheld cells are readable. The existing
production comparison regression also passes four strategies/four years, tri-state
constraints, priority reversal, 34 sensitivity cases, export/sync, accessibility
and offline recalculation, with no browser exceptions. Approval-service usage exhaustion briefly interrupted checks; it was
resolved on resume, not an outstanding access blocker.

Next acceptance criteria: expand beyond the bounded day with resumable configurable
periods and explicit completeness; acquire L4 AUP diagnostics before offering model
uncertainty; independently evaluate regional-to-field representativeness and any
agronomic inference. Historical checkpoint: June expansion, AUP diagnostics and ECOSTRESS/GRACE integrations are delivered in later sections above.

## Prior `.env` authentication gate — 12 November 2026

- [x] Explicitly load ignored root `.env` with python-dotenv (interpolation disabled), without shell sourcing or credential output.
- [x] Authenticated SMAP surface download and real HDF5 inspection.
- [x] Diagnose authenticated IMERG refusal: **HTTP 403, EULA Acceptance Failure**.
- [x] Historical operator agreement/access blocker resolved; authenticated IMERG seasonal acquisition now complete.
- [x] Historical unfinished integration resolved by the verified seasonal delivery above.

Credentials are now present; older absent-credential reports below are historical.
Earthdata requests succeeded and NSIDC served `SMAP_L3_SM_P_E_20240601_R19240_001.h5`
(SPL3SMP_E.006, 2024-06-01), 690,081,639 bytes, SHA-256
`60cd18d244a9ece3359524c15f7318427ee8f9079eafe7db400508e9f3a6dfc3`.
The full file is retained in ignored `backend/.provider_cache/earthdata/` for resume.
HDF5 metadata confirms ECS version 006 / R19240; inspected AM/PM dimensions,
coordinates, units, fill values, UTC times, retrieval/surface flags and uncertainty.
The nearest Iowa cell is row 267, column 924 (42.043377, -93.687759). Both AM and PM
have retrieval flag 1 (uncertain), surface flag 8 (urban bit), and error fill -9999.
Both numerical summaries are withheld; missing uncertainty is not zero uncertainty.
Coordinates must be matched in the full two-dimensional coordinate arrays: a single
edge row/column contains unsuitable values and is not a reliable lookup vector.
This surface retrieval is not L4 root-zone assimilation; L4 was not acquired this run.

IMERG `3B-HHR.MS.MRG.3IMERG.20240601-S000000-E002959.0000.V07B.HDF5`
returned HTTP 403 directly from the GES DISC data service with JSON error description
**EULA Acceptance Failure** and Earthdata Login as the resolution host. This is a
provider agreement gate, not absent credentials, an inferred invalid password, or
an observed proxy failure. No IMERG scientific file or schema was acquired.
See the newest section of [EARTHDATA_SETUP.md](../backend/atlas/EARTHDATA_SETUP.md)
for the operator action and `.env`-aware verification command.

Stopped dependent integration work at this gate, as requested. No fallback capture,
application, scoring, forcing or public-evidence changes. No new UI/export/offline
capability is claimed. Verification this run: authenticated HTTP results, full SMAP
SHA-256 and HDF5 schema/QA assertions, `.env`/cache ignore checks, sanitized report
secret scan, and diff whitespace check. No build/browser rerun for this access-only
change. Reports: `artifacts/earthdata-authenticated-check.json`,
`artifacts/gesdisc-diagnosis.json`, `artifacts/smap-representative-inspection.json`.

## Historical authentication follow-up (resolved) — 12 November 2026

- [x] Re-read mandatory requirements and setup; inspect supported credentials safely.
- [x] Retry one SMAP surface and one IMERG scientific-file GET with network access.
- [x] Record separate credential, redirect, authentication and authorization states.
- [x] Historical credential blocker resolved by subsequent authenticated acquisitions (see current deliveries above).

Both native-file requests followed HTTP 302 from their provider to Earthdata Login
and ended in HTTP 401 at `urs.earthdata.nasa.gov`. No scientific files acquired;
no new products/dates integrated or QA coverage established. Supported environment
credentials and home/override netrc are absent. Invalid authentication and missing
provider authorization cannot yet be tested. Initial sandbox transport failure was
resolved by the network-enabled retry; it is not the remaining blocker.

Exact local interactive setup, account authorization and two-provider verification
commands are in [EARTHDATA_SETUP.md](../backend/atlas/EARTHDATA_SETUP.md#exact-local-fix-and-verification).
Sanitized report: `artifacts/earthdata-auth-diagnosis.json`.
Stopped access-dependent work as requested; did not repeat fallback acquisition or
change application code, forcing, scoring, UI or archives. Verification this follow-up:
credential-presence checks, actual provider GET/redirect traces, primary authentication
documentation review, report assertions and diff whitespace check. No adapter tests,
build or browser rerun is claimed for this documentation-only follow-up; prior verified
prototype results below remain historical results. Next gate is real authenticated
HDF5 acquisition and checksum/schema verification before numerical adapters.

## Historical NASA integration continuation — 12 November 2026

- [x] Credential resolution and representative SMAP L3/L4 / IMERG V07 download links checked without exposing secrets.
- [x] Independent POWER 2005–2024 history acquired and decoded; original 2013–2024 model forcing retained.
- [x] Bounded April 2023 Landsat season acquired with resumable native capture and explicit period coverage.
- [x] API/static merge, dated maps, captured-period controls, 20-year seasonal context, export and offline package wired.
- [x] Real-file/QA/missingness/provenance checks, lint, TypeScript and production build.
- [x] Final browser workflow/visual review and final diff verification.
- [x] Historical credential blocker resolved; June SMAP/IMERG delivered. Broader seasonal coverage remains pending for scope/cost, not authentication.

**Access result:** no Earthdata environment pair, token or netrc entry is
configured. Public CMR lookup found representative granules, but native scientific
HTTPS requests returned **HTTP 401 for all three**: SPL3SMP_E.006,
SPL4SMGP.008 and GPM_3IMERGHH.07 (catalog filename V07B). No scientific file was
acquired or decoded. The exact failing steps are credential resolution and the
unauthenticated protected-file request. Required operator action is Earthdata
Login setup outside the repository plus DAAC authorization (including GES DISC),
then a single-granule retry. See [setup and attempted granules](../backend/atlas/EARTHDATA_SETUP.md)
and the safe `frontend/public/atlas/access-attempt.json`. No credentials, response
bodies or signed URLs are retained. No uninspected SMAP/IMERG variables or numeric
outputs were activated. Surface retrieval and L4 assimilation remain separate
pending roles; IMERG rate/interval/uncertainty decoding remains unverified.

**Actually acquired and integrated:**
- POWER: eight additional yearly responses for 2005–2012, combined with the
  retained archive into 7,305 UTC days for 2005–2024, zero missing required values.
  Source coordinate, dates, source families, units and fill metadata checked;
  all twenty raw hashes and every decoded row verified. Existing 4,383 rows match
  exactly. `power-history.json` is context only; `iowa.json` and scoring are unchanged.
- Landsat: April 1–30, 2023 has 7 discoveries, 5 acquired Tier 1 windows/native maps,
  2 usable field summaries, 3 QA-withheld summaries and 2 Tier 2 exclusions.
  `landsat-seasons.json` retains all dates and explicit coverage; combined API/export
  has 73 discoveries across two bounded periods. Intervening dates are unacquired.
- Authenticated SMAP/IMERG: **none**. Existing MODIS, soil and terrain evidence preserved.

`/api/atlas/history` serves the regional baseline, with a cached static fallback.
The field evidence API and static loader share the additional-season merge and
boundary/QA checks. History exposes captured-period controls and a same-calendar
season comparison across twenty years. Incomplete rainfall totals, duplicate UTC
days and invalid leap dates are withheld; complete-period means disclose their
sample count. The 20-year baseline is descriptive, not a projection or station
calibration. Export keeps historical and model-forcing provenance distinct.
No automatic bare-soil/residue labels or new vulnerability windows are invented.

Verification completed: **72 frontend tests, 14 Python checks**, ESLint, TypeScript,
and production build pass. Fresh-directory offline replay reproduced both new
JSON archives and all five native date maps byte-for-byte (7 outputs). Original
forcing and primary field-pack hashes are recorded in
`artifacts/atlas-extension-replay.json`. Production and static history browser
checks pass: April 2023 dated maps online/offline, twenty-year seasonal context,
missing-weather withholding, boundary association, record correction, save/export,
and tablet/phone layouts with no overflow or browser exceptions. The production
comparison regression also passes constraints, priorities, four-year comparison,
save/export and offline behavior. The twenty-year context screenshot was visually
reviewed. Reports: `artifacts/atlas-history-production-verification.json`,
`artifacts/atlas-history-static-verification.json`, and
`artifacts/atlas-production-verification.json`. Final diff whitespace check passes;
new pipeline provenance hashes match and captured JSON contains no signed URL or
bearer-token matches. The temporary approval-service usage limit that interrupted
the static check was resolved on resume; it is not an outstanding blocker.

Next unfinished acceptance criteria: authenticated representative SMAP/IMERG
scientific-file inspection, exact packing/QA/coordinate/time/uncertainty tests,
then bounded native-support seasonal adapters and accumulation with explicit
missing intervals. These cannot be replaced by catalog metadata or synthetic
fixtures. Independent local labels, field measurements and agronomic evaluation
remain prerequisites for calibrated detection or quantitative benefit claims.

## Historical evidence continuation — 8–9 November 2026

Re-read the mandatory context and audited actual model, scoring, acquisition,
storage and UI code. Baseline: 53 frontend tests pass. The previous checklist
covered the comparison workflow, **not** historical vulnerability exploration:
three cloud-selected images and a modeled calendar do not establish field history.
Existing user changes, including `docs/ROTATION_ATLAS.md`, are preserved.

- [x] Fix clover/early-maize calendar overlap; regression check.
- [x] Replace three-scene selection with configurable, paginated seasonal capture;
      retain rejected dates, acquisition failures, native windows and QA coverage.
- [x] Historical timeline: observed indices, explicitly uncertain review intervals,
      dated management records and farmer-confirmed windows; no NDVI soil classifier.
- [x] Join reviewed windows to unperturbed historical POWER rainfall/heat with
      independent variable missingness, UTC dates and regional support visible.
- [x] Persist/export records with boundary association, migration and validation;
      preserve offline operation and the four-year comparison.
- [x] Continue mission access checks in dependency order; implement accessible
      useful context only after representative-file QA. Record exact auth setup.
- [x] Scientific/API/storage tests, typecheck, lint, build, browser/tablet/offline.

Reversible choices: the default history season is **1 March–30 November 2024**,
including post-harvest acquisition opportunities. Existing saved date preferences
are preserved. Capture dates are configurable; the UI filters archived subperiods
without claiming live acquisition. Every discovered L8/9 date is retained; Tier 2
is explicitly excluded from field indices. No temporal interpolation or automatic
bare-soil/residue classification. Weather event thresholds are user exploration
assumptions, not calibrated erosion or heat-damage thresholds.

Completed continuation evidence and checks:
- 66 March–November discoveries: 53 Tier 1 native windows and dated maps, 17 usable
  field summaries, 36 QA-withheld summaries, 13 explicit Tier 2 exclusions. No
  acquisition failures. Native geometry, QA fractions, timestamps and hashes retained.
- 16 real MOD13Q1.061 regional composites acquired through NASA ORNL. CSV granule
  identities and every JSON encoded value cross-checked. Twelve regional means
  pass QA; four are withheld (including zero accepted pixels in the last period).
  They do not fill Landsat gaps, classify field cover or affect crop scoring.
- SMAP L3/L4, IMERG V07, ECOSTRESS C3 and GRACE collections verified in CMR.
  Corrected GRACE query version to `RL06.3Mv04`. Representative scientific files
  were blocked at this historical checkpoint; credentials and representative-file
  acquisition are now resolved in the deliveries above. Setup reference:
  [EARTHDATA_SETUP.md](../backend/atlas/EARTHDATA_SETUP.md). NASADEM/SSURGO/POWER
  retained; GEDI excluded from annual-crop interpretation.
- Fixed clover/early-maize calendar overlap: planting on/before template termination
  fails feasibility and cannot be scored. Historical records remain independent
  of future management assumptions. Boundary confirmation appears in review flags.
- 66 frontend tests, 11 Python scientific/archive checks, ESLint, TypeScript and
  the production build pass. API round-trip/rejected confirmation, legacy draft
  migration and export with unavailable weather are covered.
- Independent offline replay reproduced **56 outputs byte-for-byte** (combined
  JSON/GeoJSON, MODIS context, 53 dated maps). All 12 POWER raw hashes still match;
  pipeline hashes match; no signed URL or bearer token was found in captured JSON.
- Production comparison browser check passes with the expanded archive: constraints,
  priorities, 4-year members, maps, export, sync, tablet/phone and offline behavior.
  Seasonal-history checks also pass on production and static serving: no-data
  season, uncertain interval review, confirmation validation, management correction,
  boundary reassociation, native date maps, MODIS context, save/export, and actual
  offline reload. Removing weather from both browser caches withholds totals while
  preserving history and export. Static HTTP caching required a stricter failure
  fixture; this was a test setup issue, not fabricated application weather.
- Visual review at 1024 px and 390 px confirmed no page overflow. Timeline labels
  were enlarged and the scroll region made keyboard-focusable; dated tables supply
  text alternatives. Screenshot/browser fixtures are explicitly test records, not
  acquired observations or farmer labels. No browser exceptions.
- Verification artifacts: `artifacts/atlas-production-verification.json`,
  `atlas-static-verification.json`, `atlas-history-production-verification.json`,
  `atlas-history-static-verification.json`, and `atlas-evidence-verification.json`.
  All are local ignored test artifacts. Final diff/whitespace review passed.

Remaining acceptance gates are scientific/access gates, not missing UI wiring:
Earthdata account authorization plus representative-file QA for pending missions;
dated local cover/residue labels and independent detection validation; confirmed
cropped boundaries, soil/management inputs and multi-season validation before
quantitative agronomic reliance. The default NDVI/gap rule currently proposes no
review pairs in this captured season; it does not invent windows. Farmers can
record known or explicitly uncertain intervals and adjust exploratory filters.

The preceding run was interrupted by an automatic approval-review usage limit
while requesting public MODIS data. Resumed successfully on 9 November; there is
no remaining approval-review blocker. No deployment or purchase occurred.

## Scope and repository baseline

Extend the existing Iowa Rotation Atlas locally; no deployment or purchases.
Read `AGENTS.md`, `docs/context/challenge_context.md` and
`docs/context/video_context.md` before work. Their material requirements are
farmer decision authority, three-way rotation comparison, multi-scale evidence,
visible uncertainty and trade-off matrices. Coarse data must remain contextual.

The repository actually contains Next.js 16/React 19, a TypeScript water/scoring
model, 2013–2024 POWER archive, offline shell, comparison/decision APIs and optional
Python acquisition helpers. Baseline frontend checks: 32 tests passed. The
blueprint Python scorer was inspected as reference only; it is not a production
dependency. The pre-existing untracked `docs/ROTATION_ATLAS.md` is preserved.

## Implemented decisions

- Retain the current stack and four useful strategy templates. TypeScript is the
  single simulation/scoring authority; Python acquires and quality-checks evidence.
- Compare 2027–2030 using paired 2013–2016, 2017–2020 and 2021–2024 weather blocks.
  Identical initial states reset between members; states carry within four years.
  These are historical sensitivity members, not probabilities or a 20-year baseline.
- Preserve annual overview metrics and expose four-year member totals, paired
  differences, terminal states, operations and a full four-year calendar.
- Tri-state hard constraints precede preferences. Unconfirmed baseline, boundary,
  labor, buyers, equipment and suitability remain explicit. Essential missing
  physical inputs withhold simulation. Unknown feasibility withholds ranking.
- Versioned normalization `iowa-four-year-v1` uses fixed ranges independent of the
  option set. All three physical objectives determine mean Pareto status. Scores
  are optional; farmer selection is separate from the inspected card/preference.
- Water accounting includes snow, runoff, drainage, ET, inlet withdrawals,
  applied irrigation and explicit losses. Residue evaporation and perennial
  establishment are simplified and labeled. Unsupported carbon/erosion/pest
  quantities and probabilities are null.
- Captured evidence has native spatial support, QA and provenance. Edited
  boundaries cannot inherit the demo's field observations. SSURGO AWC is not
  silently extrapolated from 1 m to the model's 1.5 m profile.
- Preserve offline operation. API evidence has a local package fallback; processed
  evidence and the overview map are precached. Dated maps/raw downloads cache on access. Existing device
  drafts migrate without inventing farmer confirmation.
- Applied the Sites skill's local workflow only, including a bounded evidence
  research task. No Sites registration, publishing or deployment was performed.

## Acceptance checklist

- [x] M1: shared field, initial state, four-year paired members, farmer-confirmed baseline.
- [x] M1: pass/fail/unknown constraints, explicit missingness, fixed scores, Pareto trade-offs.
- [x] M2: daily water conservation, interannual state, management/residue/irrigation effects.
- [x] M2: yield/N/economic assumptions visible; unsupported quantities withheld.
- [x] M3: archive/tool inventory, source hashes, real Landsat and local soil integration.
- [x] M3: QA → stored assets → evidence API → visible maps/tables → offline package.
- [x] M3: additional missions assessed; pending/excluded products do not supply observations.
- [x] M4: field → history/constraints → evidence → compare → priorities → review → save/export.
- [x] M4: farmer corrections, full timeline, tablet/mobile layout and accessible labels.
- [x] M5: scientific/API/storage tests, typecheck and production build.
- [x] M5: browser missing inputs, failed/unknown constraints, priorities, export and offline.
- [x] M5: final build/browser recheck after visual/API-fallback fixes; final diff reviewed.

## Original comparison verification — 7 November 2026

- Initial working tree: only `?? docs/ROTATION_ATLAS.md`; preserved unchanged.
- Four-year model/scoring checks cover mass balance, paired deltas, initial resets,
  annual carry-over, residue evaporation, gross/net irrigation, missing evidence,
  fixed normalization, direction/unit rejection and changed preferences.
- Frontend suite expanded from 32 to 53 tests; all pass.
- Six stdlib evidence tests passed: real archived asset hashes, reflectance scaling,
  QA bits, AWC depth weighting and gap/overlap withholding. All 12 POWER raw hashes
  match; current capture-script hash matches its recorded provenance.
- Independent offline reprocessing in a fresh pinned geospatial environment
  reproduced `field-evidence.json` and `field-evidence.geojson` byte-for-byte.
  Re-normalizing all 12 POWER raw responses also reproduced every one of the
  4,383 daily rows exactly, with native-unit and UTC checks.
- Final production build/typecheck and ESLint passed after all application changes.
  One sandboxed Next/TypeScript subprocess failed to parse its output; the same
  build passed outside that restricted subprocess sandbox.
- Final Chrome checks passed against both production Next.js and standalone static
  serving (independent profiles; no API required for local use). Workflow: four strategies/four years, missing
  soil, failed and unknown market, preference reversal, separate farmer choice,
  map layers, insufficient Landsat QA, new-boundary gating, JSON export, 34-case
  sensitivity, forced-colors keyboard focus, 1024 px tablet/390 px phone, offline
  reload/recalculation, and queued save/sync after reconnect. No browser exceptions.
- Visual review found and fixed sidebar overlap at tablet widths and missing
  padding on the new evidence tables. Screenshots and exported reports are under
  ignored `artifacts/`; final browser verification JSON is `artifacts/atlas-browser-verification.json`.
  Static-host verification is also saved as `artifacts/atlas-static-verification.json`.
- Local server and network installs needed sandbox exceptions; no deployment.
- Final diff/whitespace review passed. No credentials or signed download URLs were
  found in captured JSON. The existing untracked requirements document is untouched.

## Acquired evidence and exact remaining gaps

| Source | Actual integration | Remaining limitation |
|---|---|---|
| POWER | Original 4,383 model-forcing days (2013–2024) unchanged; separate 7,305-day historical context (2005–2024), all raw hashes and decoded rows verified | Regional MERRA-2/SYN1DEG context, not station calibration; historical baseline does not replace model forcing |
| Landsat | 73 L8/9 C2 L2 discoveries across March–November 2024 and April 2023; 58 real native band/QA windows and dated maps | 19 usable field summaries, 39 QA-withheld, 15 Tier 2 exclusions; intervening periods unacquired; no calibrated crop/residue classifier |
| SSURGO | Actual SDA map polygons/components/horizons, IA169 revision 2026-09-08 | Conditional 0–100 cm AWC 186.40 mm on 92.5267% supported area; survey mixtures, not tests; boundary includes water/steep land |
| NASADEM | Real native `NASADEM_HGT_n42w094` height window and terrain summary | NUM/SWB source/water masks absent from mirror; no frost, routing or soil-loss output |
| SMAP | March–November 2024: 275 L3 files, 2,200 L4 means and 2,200 AUP snapshots; seasonal/cross-month maps, APIs, exports and explicit offline | 723/4,950 L3 cell-slots accepted; nearest pilot 0/550. L4 is regional assimilation; snapshot ensemble spread is not total uncertainty; no local calibration |
| IMERG | March–November 2024 Final V07B: 13,200 half-hour intervals, 275 complete nearest-cell days; nine-month production/static workflow verified | Missing or corrupt packages withhold complete totals; partial overlap assumes constant interval rate; no gauge calibration |
| ECOSTRESS | Collection 002: all 17 June LST granules plus June 27/28 JET/ESI and May 23 fallback; maps/API/export/explicit offline | Usable June LST June 11/23; June ET/ESI rejected; May 23 usable ET/ESI is not June coverage; no stress diagnosis |
| GRACE | JPL CRI RL06.3Mv04 authenticated full file; six whole mascons, 210 monthly estimates / 30 gaps during 2005–2024; regional archive/API/UI/export/offline | 2004–2009 anomaly baseline; no gain scaling, trend or groundwater inference; full covariance and systematic uncertainty unavailable |
| MODIS | 16 real MOD13Q1.061 composites, JSON/CSV collection and values verified; registry/API/UI/export/offline integrated | 12 usable and 4 withheld regional means; mixed 4.35 km² neighborhood, never field measurements or Landsat gap filling |
| GEDI | Excluded from annual-crop scoring | Sparse footprints/woody-biomass domain unsuitable for annual-crop outcomes; optional shelterbelt research only |

No required external credential is needed for the working scoped prototype.
Unavailable missions remain explicitly pending. No farmer trials, field
calibration, causal rotation-benefit validation or production readiness is claimed.

## Resume / run commands

From `frontend/`: `npm run build`, `npm run lint`, then
`npm run start -- --hostname 127.0.0.1 --port 4173`.
From repository root:

```
node scripts/atlas-browser-smoke.mjs http://127.0.0.1:4173 --server
node scripts/atlas-history-smoke.mjs http://127.0.0.1:4173
/tmp/fieldshift-evidence-env/bin/python -m unittest discover -s backend/atlas -p 'test_*.py' -v
```

See [capture reproduction](../backend/atlas/EVIDENCE_CAPTURE.md) for the optional
isolated geospatial environment and `--offline` reprocessing. See
[model/decision contract](ATLAS_MODEL_CONTRACT.md) for units, equations, assumptions,
normalization, source links, verification date and production evidence gates.

## Before quantitative reliance or production

- Farmer-confirmed cropped boundaries and local soil, management, cultivar,
  equipment, labor, market and enterprise-budget inputs.
- Depth/time-matched ground measurements and multi-season observed yields/water
  outcomes, plus local crop/residue labels for any future image classifier.
- Separate training, calibration and spatially blocked/forward-time evaluation;
  no shared coarse-cell leakage; baseline metrics and calibrated interval coverage.
- Evidence for alternative rotations before causal benefit claims; explicit
  out-of-domain/abstention rules and farmer/adviser usability review.
- Production identity/authorization, private durable storage, retention rules,
  monitored acquisition jobs and operational recovery. Device UUID storage is
  currently a local prototype facility.

## Final readiness audit — 14 November 2026

Scope completed: requirements/code/evidence/export/browser audit and bounded correctness/copy fixes. No mission acquisition, deployment, scoring or forcing change. New traceable matrix: [READINESS_AUDIT.md](READINESS_AUDIT.md). External work/gates: [PILOT_VALIDATION_PLAN.md](PILOT_VALIDATION_PLAN.md).

Fixed overview/chart missing POWER precipitation becoming zero: fixed 2013–2024 daily support now withholds incomplete or duplicate-day means. Added true-zero/missing/duplicate regressions. Export now explicitly flags ECOSTRESS boundary applicability and fixed-template comparison basis. UI states satellite evidence explores history rather than generating/ranking rotations; modeled shortfall is labeled accordingly. Reconciled stale current descriptions in ROTATION_ATLAS/model contract; historical release records remain historical.

Verification completed this audit:
- 101 frontend tests (19 files), 31 Python evidence tests, lint, route types, TypeScript and production build passed. Initial sandbox build failed spawning TypeScript configuration inspection; approved outside-sandbox rerun passed. Existing dependency deprecation warnings remain non-failing.
- Independent nine-month reconstruction was byte-identical; all daily IMERG sums and L4 means independently checked across nine cells. No source redownload.
- Production Chrome: field constraints (unknown/fail/pass), clearly labeled demonstration reviewed window, four strategies/three paired members, preference reversal, independent farmer choice, local-review controls, export, offline reopening/recalculation and server synchronization passed; no JS exceptions. This fixture asserts no real farmer observation.
- Static Chrome full season: all nine caches, 6,600-hour window, rainfall integration/export consistency, null nearest-pilot L3, edited boundary, missing April and corrupted March packages, offline replay/removal, 1024/390 px layouts passed; no JS exceptions. Screenshot inspected.
- Production ECOSTRESS Chrome: 24 records/121 native cells, rejected cloudy pixels, May/June date distinctions, UTC reviewed-window association, edited-boundary withholding, export provenance and explicit offline save/replay/removal passed; no JS exceptions.
- Existing forcing SHA-256 remains `80a1c801e7cefebc404c9c4ed1a8323626a4f2e7d2abac90e19456f9fd8055a7`. `git diff --check` passed. Source evidence/QA policies were not relaxed.

Actual scientific limitations remain: nearest-pilot L3 0/550 accepted retrieval slots; June ECOSTRESS LST usable on June 11 and June 23 (two of 17 granules), June ET/ESI withheld. These are not local calibration results. Seasonal acquisition/software integration is complete; scientific validation is not.

Prioritized unfinished acceptance criteria:
1. ~~Evidence-linked strategy rationale (software)~~ — delivered 14 Nov 2026 via `strategy-rationale-v1`.
2. ~~Usable reviewed local enterprise inputs (software)~~ — delivered 14 Nov 2026 via `enterprise-inputs-v1`. Human-validated quotes still required for G0.
3. Supervised participating-farm pilot: consented boundary/history/soil/market inputs and farmer/adviser task completion/comprehension evidence meeting G0/G3 in the validation plan. Current UI tests are not usability research.
4. Detection and quantitative validation: independent crop/residue labels and held-out field/season evaluation (G1/G2/G4); calibrated hydrology/yield/economic error and interval coverage with counterfactual limitations. Until then withhold automatic bare soil, stress diagnosis, protective-cover measurement, causal rotation benefits and calibrated predictive probabilities.
5. Production controls: G5 authorization, privacy, durable storage, recovery, monitoring and operational owner. Passing build/tests does not satisfy this gate.

Ready for a clearly labeled local demonstration and facilitated exploratory pilot with the above limitations. Not ready for quantitative farm reliance or production. No new external access blocker was encountered; remaining blockers are validation evidence and operational controls, not authenticated data download.
