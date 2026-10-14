# Phase 1 — API v2 extension contract

Status: **proposed, inactive**. No Pydantic model, generated schema, route, BFF or engine change is made here. This is a design specification for future independent implementation and review. Public v1 remains defined by [DATA_SCHEMA.md](DATA_SCHEMA.md). Scientific definitions/gates are in [PHASE1_AGRONOMY_REVIEW.md](PHASE1_AGRONOMY_REVIEW.md) and [PUNJAB_CROP_EVIDENCE.md](PUNJAB_CROP_EVIDENCE.md).

## Versioning and compatibility

| Surface | Proposed route / behavior |
| --- | --- |
| FastAPI recommendation | `POST /api/v2/recommend-rotation` |
| FastAPI catalog | `GET /api/v2/crops?region_id=punjab_pk_v2&catalog_version=<version>`; catalog version required, no silent latest |
| Next.js BFF | `POST /api/v2/recommend-rotation`; `GET /api/v2/crops` forwards exactly those query parameters |
| Contract | Literal `schema_version="2.0.0"`; independent JSON Schema ID `https://field-shift.local/contracts/2.0.0.json` |
| Data/rules | Explicit `catalog_version`, `rules_version`, `transform_version`, `scoring_policy_version`, `evidence_version`; version strings resolved from approved registry |
| Old paths | `/api/v1/*` and existing Next `/api/recommend-rotation` retain v1 models, errors, enums, defaults and generated artifacts |

Keep Next.js→BFF→FastAPI→providers/features→pure deterministic engine. Introduce new wire models and a separately selected rules profile. Do not mutate v1 `Crop`, `RecommendationRequest`, feature behavior or fixture matching. A v1 request cannot acquire v2 behavior from a catalog default, content negotiation or updated rule constant. Unsupported major schema returns 422 on v2; disabled/nonexistent v2 routes return 404 until intentionally activated. New demo requires explicit selection; a provider failure never changes location, mode, farm history or catalog.

Generate v2 JSON Schema/OpenAPI from future Pydantic models and separate TypeScript bindings. Ajv 2020 validates the same schema on the BFF and responses. Preserve existing BFF upstream allowlist, cancellation, no redirects, strict UTF-8, 64 KiB limit, no-store and request IDs. Pure calculations remain deterministic; no text-generation service decides feasibility or rank.

## Conventions and primitives

All objects below are closed (`additionalProperties=false`). Numeric strings, Boolean-as-number, NaN/infinity, floating integers and invalid dates are rejected. Dates use Gregorian ISO `YYYY-MM-DD`; timestamps are RFC3339 UTC. WGS84 named latitude/longitude, never implicit GeoJSON order. Dates in model calendars use explicit calendar mapping; timestamps do not silently change UTC to POWER's default local solar time.

Every **response** field listed is required, including nullable fields. Empty collections are `[]`; unavailable numbers are `null`, never zero/sentinels. **Request** fields are required unless their table gives a default; explicit null is allowed only when the declared type includes null. Unknown enums/extra fields produce 422. Request defaults are product policies, not agronomic facts.

| Type | Definition |
| --- | --- |
| `Id` | string matching `^[a-z0-9_-]{1,64}$`; season IDs maximum 32 characters |
| `Version` | nonempty string ≤64 characters, approved immutable registry value |
| `Date` / `UTC` | valid date / UTC timestamp as above |
| `Range` | `{min:number,max:number}` finite, min≤max; units specified by field name; nonnegative unless explicitly stated otherwise |
| `IntRange` | `{min:integer,max:integer}` with same ordering and field bounds |
| `Location` | `{latitude:number[-90,90],longitude:number[-180,180]}` |
| `Residue` | `retained|removed|unknown` |
| `EvidenceGrade` | `regional_cultivar|regional_species|global_reference|project_policy|unverified` — scoped evidence description, **not** probability/confidence |
| `AssessmentStatus` | `assessed|partial|unavailable`; unavailable implies value/range null with ≥1 reason |

## Recommendation request

