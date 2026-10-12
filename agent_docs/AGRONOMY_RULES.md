# Field Shift — agronomy rules

Ruleset: `agronomy-v1`. These are explicit project heuristics for comparing locally eligible rotations. Numerical weights and anomaly bands are proposed demonstration defaults, not NASA standards or universal agronomic thresholds. Validate crop tolerances/calendars with regional extension evidence before activating a catalog.

## Catalog and hard constraints

Each crop record requires `crop_id`, `family`, eligible region/calendar windows, minimum/maximum maturity days, `nitrogen_demand` (`low|medium|high`), `legume` boolean, `root_class` (`shallow|medium|deep`), seasonal rainfall range in mm, seasonal temperature range in °C, pH range, drought tolerance, waterlogging tolerance, and reference URLs. Root classes are catalog approximations: shallow <0.6 m, medium 0.6–1.0 m, deep >1.0 m effective rooting potential; actual depth depends on soil and management.

Reject a sequence if a crop is excluded/not allowed, outside its regional planting calendar, cannot mature inside the dated slot, requires irrigation when `irrigation="rainfed"`, violates a catalog disease-family break, or known soil pH is outside its catalog range. Disease breaks are crop-specific numbers of intervening crops, checked across all supplied history plus the planned sequence, never a universal family rule. Insufficient history produces `HISTORY_UNKNOWN`; an observed violation still excludes the crop. Missing required catalog traits is a configuration error, not a neutral score.

Unknown soil pH does not prove suitability: omit the soil screen, emit `SOIL_SCREEN_INCOMPLETE`, and degrade quality. Severe observed drought/heat alone never declares a future crop impossible. Those signals affect a stress score; verified hard constraints alone exclude it.

## Climate anomalies

Assessment window: 90 inclusive UTC dates, ending `assessment_end`; omit February 29 from both observed and baseline comparisons. Rainfall and temperature have separate masks. An observed variable needs ≥90% valid dates. A baseline year needs ≥90% coverage of those same accepted calendar dates. Keep only calendar dates present in every qualifying year's comparison and the observation; require final matched coverage ≥90% and ≥25 qualifying years out of 30. Otherwise that variable's anomaly is null with `CLIMATE_COVERAGE_LOW`.

For cross-year windows, map dates to corresponding calendar dates with the same year offsets; the final date's baseline year must be 1991–2020 and all included dates must be within that baseline period. For seasonal slots, use the same complete-year matching logic. This may leave 29 valid years for a cross-year season.

```text
R_observed = sum(valid matched daily PRECTOTCORR)
R_baseline = mean(sum(same matched dates) for each qualifying baseline year)
rainfall_anomaly_pct = 100 * (R_observed - R_baseline) / R_baseline
temperature_anomaly_c = mean(observed T2M) - mean(yearly matched T2M means)
```

If `R_baseline < 10 mm`, rainfall percent anomaly is null with `BASELINE_TOO_DRY`. Never divide by a small baseline or equate missing rain with 0 mm. A partial-but-qualified window reports matched-period totals and actual coverage; do not extrapolate totals to missing dates.

| Rainfall anomaly `a` | Band | Water component deduction for non-drought-tolerant crops |
| --- | --- | --- |
| `a ≤ -40%` | `severe_dry` | 30 points |
| `-40% < a ≤ -20%` | `dry` | 15 points |
| `-20% < a < 20%` | `normal` | 0 |
| `20% ≤ a < 40%` | `wet` | 10 points for waterlogging-sensitive crops only |
| `a ≥ 40%` | `severe_wet` | 20 points for waterlogging-sensitive crops only |
| null | `unknown` | Omit anomaly adjustment; emit warning |

Heat bands: anomaly <1°C → `normal`, 1–<2°C → `elevated`, ≥2°C → `high`, null → `unknown`. Negative anomalies remain signed; the current rules have no independent cold-anomaly deduction.

Future slot stress scenario: `rainfall_scenario_mm = seasonal_baseline_mm * max(0, 1 + a/100)` when anomaly is valid, else seasonal baseline alone; `temperature_scenario_c = seasonal_baseline_c + temperature_anomaly_c` when valid. Label `historical_stress_scenario`; never present these as forecasts. Require ≥90% coverage and ≥25 baseline years for each slot/variable, or omit that slot's affected component.

## Soil and moisture handling

