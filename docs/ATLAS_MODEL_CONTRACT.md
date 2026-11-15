# Atlas v2 model and comparison contract

Implemented 7 November 2026. This is an uncalibrated decision-support prototype,
not a quantitative agronomic recommendation or a production system.

## Scope, state and paired weather

The planning horizon is 2027–2030. Three paired members replay POWER weather from
2013–2016, 2017–2020 and 2021–2024. Every strategy starts each member with identical
entered available-water fraction, snow water equivalent and residue fraction.
Storage, snow, residue and scheduled overwinter crops carry between years within
a member. Members do not inherit states from one another. Their equally weighted
means describe those three blocks, not a probability distribution of future weather.
The simulation forcing archive covers 12 years. A separate 2005–2024 POWER archive supports descriptive historical exploration; it does not replace simulation forcing.

Historical UTC days and leap days are retained. `YearResult.year` is a planning
slot; `weatherYear` and daily `date` identify the actual source weather. The
calendar is day-of-year based and is not a prediction of planting dates in 2027.
The API omits daily bulk; the browser timeline displays the first paired member,
and all three members expose seasonal totals and terminal states.

Available storage capacity = entered mm/m × 1.5 m. This is available water above
wilting point, not total volumetric soil water. An expanding root-access fraction
is a one-layer approximation, not a resolved multilayer root distribution.

```
Δ(available storage + snow)
  = precipitation + field-inlet withdrawal − application losses
    − actual ET − runoff − drainage
```

Below 0°C precipitation enters snow; degree-day melt is min(snow, 3 × positive
mean temperature). Liquid-input runoff is 10%; drainage is overflow above storage
capacity. Capillary rise is zero. These are assumptions, not measured fluxes.
Daily balance residuals and terminal water are reported. Frozen-soil hydraulics,
tile drainage, shallow groundwater and preferential flow are not calibrated.

FAO-56 Penman–Monteith supplies reference ET0 using POWER temperatures, mean RH,
2 m wind and radiation. Mean-RH vapor pressure is an approximation. Kc × ET0 is
potential demand; root access/storage limit actual ET. ET is not synonymous with
withdrawal, avoidable loss or irrigation requirement. Illustrative irrigation
refills toward half available capacity on cropped days above 5°C and demand above
0.5 mm/day, bounded by annual gross field-inlet allocation. Root-zone application
is withdrawal × entered efficiency. Upstream conveyance losses remain unknown.

Residue cover has a 120-day assumed half-life. Retained harvest/termination
residue adds fractional cover; it reduces bare-soil evaporation by at most 50%.
It does not change infiltration or create a calibrated erosion/carbon effect.
Alfalfa is undersown with oats in the schedule; water partition is sequential
(after oat harvest), not a calibrated intercrop model. A productive stand is
carried into year four, with illustrative cutting events. No post-horizon hay,
residual stand asset or future alfalfa nitrogen credit is assigned.

## Crop and economic approximations

Maize/soybean order and planting/harvest dates are farmer-correctable. Four
strategies (baseline plus three alternatives) retain the original Atlas templates. Winter wheat/clover and
forage remain conditional on explicit local site/calendar, equipment and market
confirmation. The rye calendar uses a conservative beginner rule (at least ten
days between termination and soybean planting); experienced green-planting
management is outside this prototype and may require a different rule.

Yield = reference yield × clamp(1 − Ky × (1 − actual cash-crop ET / potential
cash-crop ET), 0, 1). This is a water-response illustration. Heat, nutrients,
disease, cultivar, waterlogging and management yield responses are not fitted.
Prices/costs are constant 2026 USD scenarios adapted from existing catalog
assumptions, not current quotations. Gross margin excludes land, financing and
general overhead. Unknown buyers imply hypothetical sales and unknown feasibility;
explicitly absent buyers receive zero sales. Costs are still incurred.

