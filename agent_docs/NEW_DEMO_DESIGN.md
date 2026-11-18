# Phase 1 — separate Faisalabad multi-season demonstration

Status: **design only, release gated**. Proposed ID `faisalabad_multiseason_v2_2025_r1`; proposed contract2.0.0 and separate reviewed catalog/rules/evidence versions. No new fixture, production endpoint or screen is activated. Keep `faisalabad_2025` and its v1 request unchanged.

## Conditions and evidence boundaries

Location31.4504°N,73.135°E; assessment_end2025-10-15. Use genuine archived NASA POWER UTC point observations at this requested point; disclose gridded spatial support. Existing historical daily captures can be reused **read-only by content hash** in a new manifest without editing their original envelopes or relabeling their fixture ID. A new manifest records derivation, original capture URLs, parameter/unit metadata, transformation/version and old content hashes. This is an historical assessment demonstration, not a current farm forecast.

Farmer/scenario inputs: previous maize May1–September30,2025 with retained residue; irrigation available; no quantified allocation. These reproduce supplied demo history, **not independently observed management**. Initial soil pH/SOC/texture, salinity, drainage and disease history are unknown. Do not insert a convenient pH7.0, a fertile soil value, nodulation, or absence of disease as facts.

For the proposed two alternatives to be called field-feasible, local review must confirm: approved wheat/summer maize and NIAB mungbean profiles; adequately drained suitable soil with acceptable cultivar-specific pH/salinity; sufficient irrigation for actual weather; no verified crop/pathogen interval violation; and full maturity/harvest/clearance compatibility. Until then, call them **calendar-screened conditional alternatives**, not two scientifically certified farm plans. Absence of an exclusion is not positive evidence of suitability.

The explicit **7-day maturity-to-clearance allowance** below is a proposed farmer scenario assumption, not an agronomic constant. It must be reviewed against actual cutting/picking/drying/preparation, particularly semideterminate mungbean. No production default is proposed; if it is inadequate, enlarge the allowance/deadline honestly or remove the candidate. Retain all inputs and explain outcomes on failure.

## Smallest expansion for the specified dates

With sowing fixed at **November1,2025** and **July15,2026**, the unmodified Punjab catalog has wheat as the winter option and maize as the summer option. One new crop, NIAB Mung-2021, creates a second complete sequence using the overlap of its descriptor-supported summer calendar and the existing maize calendar. Source profiles and their limitations are in [PUNJAB_CROP_EVIDENCE.md](PUNJAB_CROP_EVIDENCE.md), S01/S15/S20.

This is a minimal expansion **for these specified exact dates and two crop seasons**, not a global proof that existing crops cannot provide alternatives if sowing dates/history are changed. V2 flexible winter dates may eventually admit chickpea after separate calendar/pathogen review. Different sowing dates of the same crop are schedules, not additional crop-diversity claims.

| Sequence | Season / exact sowing | Evidenced allowable sowing context | Adopted research maturity / calculated dates | Latest clearance / deadline |
| --- | --- | --- | --- | --- |
| A: wheat→maize | Winter:2025-11-01 | Existing irrigated Punjab Nov1–Dec15 window |120–150 DAS;2026-03-01…2026-03-31 |2026-04-07 /2026-04-15 |
| A: wheat→maize | Summer:2026-07-15 | Existing Faisalabad/Jhang main maize Jul15–Aug10 window |125–180 DAS;2026-11-17…2027-01-11 |2027-01-18 /2027-01-31 |
| B: wheat→mungbean | Winter:2025-11-01 | Same wheat profile |Same range/dates |Same clearance/deadline |
| B: wheat→mungbean | Summer:2026-07-15 | Named NIAB cultivar summer window in ledger |70–80 DAS;2026-09-23…2026-10-03 |2026-10-10 /2027-01-31 |

DAS calculation is sowing date + duration days; sowing is day0. These dates are computed scenario bounds, not harvested-field observations. Wheat/maize durations are generic inherited references; a contemporary cultivar review may change them in the separate v2 profile. Both branches allow a long post-winter gap, which must appear in the summary; no cover crop or soil benefit is invented for that gap. The common summer deadline permits different occupancy lengths; water must be calculated on each crop's actual occupancy rather than all201 envelope days.

**Do not append November2026 wheat to sequence A.** Its125-day earliest maturity already falls after November1; the180-day bound falls in January2027. A min-duration-only or assumed quick harvest cannot validate that third season. No window is relaxed to force it.

