# Phase 1 — scientific review and extension gates

Reviewed 2026-10-12. **Design/research only. Production remains `agronomy-v1`, catalog 1.0.1, contract 1.0.0.** Findings below propose future behavior; none authorize implementation. References S01–S20 resolve to full citations, URLs, locators and context in [PUNJAB_CROP_EVIDENCE.md](PUNJAB_CROP_EVIDENCE.md).

## Repository scope and baseline

Reviewed `agent_docs/AGRONOMY_RULES.md`, `DATA_SCHEMA.md`, `ARCHITECTURE.md`, `JUDGE_DEMO.md`, backlog and execution documents; `backend/data/punjab_crops.json`; the per-trait `EVIDENCE_MAP` in `backend/scripts/test_crop_catalog.py`; `backend/app/catalog/registry.py`; `app/engine/{constraints,scoring,ranking}.py`; climate/soil/moisture features, providers, recommendation service and FastAPI request models/routes; the Next.js BFF and generated v1 types/schema. The evidence ledger already distinguishes source observations from heuristic mappings. The concern is how those mappings behave, not an absence of references.

FastAPI production entry remains `app.main:app --app-dir backend`; Next.js remains the application frontend with its BFF. No new server, production endpoint, catalog record, fixture capture, frontend screen or scoring formula is part of this phase.

| Existing feature | Verified implementation / boundary |
| --- | --- |
| Multi-slot engine | Enumerates complete sequences over 1–4 explicit nonoverlapping dated slots. Per-crop calendar/constraints precede scoring. Each slot's start is the sowing date; not a search over dates. |
| Farmer priorities | Four v1 presets already remap component weights. Continuous weights and comparable soil/water outcomes do not exist. |
| Data provenance | Typed source records, null unavailable values, authentic fixture manifests/checksums, separate live/fixture mode. POWER is a point sample from gridded data, not a farm station. |
| Climate | Coverage-qualified matched-date 1991–2020 baseline and observed 90-day anomalies. Seasonal anomaly replay is labeled historical stress, not forecast. Selection of real historical stress years is absent. |
| Soil/water | Partial dated soil override; mapped soil conversions; pH hard screening; SOC heuristic; rainfall/moisture stress proxy. No quantitative irrigation budget or rotation-level soil-change model. |
| Alternatives | Punjab has three crops, but their sowing dates do not overlap in v1. Changing the number of fixed slots alone cannot create competing same-slot choices. |

## Scientific findings

### R01 — optimal pH is an overly strong hard exclusion (high priority)

**Current:** `constraints.check_rotation` rejects known pH outside wheat 6–7, chickpea 6–8.5, maize 5–7. The evidence map explicitly sources EcoCrop **optimal** ranges. A mapped wheat pH of 7.1 is rejected, even though it is not evidence of crop impossibility. Unknown pH skips the screen with a warning.

**Concern/evidence:** EcoCrop separates optimum from absolute envelopes: wheat absolute 5.5–8.5, maize 4.5–8.5, chickpea 4.7–9.5 [S12, Ecology]. Neither set is a locally calibrated cultivar failure threshold. Gridded pH has estimation uncertainty; H2O versus other laboratory methods matter [S18].

**Proposed v2 correction:** store optimal/contextual/locally verified exclusion envelopes separately, with method, cultivar, region and evidence. Optimal departures produce a suitability caution, not automatic failure. Enable an exclusion only on a reviewed critical bound and sufficiently appropriate soil evidence; missing bounds yield `not_assessed`. Do not simply substitute EcoCrop absolute limits as hard limits.

**Impact:** v2 may retain alkaline-field candidates excluded by v1, with explicit uncertainty. Candidate counts/scores/IDs could change; v1 stays frozen. Test optimum edge, departure within species envelope, unknown pH, conflicting measurement methods and reviewed hard bound violations.

### R02 — chickpea one-day window overinterprets a trial (high priority)

**Current:** only October 25 is accepted. November 1 is rejected in the original demo.

**Concern/evidence:** the local PRI trial also evaluated November 10 and 20; October 25 performed best, later dates reduced performance [S13, abstract/Methods]. Preference in a two-year genotype trial does not show that every other day is biologically impossible. General ICRISAT October/November guidance has a different regional scope [S14].