Nitrogen results are a partial input/fixation-minus-harvest illustration. Clover
credits reduce following maize fertilizer once; no complete N mineralization,
leaching or gaseous-loss state exists. These numbers are not fertilizer advice.
Living-cover days include calendar occupancy during dormancy; they do not measure
biomass, protective soil cover or erosion reduction. SOC change, calibrated soil
loss, pathogen reduction and probability of benefit are explicitly unavailable.

## Feasibility and scoring

`frontend/src/lib/atlas/engine.ts` simulates outcomes; `scoring.ts` is the sole
scoring authority. The standalone blueprint Python scorer is reference material
only. The application does not accept arbitrary externally labeled outcome arrays.
Objective units are assigned by the simulator contract and checked by normalization.
No second production scoring engine exists.

Checks return pass/fail/unknown. A failed constraint excludes ranking; unknown
constraints retain descriptive outcomes but no score/Pareto classification.
Missing essential soil, initial state, weather or irrigation evidence withholds
simulation. All potentially feasible options must have resolved constraints before
an overall preference is displayed. Scores can be hidden; the farmer's selection
is independent of the inspected card and the calculated preference.

Fixed normalization `iowa-four-year-v1`, four-year totals:

| Objective | Units | Better | Fixed range | Preference |
|---|---|---|---|---|
| Unmet crop demand | mm / 4 years | lower | 0–1,200 | water |
| Calendar living cover | days / 4 years | higher | 0–1,461 | soil |
| Gross margin | 2026 USD/ha / 4 years | higher | −4,000–12,000 | economy |

These are policy ranges, not estimated minima/maxima or scientific targets.
Higher-is-better utility is clipped `(x−lo)/(hi−lo)`; lower-is-better is one minus
that value. Physical outcomes are never clipped. Out-of-range values are flagged.
Weighted member utility scores are averaged. Weights are nonnegative and sum to
more than zero. Exact score ties use strategy ID for stable display, with no
scientific claim of superiority. Pareto dominance uses all three mean physical
objectives, independent of weights, among confirmed feasible strategies. N credit
is not a second correlated soil score. Paired deltas are calculated member by member.

The full historical min/max spread and q10/q90 descriptive quantiles in JSON are
not predictive intervals. Three member outcomes cannot justify probabilities of
outperformance. One-variable rainfall, price and capacity sweeps show sensitivity
bounds, not a decomposition of uncertainty. Temperature perturbations preserve
RH, wind, radiation and precipitation timing and omit coupled climate responses.

## Evidence and spatial support

The POWER capture is unchanged and its 12 raw hashes were rechecked. Real Landsat,
SSURGO and NASADEM capture/QA are described in
[the acquisition record](../backend/atlas/EVIDENCE_CAPTURE.md). The read-only
`GET /api/atlas/evidence` serves that same package, with static cached fallback.
Unknown fields return not-acquired. Browser maps/field summaries are disabled
when a boundary differs from the captured polygon. Regional weather stays labeled
regional. No downscaling or cross-product calibration is claimed.

Landsat native windows are EPSG:32615, 30 m with original origin retained; no
resampling is used. Polygon intersections supply area weights. Categorical QA
bits are evaluated before scaling; observations below 80% valid area are withheld.
SSURGO mixtures are not independent point samples. A 0–100 cm survey AWC estimate
does not silently extrapolate to the 1.5 m scenario profile. NASADEM retains
one-arc-second postings and unresolved source-class masks; it is terrain context.

Model exports contain the complete request, horizon, model/normalization versions,
weather evidence ID and source checksums, paired member totals, units, constraints,
review flags, and field evidence with applicability and provenance. Source products,
asset hashes, retrieval/observation timestamps, QA policy and transformations are
retained in the field package. Offline core caching includes the complete processed
evidence/map package. Raw files are cached on first access, not all precached.

## Verification versus validation

Software checks test conservation, paired comparisons, missingness, unit/direction
contracts, stable normalization, preference changes, APIs, persistence, migrations,
source hashes, raster QA and the actual browser workflow. They do not establish
agronomic predictive accuracy or causal effects of changing a rotation.

