# Atlas graph plotting audit — 15 November 2026

Scope: the current packaged Iowa evidence and Atlas model outputs. This checks
rendered values, axes, QA/missingness, dates, labels and interactions. It does not
validate satellite accuracy, calibrate crop projections or establish farm benefits.

## Findings corrected

- Rainfall bars had a CSS minimum height, making actual zero rain look positive.
  Zero now has zero height, including forced-colors mode. Incompatible non-UTC
  weather support withholds rainfall summaries instead of being silently plotted.
- Crop calendar labels previously divided each year into twelve equal-width months.
  Each row now weights its month widths by actual source-year days, including leap
  February, matching the daily crop track.
- GRACE year labels and vertical limits previously used manually placed positions.
  They now use the same scales as the points. Missing months remain unconnected.
  The field marker no longer double-counts the polygon's closing vertex.
- The L4 moisture plot now places dates by UTC calendar distance and aligns its
  tick labels with the value scale. Removing a missing point does not compress time.
- Dynamic SVG tooltips use a single string, preserving their values in React
  rendering, including server rendering.
- The preceding history-timeline fix keeps withheld dates on a separate QA row,
  with month ticks and explicit empty-lane explanations.

No acquisition files, masks, agronomic model equations, scheduled crop dates, scoring
rules or normalization ranges were changed by this plotting audit.

## Automated numerical checks

| Display | Checked against |
|---|---|
| Monthly rainfall | All 12 monthly source totals at 40%, 100% and 140%; missing/duplicate/non-UTC support; actual zero |
| Four crop calendars | All 5,844 daily marks across four strategies, date/crop labels, period totals, events and actual month widths |
| Sensitivity | Every rainfall sweep point replayed through the comparison engine; preference, color, label and reference margin |
| Historical NDVI | All 17 accepted points and 49 withheld acquisitions; date/value coordinates, zero/negative values, leap days, window clipping and empty lanes |
| L4 root-zone moisture | All 275 daily points in March–November 2024 independently recomputed from the original three-hour intervals; nulls and true zero |
| GRACE | All 210 accepted regional points independently checked against native mascon weights; 30 missing months, gap connections, ticks and map values |
| Regional SMAP/IMERG maps | Every packaged context selection and native cell; missing masks, units, tooltips and projected bounds |
| ECOSTRESS maps | All 6,171 cell/band values across 24 product records, including QA masks and units |
| Field map | Packaged Landsat pixel positions/masks/tooltips and soil-layer geometry count; existing edited-boundary gating |

Result: **166 tests passed in 30 test files**. Lint, TypeScript, production build
and `git diff --check` passed.

Numerical regression tests are in `frontend/src/app/atlas/charts-plotting.test.tsx`,
`history-timeline.test.tsx`, and `field-map.test.tsx`; existing evidence and model
tests provide the complementary processing checks.

## Browser verification

Six Chrome suites passed: focused plotting, main application, history, seasonal
evidence, GRACE and ECOSTRESS. Checks include computed rainfall heights (normal and
forced colors), actual month-track widths, rendered source values, year ticks,
filters, layer changes, exports, saved/missing evidence, offline replay and
390/1024 px layouts. No JavaScript exceptions. Screenshots were inspected.

Reproduce from the repository root with Node 22 and Chrome installed:

```sh
npm run lint --prefix frontend
npm run build --prefix frontend
npm run start --prefix frontend -- --hostname 127.0.0.1 --port 4173
```

In another terminal:

```sh
node scripts/atlas-plotting-smoke.mjs http://127.0.0.1:4173
node scripts/atlas-browser-smoke.mjs http://127.0.0.1:4173 --server
node scripts/atlas-history-smoke.mjs http://127.0.0.1:4173
node scripts/atlas-season-smoke.mjs http://127.0.0.1:4173
node scripts/atlas-grace-smoke.mjs http://127.0.0.1:4173
node scripts/atlas-ecostress-smoke.mjs http://127.0.0.1:4173
```

Run browser suites sequentially when using their default artifact directory;
several suites export the same report filename. Each uses a fresh browser profile.
The plotting suite uses a temporary DOM-only zero-value fixture to check CSS;
farmer-record fixtures in other suites are explicitly labeled and are not real
scouting observations. Graphs continue to describe the native support and limits
of their data; regional cells are not field measurements.