| Field | Type / default | Validation and units |
| --- | --- | --- |
| `schema_version` | literal `2.0.0`, required | Explicit version dispatch |
| `location` | `Location`, required | Echo point unchanged |
| `region_id` | `Id`, required | Initially proposed `punjab_pk_v2`; registry must support location context, not merely longitude matching |
| `catalog_version`, `rules_version` | `Version`, required | Approved mutually compatible pair; research ledger names are not activated catalog IDs |
| `assessment_end` | `Date`, required | ≤UTC today and within selected source coverage |
| `planning` | `Planning`, required | Explicit growing-season configuration below |
| `priorities` | `Priorities`, default `{water_conservation:1,soil_health:1,climate_resilience:1}` | At least one positive weight |
| `crop_history` | `History[]`, default `[]` | 0–16 records; unique chronological nonoverlapping entries; larger research history capacity than v1, policy limit not disease interval |
| `irrigation` | `Irrigation`, required | Rainfed/available is not a volume guarantee |
| `soil_inputs` | `SoilInput[]`, default `[]` | 0–24 measurements; distinct property/depth/date/method; conflicts retained and resolved explicitly |
| `field_context` | `FieldContext`, default all unknown/null | Never assume no disease, salinity or restrictive layer |
| `climate_scenario` | `ScenarioSelection`, required | Historical selection only; no synthetic percentage override |
| `data_selection` | `DataSelection`, default `{mode:"auto",snapshot_id:null}` | No automatic snapshot/fixture fallback |
| `allowed_crop_ids`, `excluded_crop_ids` | `Id[]`, default `[]` each | Unique known profile IDs ≤12; disjoint; empty allowed means all enabled regional profiles |
| `top_k` | integer[1,10], default 3 | Display limit, not candidate-evaluation limit |
| `comparison_rotation_ids` | string[], default `[]` | ≤10 distinct `rot2_<64 lowercase hex>` IDs in current evaluation context |
| `selected_rotation_id` | string or null, default null | Same ID format; builds a final summary only after explicit selection, never selects first automatically |

### Nested planning, history and farm input objects

| Object | Required fields (and any defaults) |
| --- | --- |
| `Planning` | `season_count`: integer[2,4]; `seasons`: `Season[]` exactly season_count. `calendar_policy`: literal `conservative_latest_clearance`. `clearance_allowance_days`: IntRange[0,60], **required explicit farmer/scenario assumption** covering maturity→harvest/dry/clear/prepare; not a scientific default. Season order is chronological, IDs unique; final deadline ≤assessment_end+730 days. |
| `Season` | `season_id`: Id; `label`: string[1,80]; `sowing_start`, `sowing_end`, `harvest_deadline`: Date; `planned_residue_management`: Residue. Require assessment_end<sowing_start≤sowing_end<harvest_deadline; sowing interval ≤60 inclusive days; envelope from sowing_start to deadline ≤366 inclusive days; season sowing_start later than previous season harvest_deadline. These bounds constrain computation, not crop biology. |
| `History` | `crop_id`: known regional Id; `sown_on`, `harvested_on`: Date, sown≤harvested≤assessment_end; `residue_management`: Residue; `disease_observations`: Id[] from pathogen registry. Unknown legacy crop IDs must be mapped with evidence or rejected, never assigned another family. |
| `Irrigation` | `availability`: `rainfed|available|unknown`; `season_allocations`: `Allocation[]`; `application_efficiency`: number(0,1] or null. Allocations empty allowed; unknown budget remains unknown. Rainfed requires allocations empty and efficiency null. |
| `Allocation` | `season_id`: requested Id; `net_available_mm`: number≥0; `origin`: `farmer_estimate|recorded_allocation`; `source_note`: string[1,500]. At most one per season. Field-area volume conversion only if separately known; mm is depth over the planned field. |
| `SoilInput` | `property`: `ph_h2o|soc_g_kg|total_n_g_kg|sand_pct|silt_pct|clay_pct`; `value`: finite number; `depth_top_cm`, `depth_bottom_cm`: integer, 0≤top<bottom≤200; `sampled_on`: Date≤assessment_end; `origin`: `lab_reported|farmer_entered`; `method`: string[1,120] or null; `source_note`: string[1,500]. pH[0,14], SOC/N[0,1000] g/kg, texture[0,100]%. Texture samples must supply three fractions at same depth/date/method summing100±2; no silent rescaling. Laboratory claim is farmer reported, not independently certified. |
| `FieldContext` | `drainage`: `well_drained|waterlogging_observed|unknown`; `salinity_ec_ds_m`: number≥0 or null; `salinity_method`: string[1,120] or null (nonnull iff EC present); `restrictive_depth_cm`: integer[1,200] or null; `disease_history_status`: `reported|unknown`; `disease_events`: `DiseaseEvent[]`; `source_note`: string[1,500] or null. Unknown disease status requires events=[]; reported empty does not prove pathogen absence. |
| `DiseaseEvent` | `pathogen_id`: registry Id; `observed_on`: Date≤assessment_end; `diagnosis`: `laboratory_reported|field_suspected`; `source_note`: string[1,500]. Suspicion is not a confirmed diagnosis. |
| `DataSelection` | `mode`: `auto|snapshot|demo`; `snapshot_id`: Id or null. ID required for snapshot/demo, null for auto. Demo mode requires server enablement and exact versioned manifest request match. Snapshot is immutable authentic research data; demo additionally carries explicit demonstration labeling/assumptions. |

