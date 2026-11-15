# Rotation Atlas live-site audit — 15 November 2026

Tested site: https://rotationatlas.vercel.app/

The deployed comparison, history, evidence, graph, export and offline workflows
passed the nine existing browser suites. Additional checks found five UI and
accessibility problems. They are fixed in this checkout. **The fixes have not
been deployed to Vercel.**

The starting revision was `301bc25d82d3b4eff54b9b9de2dad806518e9b1f`.
Before making changes, all 1,096 deployed archive and offline files matched the
local files byte for byte. This verifies the tested assets; it does not expose
or prove Vercel's deployment commit metadata.

## Problems found and fixed

| Problem | Reproduction on the deployed site | Change in this checkout |
| --- | --- | --- |
| A review button causes horizontal page scrolling | Open Compare rotations at 320px. “Review field history and ground conditions” extends beyond its card. | Let this button wrap within the card. |
| Tables cannot always be reached or scrolled by keyboard | The Landsat observations panel scrolls vertically; several comparison and evidence tables scroll horizontally on phones. Their containers cannot receive focus. | Add keyboard focus to table scroll containers, retaining existing named regions and focus outlines. |
| Closing Farm assumptions loses the opener's focus | Focus the sidebar settings button, open assumptions, then press Escape. Focus returns to the document instead of the settings button. | Capture the opener before moving focus into the dialog. Keep forward/reverse Tab inside it and restore the opener on close. |
| The mobile export control has no accessible name | At phone widths, CSS hides the export button's text. Its icons do not provide a name. | Give the trigger an accessible label that matches its report action. |
| The overview's “+3” badge has insufficient contrast on phones | The mobile crop-circle container applies opacity to text as well as icons. The measured contrast was about 3.04:1. | Remove that mobile opacity. |

No calculation or graph-data defect was reproduced. These changes affect UI
layout, keyboard access and labels. The model, forcing, source evidence, crop
calendars and scoring functions were not changed. Rebuilding also regenerated
the offline cache revision so returning browsers can receive the updated UI.

## Verification results

| Area | Result and evidence |
| --- | --- |
| Production build | `npm run build --prefix frontend` passed, including 177 tests in 30 files, route generation, TypeScript and the Next.js production build. |
| Lint | `npm run lint --prefix frontend` passed. |
| Native data processing | All 31 Python tests passed using the compatible Python 3.12 evidence environment. Captured files were replayed locally; no new NASA acquisition was performed. |
| Browser regression after fixes | Core workflow, plotting and text-formatting suites passed against the final local production build. |
| Extra UI checks after fixes | All 22 edge-case checks passed. Eleven axe-core 4.13 scans reported no WCAG 2 A/AA or WCAG 2.1 A/AA violations in the tested states. |
| Browser engines | Chrome 157.0.8103.78 ran the live suites and final local regression checks. Firefox 159.0 passed an independent test of the fixed production build: all workspace pages at 320/390/1440px, model controls, draft restoration, source-value plots and ten additional accessibility scans. |
| Responsive layout | Landing page and all four workspace pages fit at 320, 360, 390, 768, 1024, 1440 and 1920px. The assumptions dialog also fits at 320px. |
| Deployed files | All 1,096 files returned HTTP 200 and matched local SHA-256 hashes before the fixes. Checked body size: 72,067,244 decoded bytes, including rasters, maps, receipts, indices and the offline shell. |
| HTTP and evidence APIs | All 26 HTTP/API checks passed after correcting the test's ETag comparison. Unsupported fields, regions and months return 404; retired routes return 404; the comparison endpoint rejects GET; server decision persistence remains disabled with 501. |
| Calculation stress checks | 96 local scenarios, covering 1,152 strategy/weather members, passed finite-outcome, feasibility, preference and water-balance assertions. Largest absolute water-balance residual: approximately `2.27e-13` mm. |
| Live calculation parity | Three supported requests returned exactly the same JSON from the deployed comparison API and the local engine. Three additional requests checked null, malformed JSON and oversized bodies, returning 422, 422 and 413. |
| Exports | JSON, SpreadsheetML `.xls`, HTML `.doc` and PDF downloaded successfully from the live UI. Spreadsheet model values match the JSON export. Word retains all four strategies. All five PDF pages rendered; none of the 2,381 extracted words fell outside the page. |
| Device storage | Save/reload, damaged JSON, unsupported and invalid modern draft schemas, literal markup in field names and quota failures were checked. Invalid drafts fall back safely; blocked writes leave the workspace usable and show the failure. |

The PDF is a plain text summary, not a tagged accessible document. Its existing
unsupported-character notation remains explicit; JSON, Word and Excel retain
the original Unicode text.

## Live browser workflows exercised

The nine existing suites ran against the public Vercel URL in fresh Chrome
profiles. Test observations were labelled fixtures and stayed in those profiles.
No farmer records were uploaded or changed on a server.

- **Core comparison:** all four rotations and all four planning years; unknown,
  failed and confirmed farm checks; blank soil capacity; priority reversal;
  separate farmer selection; 34 sensitivity cases; local saving; keyboard focus
  in forced colors; four export formats; offline reload and recalculation.
- **Field history:** 66 acquisitions in the main season, the additional April
  2023 archive, configurable dates, low-signal review, explicit local confirmation,
  management corrections, source maps and missing-weather withholding.