Before reliance on quantitative projections: obtain consented field boundaries,
local management/cost records, depth/time-matched soil and water observations,
and observed multi-season outcomes; calibrate parameters on separate data; use
spatially blocked and forward-in-time evaluation with no shared coarse-cell or
weather leakage; evaluate bias/MAE/RMSE against simple baselines and calibrated
interval coverage/width; test crop/residue labels and usability with farmers.
Use observed alternative rotations or defensible experiments for causal claims.
Check out-of-domain soils, drainage, crop calendars and climate. Withhold affected
outputs when unsupported. Production additionally needs authenticated accounts,
privacy/retention controls, durable storage, migrations, monitored acquisition jobs,
operational tests and failure recovery. The present device-key store is a local
prototype facility, not an account or production authorization system.

Primary methods checked on **2026-11-07**:

- [FAO-56 Penman–Monteith](https://www.fao.org/4/x0490e/x0490e06.htm).
- [USGS QA bit definitions](https://www.usgs.gov/landsat-missions/landsat-collection-2-quality-assessment-bands).
- [Iowa State 2026 cover termination guidance](https://crops.extension.iastate.edu/post/start-planning-2026-cover-crop-termination).

## Historical evidence extension — atlas-2.1.0, completed 2026-11-09

The water/scoring authority remains TypeScript; historical evidence does not
change its physical outcomes. The audit added a failed clover-calendar constraint
for maize planted on/before the template's day-105 termination. An infeasible
calendar cannot receive a score or Pareto assessment. Historical and future
management calendars are distinct; future planting dates do not become records
of what actually happened.

`history-review-v1` produces exploratory questions only. Accepted Landsat index
summaries require ≥80% valid area, finite dimensionless indices and matching
boundary. Two accepted low-NDVI dates within an adjustable maximum gap produce
an **uncertain review interval**, not a detected bare-soil window. Default NDVI
0.3 and 16-day maximum gap are explicit exploration assumptions; no interpolation
or probability is calculated. Neither NDVI nor BSI establishes protective residue.

Farmer records have dated conditions, confirmation status, notes, linked source
IDs, update times and an original boundary. Changing the selected boundary
withholds their attribution without deleting records. Farmer confirmation needs
a known condition and a local-source note; it is not independent scientific
validation. Old drafts migrate to an empty unconfirmed history. Records may be
corrected, saved offline, synced with the existing device mechanism and exported.

Weather overlap enumerates inclusive UTC dates, including leap days. It uses
unmodified POWER PRECTOTCORR (mm/day) and Tmax (°C), never the future-sensitivity
sliders. Rainfall and Tmax have separate valid/missing-day counts. Complete totals
and event counts are null for an incomplete variable; partial observed rainfall
is explicitly a subtotal. Duplicate dates and non-UTC weather are withheld.
Default event thresholds 25 mm/day and 35°C are exploration settings, not locally
calibrated erosivity, heat damage or water-stress thresholds. UTC days are not
Iowa local calendar days; daily regional rain does not resolve storm intensity.

MODIS contextual composites are kept separate by native support and composite
period, including selected-pixel dates. They do not fill Landsat gaps, train a
classifier, or create independent field observations. See the capture document
for product/version/QA and the setup document for pending NASA access.


The packaged history season is March–November 2024 (66 discovered acquisitions,
53 native-window maps, 17 field summaries meeting the QA rule). Newly created
drafts use this range; saved date preferences remain unchanged. Fifteen windows
and twenty management records fit the existing 32 KiB decision API limit with a
24 KiB history cap. Exports retain records even when weather is unavailable;
missing totals and event counts remain null. Date maps are checksum-checked and
cache on first viewing; the timeline and QA metadata are in the core offline
package. Editing the field boundary preserves earlier records but withholds their
attribution. Unconfirmed boundaries remain explicit review flags.