Sowing windows describe **allowed search intervals**, not two crops occupying one interval. Deterministic enumeration initially searches daily dates within the requested/evidenced intersection, then removes identical crop sequences with inferior dates using a versioned documented policy. All distinct returned schedules keep actual dates in their identity. A future bounded solver must exhaust this bounded domain or return an explicit error; never describe an incomplete search count as all feasible rotations. Fallow gaps are reported, not invented crop entries or unrecorded nonhost evidence.

For each candidate, latest maturity plus maximum clearance allowance must be ≤season harvest_deadline and strictly before the following sowing date. A local cultivar harvest range can supersede generic maturity only with reviewed evidence/version. Unknown critical harvest suitability yields conditional status and a warning, not a false fully validated result. `clearance_allowance_days` cannot be tuned down to force a boundary pass.

### Historical scenario selection

`ScenarioSelection` is a discriminator union; all three variants forbid extra fields:

| Variant | Fields and rules |
| --- | --- |
| Baseline | `kind:"baseline"`, `baseline_start_year:1991`, `baseline_end_year:2020`. Same matched calendar dates; scenario averages are computed, not literal invented normal weather. |
| Explicit historical year | `kind:"historical_year"`, `baseline_start_year:1991`, `baseline_end_year:2020`, `anchor_year`: integer[1991,2020]. Anchor maps assessment_end year to this year; all plan dates keep relative year offsets. Out-of-range years or incomplete source support are reported, not truncated or replaced. |
| Historical stress selector | `kind:"historical_stress"`, `baseline_start_year:1991`, `baseline_end_year:2020`, `selector:"lowest_rainfall|highest_mean_temperature"`, `reference_season_id`: requested Id. Select one eligible anchor using summed precipitation or mean T2M over the **entire declared reference-season envelope**, before ranking candidates. Lexical enum above denotes two values, not one pipe-containing string. Ties choose earliest anchor year. Replay the same year across all crops/seasons; do not independently pick rain/heat minima from different years and call it observed weather. |

Eligibility: each required scenario variable has ≥90% valid matched dates per requested season and ≥25 qualifying baseline anchors; omit February29; keep variable-specific masks and original missing flags. For cross-year plans the eligible anchors must support **all** relative years within1991–2020, so30 is not assumed. Future occupancy-specific calculations use their actual dates within that common selected context. No future plan date is represented as already observed. `assessment_end` context observations are reported separately from replay. Invalid/low-coverage anchor does not switch to another date/year silently. ET0 requires its additional weather variables and its own coverage/validation; T2M+rain alone does not establish ET0.

## Success response — HTTP 200

| Field | Type / invariants |
| --- | --- |
| `schema_version`, `request_id`, `generated_at` | Literal2.0.0, UUID string, UTC; request_id matches `X-Request-ID` |
| `status` | `ok|degraded|no_feasible_rotation`; empty possible set→no_feasible_rotation; conditional/data-limited/ranking unavailable→degraded |
| `versions` | `Versions`: catalog_version, rules_version, transform_version, scoring_policy_version, evidence_version: Version |
| `location`, `region_id` | Requested Location / Id, unchanged |
| `evaluation_id` | `eval2_<64 lowercase hex>` hash of normalized request except top_k/comparison/selection, resolved versions and input content hashes; excludes transient request metadata |
| `resolved_request` | Full default-expanded request; preserves entered values and the selected source/mode; secrets never accepted here |
| `data_quality` | `Quality` below; completeness ≠scientific evidence quality |
| `assessment_context` | `Context` below; current historical observations/soil distinct from planning replay |
| `climate_scenario` | `ResolvedScenario` below |
| `sources`, `evidence` | `Source[]`, `Evidence[]`; every used measurement/model assumption/reason references resolvable IDs |
| `candidate_counts` | `CandidateCounts`: enumerated, excluded, conditional, validated, returned: integer≥0; enumerated=excluded+conditional+validated; returned≤top_k and conditional+validated. Counts refer to distinct full schedules before top_k, not unique prose labels. |
| `objective_weights` | `ResolvedWeights` below; common basis for all scored candidates |
| `recommendations` | `Rotation[]`, ≤top_k; validated or conditional candidates, status displayed explicitly |
| `exclusions` | `Exclusion[]`; deterministic deduplication by crop/season/date/rule |
| `comparison` | `Comparison` below; selected evaluated IDs can include candidates outside top_k |
| `final_plan_summary` | `FinalSummary` or null; nonnull iff selected_rotation_id resolves in this evaluation |
| `warnings` | `Reason[]`; missing scientific/field inputs are not suppressed |