**Proposed:** separate recommended regional window, tested dates and late-sowing risk. Obtain current PRI extension guidance for a released cultivar and irrigation regime before approving a continuous window. Do not infer an October 25–November 20 window from three treatments or use breeding lines as commercial cultivars.

**Impact:** potentially more winter alternatives, but no automatic chickpea window expansion in Phase 1. Acceptance requires a cited window and cultivar review; the original November 1 exclusion remains unchanged in v1.

### R03 — family breaks mix crop count with pathogen-specific years (high priority)

**Current:** chickpea requires six intervening crops since the most recent Fabaceae record across history/planned crops; wheat/maize have zero catalog break. The v1 ledger describes the six-crop conversion as conservative heuristic mapping of a three-year recommendation. Dates do not determine this exclusion; short crops/fallow can distort the mapping.

**Concern/evidence:** ICRISAT recommends avoiding chickpea for at least three years in **Fusarium-infested** fields [S14, p.12]. It does not establish six intervening crops, universal Fabaceae susceptibility, nor zero pathogen risk for cereals. Missing/truncated history cannot establish disease safety.

**Proposed:** reviewed rules keyed by pathogen, host/nonhost crop set, infestation context, elapsed years/days, and cultivar resistance scope. Keep family diversity as descriptive. Unknown disease history emits uncertainty; verified host-interval violation excludes. Fallow is not automatically a nonhost crop or a disease cure.

**Impact:** lentil–mungbean cannot be approved or rejected merely because both are Fabaceae. More granular history is needed. Tests distinguish the same number of crops over different elapsed time, shared/nonshared hosts, confirmed infestation and incomplete history. Never present zero as a verified break without evidence.

### R04 — maturity minimum is insufficient for harvest compatibility (high priority)

**Current:** inclusive slot length must be at least `maturity_min_days`; `maturity_max_days` is not used. Slot end is echoed as plan end, rather than estimated harvest. No drying, pod picking, field clearance or turnaround model exists.

**Concern/evidence:** generic growth periods [S15] and cultivar maturity [S01, S03] are ranges, not exact field-clearance dates. Crop duration varies with cultivar/sowing/weather. A 125-day maize minimum cannot prove readiness for a following November wheat sowing if the adopted maximum is 180 days.

**Proposed:** explicit sowing date, maturity range, harvest/clearance range and farmer-supplied turnaround assumption. Use conservative latest clearance for the next crop; expose uncertainty when a local full harvest range is missing. Distinguish days-after-sowing (DAS) from inclusive slot length. Date windows must intersect actual evidence; do not widen them for convenience.

**Impact:** some v1 minimum-only sequences fail v2 conservative screening. Preserve generic maize/wheat only as research profiles pending cultivar review. Test boundaries, leap/cross-year arithmetic, min-pass/max-fail schedules and explicit turnaround. Demo date arithmetic is checked separately from field feasibility.

### R05 — SOC thresholds and high-SOC penalty are unsupported (high priority)

**Current:** when pH is known, SOC <5 g/kg reduces soil score from 100 to 70; SOC >40 reduces it to 85. Without pH the entire soil component is omitted even if SOC is known. Rules documentation both describes this adjustment and calls SOC context-only; scoring is authoritative for v1.

**Concern/evidence:** no cited source validates these constants or a universal high-SOC penalty. Soil health needs multiple indicators and texture/climate/land-use context [S16]. SOC is a concentration, not a carbon stock; total C in calcareous soils must not be mistaken for organic C. A legume transition cannot predict SOC gain.

**Proposed:** independent SOC contextual indicator with units, depth, method, source/uncertainty and trend only with comparable repeated samples. Do not carry the thresholds or high-SOC penalty into v2. A proposed management assessment must be labeled qualitative, not measured soil health or a stock-change estimate.

**Impact:** v2 scores cannot be called v1-compatible. Test SOC with missing pH, mapped versus laboratory evidence, organic versus total C, repeated-measurement comparability and absence of unsupported numeric change.

### R06 — rooting classifications obscure evidence (medium priority)

**Current:** all three Punjab crops are `deep`; class transitions receive 40/75/100. The catalog definition of deep is >1 m. Chickpea's qualitative taproot evidence is mapped to deep.

