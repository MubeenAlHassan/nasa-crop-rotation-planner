# Pre-merge release audit — 15 November 2026

**Assessment:** no unresolved software blockers found for the packaged Iowa
hackathon demonstration. This is a software verification result, not validation
of agronomic predictions or permission to present the tool as farm advice.
No merge, commit or deployment was performed.

The audit covered the complete working-tree changes: reviewed-window calendar
connections, feasibility guidance, graph plotting, scientific text formatting,
exports and the shared offline distribution. Simulation equations, model
parameters, scoring rules and captured observation files were not changed.

## Issues fixed during this audit

1. **Malformed PDF exports.** PDF offsets and stream lengths previously counted
   JavaScript characters while the downloaded Blob encoded Unicode as UTF-8.
   A regression test reproduced an invalid `startxref` offset before the fix.
   PDF strings now use declared WinAnsi encoding and ASCII octal escapes, making
   byte offsets and stream lengths exact. Accents, degree signs and supported
   punctuation survive. Unsupported glyphs appear explicitly as `[U+...]`;
   JSON, Word and Excel retain the original Unicode. Fixed-width text and word
   wrapping also keep long, unbroken notes within the page.
2. **Test resource contention.** Full workspace DOM tests had previously exceeded
   the normal test deadline under unrestricted parallel execution. Vitest now
   uses at most four workers; deadlines and assertions were retained.
3. **Optional pipeline environment setup.** Added the directly imported `pyproj`
   dependency to the geospatial requirements and documented Python 3.12 for
   exact evidence replay. The older repository Python 3.11 environment cannot
   install the pinned NumPy version. A preliminary run with older libraries
   differed in the last decimal places of two replay files. Python 3.12 with
   the pinned capture versions passed both original byte-exact assertions.
4. **Browser export coverage.** The main browser suite now downloads JSON, Excel,
   Word and PDF, waits for completed downloads and validates the PDF byte offset.

## Final verification results

| Check | Result |
|---|---|
| Frontend model, processing, API and UI tests | **168 passed, 30 files** |
| Native-file Python processing tests | **31 passed** |
| Clean production build with `NODE_ENV=production` | Passed after deleting only generated `frontend/.next` |
| Next route types, TypeScript and ESLint | Passed |
| Supported-input stress check | **96 scenarios; 1,152 strategy/weather members** |
| Maximum stress-check water residual | **2.274 × 10⁻¹³ mm**, below the 10⁻⁸ check limit |
| Production comparison API | Three scenarios matched local results exactly; malformed/null/oversized requests returned expected errors |
| Chrome browser suites | All nine suites passed; core and full-season suites passed on both production and static hosts |
| Layout and accessibility checks | 390/1024/1440 px where exercised, keyboard focus, forced colors, text alternatives; no page overflow or browser exceptions |
| PDFs | Parsed and rendered; byte offsets and stream lengths verified; all extracted word bounds inside printable area |
| Word/Excel | Actual browser downloads plus HTML/XML parsing, Unicode retention and markup escaping verified |
| Whitespace and script syntax | `git diff --check` and changed-script syntax checks passed |

The graph checks independently reconcile rainfall with daily forcing, crop tracks
with modeled dates, historical NDVI with QA-accepted observations, L4 means with
three-hour native intervals and GRACE means with mascon weights. Native map tests
retain coordinates, units, source values and rejection masks. See
[the numerical graph audit](GRAPH_PLOTTING_AUDIT.md) for detailed coverage.

The full-season browser check loaded March–November 2024: **6,600 hours** of
regional support. It verified API fallback in production and operation without
an API on static hosting. Both runs disconnected the page and service worker,
reloaded offline, removed April, corrupted March and checked that complete
rainfall totals were withheld in the UI and exports. Corrupt cached files were
discarded; valid remaining evidence stayed available. Edited boundaries withheld
field attribution without deleting the original records.

The observation-to-review workflow required an explicit local source note,
retained the observation/calendar chain through offline save and export, allowed
inspection without choosing a rotation, and removed calendar opportunities after
a residue-cover correction. Test scouting records were explicitly labeled
fixtures, not real field observations.

All four reported formatting sections retain list markers, hanging indents,
spacing and bounded line lengths at desktop and phone widths. Rationale limits
appear separately from the claims they qualify.

## Reproduction

Run from the repository root with Node 22 and Chrome installed:

```sh
npm run lint --prefix frontend
NODE_ENV=production npm run build --prefix frontend
npm run start --prefix frontend -- --hostname 127.0.0.1 --port 4173
```

In another terminal, run the browser suites sequentially; several download the
same report filenames into their artifact directory:

```sh
node scripts/atlas-browser-smoke.mjs http://127.0.0.1:4173 --server
node scripts/atlas-plotting-smoke.mjs http://127.0.0.1:4173
node scripts/atlas-text-formatting-smoke.mjs http://127.0.0.1:4173
node scripts/atlas-window-connection-smoke.mjs http://127.0.0.1:4173
node scripts/atlas-history-smoke.mjs http://127.0.0.1:4173
node scripts/atlas-season-smoke.mjs http://127.0.0.1:4173
node scripts/atlas-grace-smoke.mjs http://127.0.0.1:4173
node scripts/atlas-ecostress-smoke.mjs http://127.0.0.1:4173
node scripts/atlas-cross-month-smoke.mjs http://127.0.0.1:4173 --full-season
node scripts/atlas-scenario-stress.mjs http://127.0.0.1:4173
```