### Provenance, quality and context

| Object | Required fields / semantics |
| --- | --- |
| `Quality` | `completeness`: `complete|limited`; `missing_input_paths`: string[] JSON pointers; `unresolved_assumption_ids`: Id[]; `evidence_grade`: EvidenceGrade (weakest critical claim, not average); `limitations`: Reason[]. Complete data may still have global/unverified scientific support. |
| `Source` | `source_id`: Id; `provider`: `power|soilgrids|smap|farmer_input|research_reference`; `mode`: `live|cache|stale_cache|snapshot|demo|farmer_input|unavailable`; `product`, `product_version`, `spatial_support`, `native_cell_id`: string or null; `grid_resolution_km`: number>0 or null; `observed_start`, `observed_end`: Date or null; `retrieved_at`: UTC or null; `content_sha256`: lowercase hex64 or null; `snapshot_id`: Id or null; `urls`: HTTPS string[]; `used_for`: JSON-pointer string[]. Unavailable source has null metadata and empty arrays. Model maps have null observation dates; retrieval time is not sample date. Snapshot/demo must have content hash and ID. |
| `Evidence` | `evidence_id`: Id; `claim`: string[1,500]; `source_ids`: nonempty Id[]; `locator`: string[1,240]; `grade`: EvidenceGrade; `scope`: string[1,240] (crop/cultivar/region/management); `review_status`: `approved|provisional|conflicted|unverified`; `limitations`: string[]; `reviewed_on`: Date or null. Project policy citations identify a policy document, not a fictitious agronomy paper. |
| `Reason` | `code`: ReasonCode below; `message`: string[1,500]; `affected_paths`: JSON-pointer string[]; `evidence_ids`, `source_ids`: Id[]. Unknown inputs may have [] evidence; scientific benefit claims may not. |
| `Context` | `observed_window_start`, `observed_window_end`: Date (90 inclusive days ending assessment_end); `rainfall_mm`: number≥0 or null; `mean_temperature_c`: finite number or null; `rainfall_coverage`, `temperature_coverage`: number[0,1]; `soil`: SoilObservation[]; `surface_moisture_m3_m3`: number[0,1] or null; `source_ids`: Id[]. Surface moisture never relabeled root-zone moisture. |
| `SoilObservation` | `property`: SoilInput property enum; `value`: number or null using property units/ranges; `depth_top_cm`, `depth_bottom_cm`: integers as input; `sampled_on`: Date or null; `method`: string or null; `origin`: `lab_reported|farmer_entered|gridded_estimate|unavailable`; `uncertainty_range`: Range or null; `source_ids`: Id[]; `limitations`: Reason[]. Map quantiles for a depth are not fabricated aggregate-layer confidence bounds. Conflicting user/map values show both and selected-source rationale. |
| `ResolvedScenario` | `kind`: `baseline|historical_year|historical_stress`; `anchor_year`: integer[1991,2020] or null (null for baseline); `selector`: `lowest_rainfall|highest_mean_temperature` or null; `reference_season_id`: Id or null; `baseline_start_year:1991`, `baseline_end_year:2020`; `eligible_anchor_years`: integer[] unique/sorted; `mapping_policy`: literal `relative_year_offsets_omit_feb29`; `seasons`: ScenarioSeason[]; `source_ids`: Id[]; `limitations`: Reason[]. No return fields suggesting a forecast probability. |
| `ScenarioSeason` | `season_id`: Id; `planning_start`, `planning_end`: Date; `historical_start`, `historical_end`: Date or null (baseline=null); `rainfall_mm`: number≥0 or null; `mean_temperature_c`: number or null; `rainfall_coverage`, `temperature_coverage`: number[0,1]; `rainfall_baseline_years`, `temperature_baseline_years`: integer[0,30]. Summaries cover the declared envelope; crop-demand metrics use occupancy dates separately. |

### Priorities, rotation assessment and water

`Priorities` has exactly `water_conservation`, `soil_health`, `climate_resilience`: finite numbers[0,100], not all zero. Raw weights normalize to sum1. This is user preference, not a scientific importance constant. Objective definitions/scales belong to a versioned, reviewed scoring policy; Phase 1 does not supply an invented formula.