### Optional later three-season demonstration (not part of minimal release)

After a second crop profile is approved, compare wheat→mungbean→wheat with Punjab Masoor-2019 lentil→mungbean→wheat. Winter1 sowing searchOctober30–November1,2025, but choose **October30 for lentil** (local tested date) and **November1 for wheat**. Lentil125–130 DAS implies2026-03-04…03-09; clearance2026-03-16 under the stated allowance. Summer mungbean exactJuly15,2026 clearsOctober10; winter3 wheat exactNovember1,2026 reaches2027-03-01…03-31 and clearsApril7 with April15 deadline. Both crop calendars fit without pretending summer maize is shorter.

This extension is conditional on approved lentil recommendation/harvest evidence and a pathology review of consecutive Fabaceae hosts. It is not automatically disease-safe from taxonomy and is not implemented. Sesame is excluded from the approved design until its conflicting official calendars are resolved.

## Authentic historical stress exploration

The existing POWER archive contains the90-day2025 assessment window and full daily1991–2020 baseline years, for PRECTOTCORR(mm/day) and T2M(°C). Additional ET0-required variables are **not present**; do not fabricate them.

Research selector (nonproduction): map assessment year2025 to anchor yearY, preserve relative year offsets across both planning seasons. The last plan deadline lies in2027 (offset+2), so anchors **1991–2018** support the entire plan within1991–2020. Require ≥90% valid dates separately for rain/T2M, excludeFebruary29, and require ≥25 eligible anchors. Choose the summer declared envelopeJuly15 ofY+1 throughJanuary31 ofY+2 before comparing crops, so branch duration cannot manipulate the selected year. Select one actual anchor across the whole plan; do not combine the driest rain with hottest temperature from different years.

Direct read-only calculation from the authentic archive gives:

| Context / selector | Observation or mapped source period | Result |
| --- | --- | --- |
| Assessment context |2025-07-18…2025-10-15 (90 days) |Rain325.79mm; meanT2M29.7285555556°C |
| Lowest summer-envelope rainfall |Anchor1996; **1997-07-15…1998-01-31** (201 days) |Rain88.66mm; meanT2M24.6927363184°C |
| Highest summer-envelope mean T2M |Anchor1998; **1999-07-15…2000-01-31** (201 days) |Rain96.23mm; meanT2M26.4830348259°C |
| Baseline comparison for that envelope |28 full-plan-supported anchors |Mean seasonal rain199.07mm; mean seasonal T2M24.5609452736°C |

These are **envelope** observations, not crop demand, extreme-temperature counts, future weather, drought-frequency probabilities or yield predictions. Stress labels describe selection criteria. January in a broad envelope lowers mean temperature; a flowering-stage hazard needs dates and appropriate daily extremes. The original v1 anomaly replay and score are untouched. A future scenario module must independently validate matching, coverage and selection against these research checks.

## Structured research schedule

The following JSON is only testable design data. It is not a new production fixture.

<!-- phase1-demo -->
```json
{
  "status": "research_only",
  "demo_id": "faisalabad_multiseason_v2_2025_r1",
  "original_fixture_id": "faisalabad_2025",
  "location": {"latitude": 31.4504, "longitude": 73.135},
  "assessment_end": "2025-10-15",
  "clearance_allowance_days": 7,
  "clearance_basis": "farmer_scenario_assumption_pending_review",
  "seasonal_water_claim_mm": null,
  "hard_ph_assumption": null,
  "seasons": [
    {"season_id": "rabi_2025", "sown_on": "2025-11-01", "harvest_deadline": "2026-04-15"},
    {"season_id": "kharif_2026", "sown_on": "2026-07-15", "harvest_deadline": "2027-01-31"}
  ],
  "sequences": [
    {"sequence_id": "wheat_maize", "crop_ids": ["wheat", "maize"], "maturity_days": [[120, 150], [125, 180]], "maturity_latest": ["2026-03-31", "2027-01-11"]},
    {"sequence_id": "wheat_mungbean", "crop_ids": ["wheat", "mungbean_niab_2021"], "maturity_days": [[120, 150], [70, 80]], "maturity_latest": ["2026-03-31", "2026-10-03"]}
  ],
  "historical_selectors": {
    "eligible_anchor_years": [1991, 2018],
    "eligible_anchor_count": 28,
    "lowest_rainfall_anchor": 1996,
    "highest_mean_temperature_anchor": 1998,
    "lowest_rainfall_mm": 88.66,
    "highest_mean_temperature_c": 26.483034825870664
  }
}
```