- **Graph plotting:** 17 accepted and 49 withheld Landsat dates on separate rows;
  30 June L4 points checked against archived numerical values; 210 GRACE points;
  true calendar-month widths; zero rainfall in normal and forced colors; finite
  ECOSTRESS map coordinates. Unit tests also check every native map value, mask,
  unit and geographic orientation.
- **Reviewed-window connection:** a real QA-accepted Landsat pair prompts review;
  a local note is required before confirmation; four seasonal calendars retain
  the evidence chain. Inspecting an option does not select it or alter modeled
  outcomes. Correcting the ground condition removes the connection.
- **Monthly seasonal evidence:** explicit load/save/removal, source receipts,
  native cells, QA, exports and offline replay. Monthly archives are not silently
  installed as part of the core offline pack.
- **Full-season evidence:** March–November 2024, including API fallback when the
  static April URL is blocked. All nine months cover 6,600 hours. Rainfall totals
  were recomputed from exported intervals. Removing April leaves 5,880 acquired
  hours and withholds the complete total; corrupting saved March leaves 5,136
  valid hours and discards that damaged copy.
- **GRACE:** 240 records, 210 accepted months, 30 missing months, six mascons and
  294 native posting cells; shifted source intervals, mission gaps, provenance,
  explicit offline save and missing-package withholding.
- **ECOSTRESS:** 24 products and 121 cells; May ET fallback, June LST, date
  alignment, overlapping regional context, the fully cloudy June 27 retrieval,
  exports and explicit offline controls.
- **Text formatting:** adviser assumptions, reliable-detection requirements,
  regional NASA context, rationale, numbered method steps and export controls.
  The 24px gap after the rotation cards was checked at desktop and phone widths.

Boundary changes were tested throughout. Original observations and local
records remain available for provenance, while field-specific attribution is
withheld until the boundary matches again. Missing data never become zero.

Offline tests disabled network access for both the page and its service worker.
Throttling the page alone would leave the worker online and give a false pass.

## Test-runner corrections

Some first attempts exposed assumptions in the test scripts rather than product
failures. These were investigated and rerun:

- One fresh workspace exceeded an old 15-second startup deadline. The remote
  seasonal suites now use a bounded 60-second wait. Later fresh-profile runs
  loaded successfully; no persistent bootstrap failure was reproduced.
- ECOSTRESS became ready before the independently loaded seasonal index. Its
  test now waits for the June option and explicitly selects that month.
- Vercel can return a weak ETag on a compressed 200 response and its equivalent
  strong ETag on 304. Conditional requests succeeded. The deployment test now
  compares equivalent validators instead of requiring identical prefixes.
- Contrast scans now freeze reveal animations. Measuring during a fade had
  reported temporary blended colors on the landing page. Stable scans passed.
- An intentionally incomplete legacy draft is accepted by the existing migration
  path. The damaged-draft test now uses an invalid modern schema to test rejection
  without incorrectly rejecting supported migration.

## Repeatable checks and artifacts

The production checks are read-only apart from isolated browser drafts and cache
fixtures. Run from the repository root:

```sh
npm run build --prefix frontend
npm run lint --prefix frontend
node scripts/atlas-deployment-smoke.mjs https://rotationatlas.vercel.app
node scripts/atlas-scenario-stress.mjs https://rotationatlas.vercel.app
node scripts/atlas-browser-edge-smoke.mjs https://rotationatlas.vercel.app
node scripts/atlas-firefox-smoke.mjs http://127.0.0.1:4173
```

The deployment script compares the site with the current checkout. Until these
fixes are deployed, a new full run will correctly report changed UI/offline
assets. To check only routes and APIs without comparing local UI assets:

```sh
node scripts/atlas-deployment-smoke.mjs https://rotationatlas.vercel.app \
  artifacts/live-audit/http-api-recheck --api-only
```

Existing browser suites also accept the target URL as their first argument.
Run them in separate working directories, or sequentially: several deliberately
download reports with the same filename. The full-season suite needs
`--full-season`; the core suite uses `--server` for production route checks.

Raw results, downloaded reports and screenshots are under
`artifacts/live-audit/` and are ignored by Git. Important records include:

- `core/artifacts/atlas-browser-verification.json`
- `http/verification.json` — archive hashes; original ETag assertion failures
- `http-api-recheck/verification.json` — corrected HTTP/API checks, all passed
- `scenario-stress.json`
- `full-season/artifacts/atlas-full-season-verification.json`
- `edges-recheck/verification.json` — confirmed deployed UI defects
- `final-edges/verification.json` — all 22 checks passed after the fixes
- `local-final-core/artifacts/atlas-browser-verification.json`
- `local-final-plotting/artifacts/plotting/verification.json`
- `local-final-formatting/artifacts/text-formatting/verification.json`
- `firefox-final/verification.json` — second-engine checks of the fixed build

## Limits

Automated tests and numerical checks establish consistency with the implemented
model and captured evidence. They do not calibrate yields, costs, soil-water
capacity or cover detection against farms. Three historical weather members do
not provide outcome probabilities.

Responsive tests emulate viewport sizes; they do not replace testing on physical
phones. Safari/WebKit was not tested. Firefox's pass applies to the fixed local
production build, not a new Vercel deployment. Automated accessibility scans do not certify complete WCAG conformance
or replace a screen-reader review. This was not a penetration test or production
load test. The asset scan used two concurrent requests.

The live site will retain the listed UI defects until this checkout is reviewed
and deployed. No merge, commit or deployment was performed during this audit.