**Comparability decision:** scores use only the positive-weight objectives assessable on a common comparable basis for **every** viable candidate. Missing objectives get effective weight0 for all candidates, with explicit reasons, rather than each candidate receiving different normalization. If none remain, score and rank are null and recommendations use deterministic schedule ordering with `RANKING_UNAVAILABLE`. This avoids rewarding candidates merely for missing difficult-to-score traits. Top_k does not affect the common basis. Never impute neutral50/zero.

| Object | Required fields / units |
| --- | --- |
| `ResolvedWeights` | `requested`: Priorities; `normalized`: Priorities constrained[0,1], sum1; `effective`: same keys[0,1], sum1 when scoring exists, otherwise all0; `unavailable_objectives`: objective key[]; `policy_version`: Version; `limitations`: Reason[]. |
| `Rotation` | `rotation_id`: rot2 hash; `rank`: integer≥1 or null; `score`: number[0,100] or null; `feasibility`: `validated|conditional`; `seasons`: PlannedCrop[] one per season; `objectives`: ObjectiveAssessment; `soil_health`: SoilAssessment; `water_demand`: RotationWater; `reasons`, `limitations`: Reason[]; `assumption_ids`: Id[]. Scored ranks contiguous after sorting; unrounded score governs rank, display round half up to1 decimal; ties stable ID. Unscored lists have null rank/score. |
| `PlannedCrop` | `season_id`, `crop_id`, `cultivar_id`: Id (cultivar_id nullable for unselected species profile); `crop_name`: string; `sown_on`: Date; `maturity_days`: IntRange>0; `maturity_earliest`, `maturity_latest`, `clearance_latest`, `harvest_deadline`: Date; `duration_evidence_ids`: Id[]; `planned_residue_management`: Residue; `water_demand`: CropWater; `limitations`: Reason[]. Dates calculated using explicit DAS convention and allowance; deadline is not claimed harvest. |
| `ObjectiveAssessment` | Exactly three objective keys, each `ObjectiveValue`: `status`: AssessmentStatus; `score`: number[0,100] or null; `method_version`: Version or null; `coverage`: number[0,1]; `evidence_ids`: Id[]; `reasons`: Reason[]. No score without approved method; partial may be scored only when policy deems comparison valid. |
| `SoilAssessment` | `kind`: literal `qualitative_management_assessment`; `indicators`: SoilIndicator[]; `measured_baseline`: SoilObservation[]; `projected_soc_change_g_kg`: literal null; `nitrogen_credit_kg_ha`: literal null; `limitations`: Reason[]. Future numerical models require new reviewed schema/policy; a calculated preference is never measured soil improvement. |
| `SoilIndicator` | `indicator_id`: `legume_presence|residue_intent|root_reference_diversity|family_diversity|ph_context|soc_context|disease_context`; `status`: AssessmentStatus; `direction`: `potential_benefit|potential_risk|mixed|context_only|unknown`; `season_ids`: Id[]; `evidence_ids`: Id[]; `reasons`: Reason[]. Legume benefit conditional on establishment/biomass/removal; no universal family-disease inference. |
| `CropWater` | `status`: AssessmentStatus; `basis`: `modeled_etc|reviewed_seasonal_range|unavailable`; `method_version`: Version or null; `period_start`, `period_end`: Date; `etc_mm`: Range or null; `effective_rainfall_mm`: Range or null; `storage_contribution_mm`: Range or null; `net_irrigation_mm`: Range or null; `gross_irrigation_mm`: Range or null; `relative_class`: `lower|similar|higher|unknown`; `reference_rotation_id`: rot2 ID or null; `comparison_basis_id`: Id or null; `evidence_ids`, `source_ids`: Id[]; `limitations`: Reason[]. Relative class unknown unless same reviewed basis/reference; unknown status→all water quantities null. |
| `RotationWater` | `status`: AssessmentStatus; `basis`: same enum; `method_version`: Version or null; `etc_mm`, `net_irrigation_mm`, `gross_irrigation_mm`: Range or null; `coverage`: number[0,1]; `comparison_basis_id`: Id or null; `evidence_ids`, `source_ids`: Id[]; `limitations`: Reason[]. Full totals require every crop assessed on the same basis; partial totals are null, avoid silently summing known crops. Crops retain known component values individually. |

Water definitions: ETc=sum(Kc×ET0) over declared crop occupancy; rainfall total is not ETc. Net irrigation requires a reviewed effective-rain/storage balance, with nonnegative result and all assumptions explicit. Gross irrigation additionally requires supplied/validated efficiency; unknown efficiency→null gross. mm denotes water depth, never liters or a forecast allocation. Ranges account for duration/model input uncertainty without inventing statistical confidence. Do not add incompatible empirical ranges across different climates to declare the lower-water plan.