## Farmer interaction and explanations (future implementation)

1. Explicitly select the separate versioned multi-season demo. Clearly show location, historical assessment date, entered management assumptions and source status. Keep the original single-season demo separately selectable.
2. Show both conditional sequences and actual sowing/maturity/clearance ranges. A user may set water, soil and climate priority weights; priority never bypasses a hard rule. Missing objective support is visible, not substituted with a neutral value.
3. Soil reasoning: cereal–pulse versus cereal–cereal, residue intent, source-level root references and actual soil context. Label potential management benefit; no predicted SOC gain or fertilizer reduction. Root diversity is not measured field depth.
4. Water comparison: **release gate** for the complete demonstration. Validate matched ET0/Kc/stages and effective rain/storage for all crops or a genuinely comparable reviewed regional demand range. Report range, coverage and units; no quantitative savings/low-water promise from mungbean duration alone. Until validated, show unavailable and prevent water-based rank claims. This is a research preview, not fulfillment of the eventual full water-demand demo.
5. Historical dry/hot selections replay authentic source periods under the same inputs for both alternatives. Display real dates, selector, observed metrics and limitations; ranking may stay unchanged. Do not manufacture an attractive rank reversal.
6. Explicitly select an evaluated rotation to produce a final summary containing dates, gaps, irrigation assumptions, priorities/effective weights, soil/water reasoning, scenario/source IDs, evidence limitations and review-needed actions. It is a decision aid, not guaranteed crop performance.

## Capture/deployment dependencies and acceptance

Before release: approve local crop/harvest/pathogen profiles and soil suitability handling; capture any additional authentic meteorology required for water models into an independent content-addressed archive; obtain real soil observations or clearly retain missing/estimated status; validate objectives; freeze new manifest/versions/schema; implement explicit v2 selection only with user authorization. SoilGrids REST access is currently paused [ledger S18], so an approved WCS/WebDAV capture or real dated soil sample is a dependency, not an excuse to synthesize values. SMAP may remain absent with honest surface-moisture limitations.

Acceptance criteria:

- Both complete two-season sequences satisfy approved crop calendars, conservative harvest/clearance and known field/pathogen constraints under the declared demonstration conditions. Missing critical verification blocks a “validated” label.
- At least two alternatives remain after real constraint evaluation; do not lower thresholds, omit inconvenient history or select convenient weather to force them. If they do not, report fewer alternatives and investigate evidence/conditions.
- Priorities normalize consistently and transparently; soil reasoning is qualitative and evidence-linked; water comparison has a common validated basis; stress exploration references authentic years and per-variable coverage.
- Selected final summary echoes exactly the chosen point, plan, inputs, versions and assumptions. Custom failures never trigger a fixture request. Retries preserve inputs.
- Test dates against crop windows and full duration, missing soil/water/irrigation, disease context, no fake measurements, selector ties/coverage/cross-year mapping, same-data determinism, priority availability, explicit selection and summary identity. Snapshot validity must include all allowed scenario selectors and management variants; do not modify exact-match v1 fixtures to support this.

## Original demo regression lock

| File under `backend/tests/fixtures/` | Unchanged SHA-256 |
| --- | --- |
| `manifest.json` | `90b3468adcb5eec6379f3b780c86ac7c315bdf56e969027b86b1459115873df4` |
| `power_archive.json` | `4ac69b0b0d70696c89ef133876885bf186840d4c7c810d25b86904a12409b5de` |
| `smap_archive.json` | `bb7710d7a85b941c906cae958f5a6a3da6733c0ff539ca1a76637d867edc9bf2` |
| `soilgrids_archive.json` | `ccadcb07bf42fa19bf92ec7e071d7bce82e513f28e6757904c4182acc1ab9b13` |

Original request: one November1,2025–March31,2026 slot, original location/assessment/history and v1 catalog1.0.1/rules agronomy-v1. Rainfed must return **zero feasible rotations**. Irrigation available must return **one wheat rotation, score43.5**, ID `rot_1a2109813dec8cc4fe4c7af7588cc34d2041bfef3fbb39c7ace9519dc8541825`, pinned POWER provenance and unavailable soil/SMAP/farmer sources. Only request ID/generation timestamp may vary. Existing golden API tests assert these exact outcomes.