**Concern/evidence:** FAO-56's chickpea effective reference is 0.6–1.0 m [S08]; a potentially deep taproot is not the same as an effective unrestricted water-extraction zone. Soil depth in EcoCrop is not measured root depth. Texture/compaction restrict actual rooting. FAO ranges do not substantiate the 40/75/100 score.

**Proposed:** carry numerical reference ranges and scope; mark effective field depth unknown unless measured. Describe root diversity and soil restrictions without promises to repair compaction. Do not automatically bin a range spanning class boundaries or infer root depth from species soil-depth preference.

**Impact:** future class/score changes affect ranking; retain v1. Test overlapping ranges, restricted soils, species versus cultivar evidence and unknown field depth. Proposed crop ranges are in the master ledger, not new runtime constants.

### R07 — N and residue transitions are directional preferences (medium priority)

**Current:** legume→high demand scores 100 with retained residue, 75 otherwise; high-demand cereal→legume 90, cereal→high-demand cereal 30, other transitions 60. Planned residue management becomes unknown after each slot. Mean transition score is weighted into rank.

**Concern/evidence:** rotation guidance supports diversification and conditional nutrient cycling [S10], not these point differences. Nodulation, biomass, grain N export, residue fate, mineralization and soil mineral N control actual residual benefit. Missing residues and removed residues are distinct situations. Mapped total N is not plant-available N [S18].

**Proposed:** separate observed versus planned residue intent, legume presence and conditional residual-N reasoning. No kg N/ha credit without a scoped validated model; no guarantee of fertilizer replacement. Any preference score is a reviewed product policy, traceable separately from evidence.

**Impact:** priorities require transparent objective definitions; farm inputs gain planned-management fields. Test all residue states, history omission and unavailable nodulation/biomass. Score policy calibration and approval are future dependencies.

### R08 — water interval is not effective rainfall or irrigation need (high priority)

**Current:** `rainfall_*_mm` contains generic seasonal total crop-water demand proxies; engine compares them to seasonal rainfall modified by the recent anomaly and subtracts additional stress penalties. Irrigation available removes a hard exclusion but provides no water volume. Broad slot rainfall is compared even when the crop matures before slot end.

**Concern/evidence:** FAO water-need tables distinguish climate, duration and total crop water need [S15]. Irrigation supplements rainfall/storage; rainfall is not all effective. Annual EcoCrop rainfall cannot fill these fields. Recent anomaly replay and its deduction may double-emphasize a signal; magnitude is a policy choice, not calibrated yield risk. Whole-season mean temperature misses flowering heat/frost.

**Proposed:** separate rain exposure, modeled ETc, effective rainfall, soil storage, net irrigation and gross applied water. Use FAO-56 ET0/Kc methodology only with sufficient inputs and scoped stage/Kc approval [S09]. Demand comparison integrates actual crop occupancy under the same scenario; labels include method/units/range and uncertainty. Unknown water values remain null; no ranking by invented low/medium/high classes.

**Impact:** v2 water scoring needs a new validated indicator; old component must not be relabeled as irrigation demand. Test identical basis, stage coverage, effective-rainfall method, units, no annual-to-seasonal conversion, and unavailable ET0 inputs. No yield-loss percentage without validation.

## Assumptions that remain scientifically or locally unverified

| Gate | Required evidence / reviewer | Blocks |
| --- | --- | --- |
| Local pH, salinity and drainage suitability | NIAB/PRI/ORI with cultivar and soil-test method; laboratory or disclosed gridded field context | Unconditional feasibility and hard thresholds |
| Current winter/summer crop harvest range | Contemporary released maize/wheat cultivar guidance; full harvest/drying/clearance, not only maturity | Robust next-season scheduling |
| Pathogen host/interval rules | PRI pathology review, actual disease history and nonhost evidence | Disease-safe classification; successive pulse branch |
| ET0/Kc/stages and effective rain | UAF/irrigation specialist, daily meteorology and model validation against regional management | Numeric relative demand and water priority activation |
| Soil-management scoring | Local soil scientist; explicit outcome definitions and reviewed preference policy | Any quantitative soil-health score or predicted SOC change |
| Calendar conflicts and access limits | Signed originals and current ORI guidance; reconcile indexed S06 with S07 | Sesame activation |
| Scenario representativeness | POWER coverage/variable review; disclose historical gridded nature and model assumptions | Claims of field observation, forecast or probabilistic climate risk |