### Comparison and final plan summary

| Object | Required fields / behavior |
| --- | --- |
| `Comparison` | `rotation_ids`: requested ID[] in request order; `rotations`: Rotation[] in same order; `metrics`: ComparisonMetric[]; `limitations`: Reason[]. If IDs=[], rotations/metrics=[]; no implicit winner. A current-context ID not found→422, not silently replaced. |
| `ComparisonMetric` | `metric`: `score|etc_mm|net_irrigation_mm|gross_irrigation_mm|soil_health_score|climate_resilience_score`; `unit`: `points|mm` matching metric; `comparison_basis_id`: Id or null; `values`: MetricValue[]; `comparable`: Boolean; `limitations`: Reason[]. Points and mm never merged. |
| `MetricValue` | `rotation_id`: rot2 ID; `value`: number or null; `range`: Range or null; `status`: AssessmentStatus. Score uses value, water uses range; unavailable has both null; no percent advantage from overlapping ranges/missing basis. |
| `FinalSummary` | `selected_rotation_id`: rot2 ID; `evaluation_id`: eval2 ID; `location`: Location; `versions`: Versions; `plan`: PlannedCrop[]; `priorities`: ResolvedWeights; `soil_health`: SoilAssessment; `water_demand`: RotationWater; `climate_scenario`: ResolvedScenario; `rationale`, `limitations`: Reason[]; `source_ids`, `evidence_ids`, `assumption_ids`: Id[]; `feasibility`: validated or conditional. Derived stateless representation of the explicitly selected evaluated plan, not a saved field commitment or agronomic guarantee. |
| `Exclusion` | `season_id`, `crop_id`: Id; `sown_on`: Date or null; `code`: `CROP_EXCLUDED|CROP_NOT_ALLOWED|CALENDAR_INCOMPATIBLE|HARVEST_DEADLINE_EXCEEDED|NEXT_SOWING_OVERLAP|IRRIGATION_UNAVAILABLE|VERIFIED_PH_LIMIT|PATHOGEN_INTERVAL_REQUIRED`; `message`: string[1,500]; `evidence_ids`: Id[]. New exclusions live only in v2; unknown soil/history produces limitations, not fabricated violation. |

Rotation ID hashes include full dated sequence, planned residue management, catalog/rules/scoring-policy/evidence versions, resolved environmental content hashes and scenario, and explicit clearance assumptions. Exclude top_k, priority weights, selection, request_id and generated_at so changing preferences can compare the same plans. Evaluation ID includes priorities. Canonical JSON serialization/version and stable full-precision sorting must be pinned and tested. No cross-evaluation persistence is promised: resubmitting comparison IDs recomputes with immutable snapshot inputs; live data changes can make IDs stale, returning422 with a clear instruction to reassess.

`validated` means all reviewed hard screens and required scheduling/field inputs pass under declared assumptions; it is never a guarantee of harvest, disease freedom or modeled yield. `conditional` exposes missing critical field/evidence verification. Rank alone must not hide this distinction.

## Catalog response — GET /api/v2/crops

The requested region/catalog must resolve to an immutable compatible version. Unknown/unsupported query fields or values return422/VALIDATION_ERROR. GET uses the same request ID/no-store conventions. The response has exactly `schema_version` (2.0.0), `request_id` (UUID), `region_id` (Id), `catalog_version` (Version), `evidence_version` (Version), `crops` (CropProfile[]), `sources` (Source[]), `evidence` (Evidence[]). Profiles are sorted by crop_id; IDs unique. Research-only or blocked entries may be shown with their status, but cannot be requested as active candidates.