For static-host checks, serve the generated `dist-atlas` directory on port 4174,
run the core suite without `--server`, and run the cross-month suite with
`--static --full-season`. Plotting, formatting and window-connection suites also
passed against the static distribution during this audit.

Native processing requires the previously captured files in the ignored
`backend/.provider_cache` directory. No live acquisition was run for this audit.
Use an isolated compatible environment, leaving the repository's older Python
environment intact:

```sh
uv venv --python 3.12 /tmp/atlas-release-python312
uv pip install --python /tmp/atlas-release-python312/bin/python \
  -r backend/atlas/requirements-evidence.txt 'h5py>=3.12,<4'
/tmp/atlas-release-python312/bin/python -m unittest discover \
  -s backend/atlas -p 'test_*.py'
```

Verified versions: Python 3.12.3, NumPy 2.5.4, rasterio 1.5.2, pyproj 3.8.0,
shapely 2.2.0 and h5py 3.16.0. Original source hashes and byte-exact replay
assertions were preserved. The processors emit library deprecation warnings;
they did not affect results with this environment.

## Practical limits of this assessment

- Tests establish correct handling and display of the packaged data, not
  satellite accuracy, a calibrated bare-soil classifier, soil-loss estimates,
  yield or economic accuracy, or probabilities of future benefits.
- Unknown farm constraints and demo soil assumptions intentionally remain visible
  until supported by local information. They are not application errors.
- Farmer/adviser usability trials and agronomic validation remain outstanding.
- Browser testing used Chrome on Linux. Native Microsoft Office applications,
  other browser engines and a new hosting deployment were not exercised.
- Word exports are HTML `.doc` files and Excel exports are SpreadsheetML `.xls`
  files, as before; these are summary exports rather than native DOCX/XLSX files.
- Browser storage eviction can remove drafts or optional evidence. The app
  remains device-local and reports can be exported as backups.

Browser verification JSON, screenshots, exported fixtures and stress results are
under ignored `artifacts/` directories, including `artifacts/release/`.

## Follow-up: typography across all three pages

The initial four-section typography check was too narrow. The expanded browser
check reproduced missing numbered markers in the production method steps. Shared
reading styles now cover the explanatory sections throughout Compare rotations,
Field history & windows, and Evidence & method: readable paragraph sizes and line
lengths, paragraph spacing, explicit heading weights, bullets and numbered steps.
Inline emphasis stays within evidence-note sentences. Export menus are excluded
from prose-list styling.

The expanded check covers dataset-registry limitations, field evidence, farm
checks, model notes, decision review, calendar connections, comparison rules and
the complete history explanations. Desktop and phone checks passed on both
production and static hosts. All 168 frontend tests, lint, TypeScript, production
compilation and the main interaction/export/offline browser suite passed. No
source observations, calculations or scientific claims changed in this follow-up.

## Follow-up: Vercel build timeouts

The earlier four-worker cap was not enough for smaller CI runners. Restricting
the original test process to two CPU cores reproduced failures in the same four
files reported by Vercel: six tests exceeded the default five-second deadline.
No assertion failures or invalid evidence values were reported in that run.

The test configuration now uses at most two workers and respects a single
available CPU. The longer review workflows, exhaustive chart checks and monthly
API validations have explicit 15-second limits. Smaller tests retain Vitest's
five-second default; existing full-season tests retain their separate limits.

The two form-workflow suites omit the daily calendar component, which otherwise
rebuilds 1,461 marks after each edit. Their real inputs, comparison engine,
feasibility checks, saved drafts and correction flow are still exercised. The
calendar itself keeps its exhaustive tests in `charts-plotting.test.tsx` and the
browser suite. Each monthly API archive now has its own test and deadline, so
all nine months are still checked without sharing one timeout across the loop.
The first API test still validates the full file on both its 200 and 304 paths.

All **176 cases in 30 files** passed with one CPU and with two CPUs under
`CI=1 NODE_ENV=production`. The increase from 168 cases comes from counting the
nine monthly API checks separately. Lint and TypeScript also passed. Test reports
and build output are retained in ignored `artifacts/ci-timeouts/`. The complete
production build also passed with `CI=1 NODE_ENV=production` and two CPU cores,
including all tests, route generation, TypeScript and Next.js compilation.

To reproduce the restricted-CPU checks on Linux, choose CPU IDs allowed by the
host's affinity settings. The following commands used CPUs 0 and 1 locally:

```sh
CI=1 NODE_ENV=production taskset -c 0 npm run test --prefix frontend -- --run
CI=1 NODE_ENV=production taskset -c 0,1 npm run build --prefix frontend
```

This follow-up changes test execution and documentation only. Application code,
scientific data, checksum checks and production calculations are unchanged.