## Implementation dependencies and acceptance

The v2 contract can represent unknowns now, but deployment must wait for these gates. Subsequent phases require explicit user approval.

| Future unit of work | Depends on | Acceptance / meaningful tests |
| --- | --- | --- |
| Versioned evidence/catalog model | Scoped trait review, conflict resolution | Species/cultivar distinction, source/locator per trait, unavailable values permitted; old catalog loads unchanged |
| Conservative dated planning | Reviewed maturity/harvest bounds and declared turnaround | At least two calendar-valid two-season candidates; impossible maize→November wheat rejected; deterministic tie-breaking and stable identity |
| Farmer weights | Reviewed objective policies, comparable component availability | Nonnegative finite weights; all-zero rejected; missing objective exposed; hard constraints never overridden; no fake rank-flip guarantee |
| Soil assessment | Local field context and indicator policy | Measured baseline separate from projected management reasoning; no arbitrary SOC penalty or predicted nutrient credit |
| Water indicator | Validated ET0/Kc and effective-rain/storage assumptions | Same scenario/basis for alternatives, range/coverage/provenance; unknown ≠zero; no precise demand from irrigation Boolean |
| Historical replay | Immutable authentic daily captures and matched calendars | Selected year/date provenance, no synthetic anomaly labeled observation, separate observed/context/replay windows |
| New demo release | All relevant gates above plus v2 boundary tests | Versioned fixture distinct from original; alternatives conditional on inputs; failed custom request never runs demo automatically |

Affected files in later implementation: new models/routes alongside `backend/app/schemas/contracts.py` and `api/v1`; catalog loader/evidence profile alongside `backend/data`; opt-in constraint/scoring profile in existing pure engine; provider/feature extensions; separate generated v2 schema/types and BFF; independent fixtures/tests. Do not edit these production files during Phase 1. Candidate counts, identifiers, weights, eligibility, quality enums and error meanings are potential breaking changes if made in v1; route/schema isolation avoids them.

## Verification record

The Phase 1 tests check source transcription, null discipline, demonstrated sowing windows and conservative date arithmetic. They do not verify yield, water savings or local suitability. Existing catalog, engine, fixture and API tests remain the production baseline.

Executed 2026-10-12 using the existing repository `.venv` and pinned `pyproject.toml`/`uv.lock` configuration; no dependency or lock changes:

| Check | Result |
| --- | --- |
| `PYTHONPATH=backend .venv/bin/python -m pytest -q` | **314 passed, 0 failed** (299 existing +15 new research checks); includes exact rainfed/irrigated production API golden tests |
| Targeted Phase 1, catalog/registry, constraints, scoring and ranking tests | **57 passed, 0 failed**; subset of the full suite |
| `.venv/bin/python backend/scripts/verify_phase0.py` | **156 passed, 0 failed**, with external socket connections disabled; overlaps the full suite |
| `.venv/bin/ruff check backend/tests/test_phase1_research_spec.py` | Passed |
| Pre/post SHA-256 audit of140 pre-existing tracked files (including original fixture archives) | **0 modified/missing**; catalogs, engine, public contracts, BFF, generated schema, fixture files and dependency configuration are byte-identical |
| Original fixture regression | Four exact hashes match [NEW_DEMO_DESIGN.md](NEW_DEMO_DESIGN.md); rainfed0; irrigated1 wheat, score43.5, original ID and pinned source provenance |

The first targeted invocation omitted `PYTHONPATH=backend` and produced4 import collection errors (`app` not found); corrected invocation and the full suite passed. This was an invocation error, not a production failure. No remaining test failures. Full lifecycle tests used the approved local execution environment because ASGI synchronous routes require thread facilities restricted by the sandbox. Tests use pinned/mocked providers; research checks perform no downloads. Frontend/build were not rerun: no frontend or production file changed in this phase.

Created only the four requested research/design documents and `backend/tests/test_phase1_research_spec.py`. No production v2 activation, catalog expansion, scientific correction or new demo capture has occurred.