| Object | Required fields / validation |
| --- | --- |
| `CropProfile` | `crop_id`: Id; `crop_name`, `botanical_name`, `family`: strings[1,120]; `cultivar_id`: Id or null; `cultivar_name`: string or null (both cultivar fields null together); `region_ids`: nonempty unique Id[]; `approval_status`: `approved|research_only|blocked`; `planting_windows`: PlantingWindow[]; `harvest`: HarvestProfile; `ecology`: Ecology; `root_reference_m`: Range>0 or null; `legume`: Boolean; `irrigation_profile`: `irrigated|rainfed|either|unknown`; `pathogen_rules`: PathogenRule[]; `water_model_version`: Version or null; `trait_evidence`: TraitEvidence[]; `limitations`: Reason[]. Approved profile requires at least one reviewed regional calendar; [] pathogen rules means none approved, never universal zero risk. No mandatory N-demand class or drought-tolerance Boolean without evidence. |
| `PlantingWindow` | `season`: `spring|summer|winter`; `start_mmdd`, `end_mmdd`: valid calendar MMDD strings (February29 permitted only in leap years); wrap-year windows explicitly allowed; `evidence_ids`: nonempty Id[]; `region_ids`: nonempty Id[]. No merging discrete trial dates into an interval; conflict blocks approval. |
| `HarvestProfile` | `maturity_days`: IntRange[1,366] or null; `basis`: literal `days_after_sowing`; `clearance_days`: IntRange[0,60] or null; `evidence_ids`: Id[]; `limitations`: Reason[]. Unknown maturity prevents scheduling approval. Clearance null requires disclosed farmer assumption/conditional result; a reviewed minimum cannot be undercut by request allowance. Planner uses the larger of reviewed and supplied conservative upper bounds. |
| `Ecology` | `ph_optimal`, `ph_species_absolute`, `ph_reviewed_hard_bounds`: Range[0,14] or null; `ph_method`: string or null; `temperature_optimal_c`, `temperature_species_absolute_c`: finite signed Range or null; `annual_rainfall_optimal_mm`, `annual_rainfall_species_absolute_mm`: nonnegative Range or null. Optimal/absolute/hard are distinct. Annual rainfall is contextual, never demand; only reviewed hard bounds can exclude. |
| `PathogenRule` | `rule_id`, `pathogen_id`: Id; `host_crop_ids`: nonempty Id[]; `minimum_nonhost_interval`: ElapsedInterval; `interval_start`: `last_host_harvest|confirmed_diagnosis` as supported by the source; `applies_when`: literal `confirmed_infestation`; `evidence_ids`: nonempty Id[]. All interval rules initially inactive until reviewed. Cultivar resistance can modify rules only by a separate approved version. |
| `ElapsedInterval` | `value`: integer>0; `unit`: `days|calendar_years`. Preserve the source unit, never convert years to a count of crops or a universal365-day multiplier. Compare a calendar-year anniversary with original month/day; February29 maps to March1 in a nonleap target year under the documented conservative calendar policy. Unknown interval-start date yields conditional status. |
| `TraitEvidence` | `path`: JSON pointer within crop profile; `evidence_ids`: nonempty Id[]. Every nonnull adopted ecological/root/calendar/harvest/management trait must resolve to evidence with the same cultivar/region scope; botanical/family facts may be species-scoped. Project policy never silently becomes a measured trait. |

ReasonCode (closed initial set): `EVIDENCE_UNVERIFIED`, `EVIDENCE_CONFLICT`, `FIELD_SUITABILITY_UNKNOWN`, `SOIL_INPUT_CONFLICT`, `SOIL_CONTEXT`, `SOIL_ASSESSMENT_QUALITATIVE`, `HISTORY_INCOMPLETE`, `DISEASE_CONTEXT_UNKNOWN`, `CALENDAR_SOURCE`, `HARVEST_RANGE`, `CLEARANCE_ASSUMPTION`, `LEGUME_TRANSITION`, `RESIDUE_UNCERTAIN`, `ROOT_REFERENCE_ONLY`, `WATER_MODEL_UNAVAILABLE`, `WATER_COMPARISON_UNAVAILABLE`, `WATER_BUDGET_UNKNOWN`, `CLIMATE_COVERAGE_LOW`, `HISTORICAL_REPLAY`, `SOURCE_UNAVAILABLE`, `DEMO_ASSUMPTION`, `PRIORITY_NORMALIZED`, `OBJECTIVE_UNAVAILABLE`, `RANKING_UNAVAILABLE`, `NO_FEASIBLE_ROTATION`. Messages explain numerical outputs without new unsupported claims.

## Errors

Envelope: `{schema_version:"2.0.0",request_id:UUID,error:{code:ErrorCode,message:string[1,500],retryable:boolean,details:ErrorDetail[]}}`. `ErrorDetail` has `path`: JSON pointer, `reason`: string[1,240]. Preserve request ID header. No provider credentials/body dumps. V1 envelope remains unchanged.