SoilGrids mapped values convert once: `phh2o/10` → pH, `soc/10` → g/kg, `nitrogen/100` → total N g/kg, and texture fractions `/10` → %. These conversions follow [ISRIC's property table](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html). Total nitrogen is not plant-available nitrogen; no mineral-N budget can be inferred from it.

Use SMAP `SPL3SMP_E` Version 6 fixed AM-pass observations with documented recommended-quality flags (0 or 8), ignoring fill/invalid values and reviewing surface flags. Compute a mean of ≥3 accepted overpasses in the 14 days ending assessment; newest must be within seven days. Values are m³/m³ at the surface. [NSIDC's guide](https://nsidc.org/sites/default/files/documents/user-guide/spl3smp_e-v006-userguide.pdf) defines the accepted retrieval flags.

Do not impose a global volumetric dryness cutoff: clay and sand differ. A moisture percentile is optional and requires ≥30 accepted same-cell, same-pass observations within ±15 calendar days across ≥5 prior years, ending before the assessment year. Define percentile as `100 * count(reference ≤ current_mean) / count(reference)`. Below percentile 20 adds a 10-point water deduction for drought-sensitive crops only in slots starting within 30 days; other percentiles add no deduction. Without this reference, show moisture context but omit its adjustment and emit `SMAP_PERCENTILE_UNAVAILABLE`.

## Nitrogen cycle and rooting transitions

These rules award rotation diversity; they do not model kilograms of nitrogen.

| Previous crop → next crop | Nitrogen component |
| --- | --- |
| Legume → high-demand crop, residues retained | 100 |
| Legume → high-demand crop, residues unknown/removed | 75; explain uncertain/limited residual benefit |
| High-demand nonlegume → legume | 90 |
| High-demand nonlegume → high-demand nonlegume | 30 |
| Other known transition | 60 |
| Previous crop unknown | null; omit this transition and explain missing history |

Check legume cases before demand-class cases. Credit is conditional on nodulation, biomass, harvest/removal, moisture, and mineralization. Do not assume harvested chickpea/mungbean restores all nitrogen removed by a cereal. Favor a legume somewhere in a three-slot plan through these transition scores; do not mandate it when calendars/water make it unsuitable. Residues for future planned crops are unknown in v1, so the retained-residue bonus applies only when supplied in observed history.

Root component: shallow↔deep =100, adjacent classes =75, same class =40; previous crop unknown =null. For the first slot compare with the latest completed history crop; then compare adjacent planned crops. Average known transitions across a sequence. Root alternation is a diversification preference, not evidence of deeper usable soil or repaired compaction. A regional disease break may exclude a rotation even if its root/nitrogen score is high.

The direction of these preferences follows [FAO rotation guidance](https://www.fao.org/4/v9926e/v9926e06.htm). Residue nitrogen availability depends on biomass and release timing; [UMN Extension's nitrogen-credit guidance](https://blog-fruit-vegetable-ipm.extension.umn.edu/2022/04/include-last-years-nitrogen-credits-in.html) supports that conditional treatment, not the project's numerical scoring values.

## Suitability components and final ranking

For a numeric crop interval `[L,U]`, let `distance(x,[L,U]) = max(L-x, 0, x-U)`. All components are clamped to 0–100 after deductions.

| Component | Weight | Slot or transition calculation |
| --- | --- | --- |
| `nitrogen` | 0.25 | Mean known nitrogen transition scores above |
| `roots` | 0.20 | Mean known rooting transition scores above |
| `water` | 0.30 | `100 - 100*distance(rainfall_scenario,[L,U])/max(U,10)` minus applicable anomaly/SMAP deductions |
| `temperature` | 0.15 | `100 - 10*distance(temperature_scenario,[L,U])` |
| `soil` | 0.10 | 100 inside crop pH range (hard exclusion outside); when SOC (g/kg) is known, soft-adjust to 70 if SOC < 5, 85 if SOC > 40, else 100 — context only, not a yield model; unknown pH omits component |

Request `farmer_objective` remaps these base weights before renormalization of missing components: `balanced` (table above); `water_conservation` (water 0.45, temperature 0.15, nitrogen 0.15, roots 0.15, soil 0.10); `soil_health` (nitrogen 0.30, roots 0.30, soil 0.20, water 0.10, temperature 0.10); `climate_adaptation` (water 0.35, temperature 0.30, nitrogen 0.15, roots 0.10, soil 0.10). Objectives never bypass hard constraints.

Water is a rainfall exposure proxy. Irrigation marked `available` removes irrigation-required exclusions but supplies no quantified water, so it does not erase water stress. Temperature is a seasonal mean proxy and cannot establish frost/extreme-heat safety. SOC, texture and total N are displayed as context in v1; do not invent yield or nutrient-response coefficients from them.

Average slot scores per component over known values only. Return null if no values qualify; a partly evaluated component emits `PARTIAL_COMPONENT_COVERAGE`. Renormalize available weights: `score = sum(w*c)/sum(w for nonnull c)`. Never substitute a neutral 50 or zero for missing features. Rank with full precision; return scores rounded to one decimal with decimal ROUND_HALF_UP. Publish available weights and coverage warnings so users can interpret degraded rankings.

Data quality is not score confidence: `complete` requires both climate anomalies, all slot climate features, soil pH, known first history crop with enough history to check disease breaks, eligible near-term SMAP percentile where needed, and no stale/fixture inputs; otherwise `limited`. Require at least one coverage-qualified observed POWER variable and at least one qualified seasonal baseline variable for every requested slot; failure returns 503 rather than a climate-free ranking. A valid rainfall total still qualifies when its percent anomaly is null because the baseline is too dry. Same catalog/data/rules must produce identical crop order and reason codes. Revisit the deliberately simple pH-only soil component after regional validation.