| HTTP / ErrorCode | Trigger / retry |
| --- | --- |
| 422 `VALIDATION_ERROR` | Unknown field/version/crop, invalid units/date/weights, conflicting allowed/excluded, unsupported registry profile or disabled demo; false |
| 422 `ROTATION_CONTEXT_MISMATCH` | Comparison/selected ID not evaluated under current inputs; false; reassessment needed |
| 413 `PAYLOAD_TOO_LARGE` / 415 `UNSUPPORTED_MEDIA_TYPE` | Same BFF limits as v1; false |
| 503 `REQUIRED_DATA_UNAVAILABLE` | Required climate context/replay cannot meet coverage; true. Optional missing soil/ET0 produces degraded200 with null assessments instead |
| 503 `EVALUATION_LIMIT_EXCEEDED` | Entire bounded search cannot finish within policy budget; false for same request; reduce window/candidates; no false exhaustive count |
| 502 `UPSTREAM_UNAVAILABLE` | BFF failure or invalid upstream response; true; inputs preserved |
| 499 `REQUEST_CANCELED` | BFF client cancellation; false |
| 500 `INTERNAL_ERROR` | Internal configuration/calculation failure; true; trace privately |

Valid requests with zero candidates return200/no_feasible_rotation and exclusions. Incomplete suitability knowledge yields conditional candidates, not a claimed no-feasible result. No ranking formula available yields200/degraded with null score/rank. A nonempty response is not proof of complete field feasibility.

## Illustrative request (future approved profile identifiers)

This request demonstrates shape only; the named versions/snapshot do **not** exist as deployed artifacts. `clearance_allowance_days` is an explicit demo assumption pending local review. Exact sowing dates avoid the unresolved date-search optimization in this example.

<!-- phase1-v2-request -->
```json
{
  "schema_version": "2.0.0",
  "location": {"latitude": 31.4504, "longitude": 73.135},
  "region_id": "punjab_pk_v2",
  "catalog_version": "punjab-v2-research-r1",
  "rules_version": "agronomy-v2-research-r1",
  "assessment_end": "2025-10-15",
  "planning": {
    "season_count": 2,
    "calendar_policy": "conservative_latest_clearance",
    "clearance_allowance_days": {"min": 7, "max": 7},
    "seasons": [
      {"season_id": "rabi_2025", "label": "Winter crop", "sowing_start": "2025-11-01", "sowing_end": "2025-11-01", "harvest_deadline": "2026-04-15", "planned_residue_management": "unknown"},
      {"season_id": "kharif_2026", "label": "Summer crop", "sowing_start": "2026-07-15", "sowing_end": "2026-07-15", "harvest_deadline": "2027-01-31", "planned_residue_management": "unknown"}
    ]
  },
  "priorities": {"water_conservation": 1, "soil_health": 1, "climate_resilience": 1},
  "crop_history": [{"crop_id": "maize", "sown_on": "2025-05-01", "harvested_on": "2025-09-30", "residue_management": "retained", "disease_observations": []}],
  "irrigation": {"availability": "available", "season_allocations": [], "application_efficiency": null},
  "soil_inputs": [],
  "field_context": {"drainage": "unknown", "salinity_ec_ds_m": null, "salinity_method": null, "restrictive_depth_cm": null, "disease_history_status": "unknown", "disease_events": [], "source_note": null},
  "climate_scenario": {"kind": "baseline", "baseline_start_year": 1991, "baseline_end_year": 2020},
  "data_selection": {"mode": "demo", "snapshot_id": "faisalabad_multiseason_v2_2025_r1"},
  "allowed_crop_ids": ["wheat", "maize", "mungbean_niab_2021"],
  "excluded_crop_ids": [],
  "top_k": 3,
  "comparison_rotation_ids": [],
  "selected_rotation_id": null
}
```

## Implementation and acceptance gates

Implement only after approval: independent v2 models/schema export; source/evidence registry; bounded planner and conservative harvest profile; reviewed objective policies; soil/water/scenario assessors; separate v2 routes/BFF/types; then explicit demo integration. Reuse existing provider/engine architecture through explicit versioned composition; avoid global constant edits.

Contract acceptance tests must cover strict field/null/enum/number/date validation, 2–4 season bounds,730/731-day horizon edges, exact null versus omitted semantics, all-zero/negative/string weights, conflict handling, per-field soil provenance, missing objective common-basis normalization, rank/null behavior, identical-result determinism, snapshot/ID invalidation, conservative harvest overlap, units/range ordering, replay cross-year/leap masks, error translation/cancellation/size limits, selected outside-top_k summary, and absence of custom→demo fallback. Check generated backend/TypeScript/Ajv round trips together. Golden v1 request/schema/status/score/provenance/hashes must stay unchanged while v2 is enabled/disabled.

Unresolved implementation choices requiring review: scoring policy calibration; date-search pruning and evaluation budget; approved hard pH/pathogen bounds; cultivar harvest clearance; local Kc/stages/effective-rain/storage model; source-specific uncertainty aggregation. The contract supports these explicitly; no approved scientific constants are supplied by this document.
