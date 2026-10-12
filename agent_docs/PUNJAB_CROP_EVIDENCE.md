# Phase 1 — Punjab crop evidence ledger

Reviewed 2026-10-12. Status: **research only; no production catalog changes**. This ledger supplements, and does not replace, the v1 evidence map in `backend/scripts/test_crop_catalog.py`. A reference establishes the stated trait in its stated context; it does not validate an entire crop profile.

## Recommendation and scope

The smallest useful expansion **for the specified fixed sowing dates** is **one crop: mungbean, cultivar NIAB Mung-2021**. Its Punjab irrigated-area calendar overlaps the existing summer maize calendar on July 15. With the existing wheat crop, this permits two different two-season sequences. The date arithmetic and conditional field requirements are in [NEW_DEMO_DESIGN.md](NEW_DEMO_DESIGN.md). Neither branch requires changing a v1 crop window. This is not a claim that no alternatives could exist with different dates or histories.

Lentil, cultivar Punjab Masoor-2019, is the next research candidate for winter diversification. Sesame TS-5 is a secondary oilseed candidate with a calendar conflict. These are deliberately separate cultivar profiles. There is no evidence-backed reason to copy resistance, maturity or management traits from another cultivar. No candidate is ready for unconditional automated farm recommendations.

## Trait profiles

### Mungbean — Vigna radiata (L.) R. Wilczek, Fabaceae

| Trait | Evidence and interpretation |
| --- | --- |
| Selected cultivar / region | NIAB Mung-2021, bred at NIAB Faisalabad; official descriptor specifies irrigated Punjab [S01]. |
| Planting / duration | Spring March 1–31; summer June 15–July 15; 70–80 days to maturity in the descriptor [S01, sections 1.3 and 2.1–2.5]. These are cultivar claims, not the generic species cycle. |
| Harvest season | Calendar calculation: spring sowing implies approximately May–June maturity; summer sowing implies August–October maturity. Actual cutting, pod picking, drying and field clearance remain management-dependent. Calculated dates are not observations. |
| pH | EcoCrop species optimal 5.5–6.2; absolute 4.3–8.3 [S02]. These are context ranges, **not locally validated hard eligibility bounds**. Alkaline Faisalabad fields need cultivar-specific verification. |
| Temperature / rain | Species optimal 21–36 °C, absolute 8–40 °C; **annual** rainfall optimal 650–900 mm, absolute 500–1,250 mm [S02]. Annual rainfall cannot be divided or reused as seasonal irrigation need. No verified local flowering heat limit. |
| Rooting | FAO-56 green gram/cowpeas reference effective rooting range 0.6–1.0 m [S08, Table 22]; no NIAB cultivar root measurement. |
| Water | Short crop occupancy is supported; a quantitative seasonal ETc, irrigation allocation or local water-saving percentage is **unknown**. FAO-56 has a green gram/cowpeas Kc row, but its Mediterranean stage calendar is not this cultivar's Punjab calendar [S09]. Local irrigation trials confirm that management matters [S19]. |
| Rotation / benefits | Pulse provides a cereal–legume transition and a different family. Potential biological N fixation is conditional; harvested grain exports N. No automatic N fertilizer credit or guarantee of higher SOC [S10]. |
| Constraints / limitations | Irrigated profile; adequate drainage; local salinity, establishment, disease, nodulation, harvest clearance and seed availability must be checked. A named/pathogen-specific nonhost interval is unknown. Do not assign zero disease risk from a different family or a six-crop Fabaceae ban. |

The EcoCrop life-span entry says perennial, inconsistent with the selected seasonal grain profile. Do not import it into the proposed cultivar lifecycle. Descriptor resistance terminology alone does not establish a universal resistance rating for every pathogen or environment.

### Lentil — Lens culinaris Medik., Fabaceae

| Trait | Evidence and interpretation |
| --- | --- |
| Selected cultivar / region | Punjab Masoor-2019, PRI/AARI Faisalabad; cultivar development paper includes Punjab adaptation and irrigated/arid evaluations [S03]. |
| Planting | At Faisalabad, 2016–17 trial dates October 30, November 15, November 30; 2017–18 dates October 10, October 25, November 10, November 25. Earlier treatments generally outperformed late sowing [S03, Methods; Figures 6–7]. These discrete tested dates do not establish a continuous recommended window. October 30 is the conservative date used in the optional design. |
| Duration / harvest | Cultivar maturity 125–130 days [S03, characterization and Table 6, printed pp.15–16]. October 30 sowing implies March maturity. Harvest clearance is separate. Do not substitute a different Masoor cultivar's duration or generic EcoCrop 70–240-day range. |
| pH | Species optimal 5.5–7.5, absolute 4.5–8.2 [S04]. Local cultivar hard limits remain unverified. |
| Temperature / rain | Species optimal 15–29 °C, absolute 5–32 °C; **annual** rainfall optimal 600–1,000 mm, absolute 250–2,500 mm [S04]. Not seasonal water requirements. |
| Rooting / water | FAO-56 lentil effective rooting reference 0.6–0.8 m [S08]. Seasonal ETc and relative water class for a matched Faisalabad management regime remain unknown; FAO coefficients/stages require regional adjustment [S09]. |
| Rotation / benefits | Winter pulse alternative, legume diversification; no guaranteed net N addition. Successive lentil–mungbean requires shared-pathogen review rather than family-based inference. |
| Constraints / limitations | Assess drainage, lodging, disease and harvest conditions. The cultivar paper reports moderate rust/Botrytis resistance; the government listing has different disease wording [S03, S05]. Record the disagreement rather than claim immunity. No supported numerical disease-break interval yet. |

### Sesame — Sesamum indicum L., Pedaliaceae

| Trait | Evidence and interpretation |
| --- | --- |
| Selected cultivar / region | TS-5, Oilseeds Research Institute, Faisalabad, Punjab candidate [S06]. |
| Planting conflict | Punjab Agriculture cultivar table: April 15–June 15. Pakistan Oilseed Department 2024 annex: June 15–July 15 [S06, S07]. June 15 is their shared boundary, **not sufficient proof of a validated local window**. Neither merge the intervals nor silently prefer one. |
| Duration / harvest | Punjab table reports 110–120 days [S06]. June 15 would arithmetically imply October maturity. NIAB Sesame-2016's 90–95 days does not belong to TS-5 [S07]. |
| pH | Species optimal 5.5–7.5; absolute 4.5–8.0 [S11]. No local TS-5 hard limits. |
| Temperature / rain | Species optimal 20–30 °C; absolute 10–40 °C; **annual** rainfall optimal 500–1,000 mm, absolute 300–1,500 mm [S11]. Not ETc or proof of rainfed viability. |
| Rooting / water | FAO-56 sesame effective rooting reference 1.0–1.5 m [S08]. Local stage lengths and quantitative water comparison are unverified. Do not create a low-water score from the oilseed label. |
| Rotation / benefits | Different family and oilseed product diversify a cereal system. Quantitative residue, N-demand class, disease-break interval and water savings are unknown. |
| Constraints / limitations | Well-drained species profile; local waterlogging, salinity, harvest/drying and capsule loss risks require verification. Resolve cultivar calendar and harvest practice with ORI before selection. |

## Machine-readable research proposals

This block is consumed only by the nonproduction Phase 1 documentation tests. It is **not** a runtime catalog. `null` means no sufficiently scoped evidence approved here. Optimal and absolute envelopes must not become hard thresholds through a default mapping. Taxonomy and root reference values are species-level; cultivar-specific claims identify their source separately. `annual_rainfall_*` uses calendar-year context, not a crop-water budget.

<!-- phase1-proposals -->
```json
{
  "status": "research_only",
  "crops": [
    {
      "crop_id": "mungbean_niab_2021",
      "botanical_name": "Vigna radiata",
      "family": "Fabaceae",
      "cultivar": "NIAB Mung-2021",
      "calendar_status": "descriptor_supported",
      "planting_windows": [["0301", "0331"], ["0615", "0715"]],
      "maturity_days": [70, 80],
      "calendar_source": "S01",
      "species_source": "S02",
      "ph_optimal": [5.5, 6.2],
      "ph_absolute": [4.3, 8.3],
      "temperature_optimal_c": [21, 36],
      "temperature_absolute_c": [8, 40],
      "annual_rainfall_optimal_mm": [650, 900],
      "annual_rainfall_absolute_mm": [500, 1250],
      "root_reference_m": [0.6, 1.0],
      "root_source": "S08",
      "hard_ph_bounds": null,
      "seasonal_water_demand_mm": null,
      "nitrogen_credit_kg_ha": null,
      "pathogen_break_years": null
    },
    {
      "crop_id": "lentil_punjab_masoor_2019",
      "botanical_name": "Lens culinaris",
      "family": "Fabaceae",
      "cultivar": "Punjab Masoor-2019",
      "calendar_status": "tested_dates_only",
      "tested_sowing_mmdd": ["1010", "1025", "1030", "1110", "1115", "1125", "1130"],
      "planting_windows": [],
      "maturity_days": [125, 130],
      "calendar_source": "S03",
      "species_source": "S04",
      "ph_optimal": [5.5, 7.5],
      "ph_absolute": [4.5, 8.2],
      "temperature_optimal_c": [15, 29],
      "temperature_absolute_c": [5, 32],
      "annual_rainfall_optimal_mm": [600, 1000],
      "annual_rainfall_absolute_mm": [250, 2500],
      "root_reference_m": [0.6, 0.8],
      "root_source": "S08",
      "hard_ph_bounds": null,
      "seasonal_water_demand_mm": null,
      "nitrogen_credit_kg_ha": null,
      "pathogen_break_years": null
    },
    {
      "crop_id": "sesame_ts5",
      "botanical_name": "Sesamum indicum",
      "family": "Pedaliaceae",
      "cultivar": "TS-5",
      "calendar_status": "conflicting_sources",
      "planting_windows": [],
      "conflicting_windows": [
        {"start_mmdd": "0415", "end_mmdd": "0615", "source_id": "S06"},
        {"start_mmdd": "0615", "end_mmdd": "0715", "source_id": "S07"}
      ],
      "maturity_days": [110, 120],
      "calendar_source": "S06",
      "species_source": "S11",
      "ph_optimal": [5.5, 7.5],
      "ph_absolute": [4.5, 8.0],
      "temperature_optimal_c": [20, 30],
      "temperature_absolute_c": [10, 40],
      "annual_rainfall_optimal_mm": [500, 1000],
      "annual_rainfall_absolute_mm": [300, 1500],
      "root_reference_m": [1.0, 1.5],
      "root_source": "S08",
      "hard_ph_bounds": null,
      "seasonal_water_demand_mm": null,
      "nitrogen_credit_kg_ha": null,
      "pathogen_break_years": null
    }
  ]
}
```

## Source register

Accessed/reviewed 2026-10-12. Undated pages are marked n.d.; a cultivar name's year is not assumed to be the document publication date. PDF printed page numbers differ from viewer indices. Secondary summaries were discovery aids, not evidence for numeric traits.

| ID | Full reference / locator | Scope and access limits |
| --- | --- | --- |
| S01 | NIAB (PAEC), M. Jawad Asghar, n.d. [Mungbean variety NIAB Mung 2021 descriptor](https://pbrr.gov.pk/SiteImage/Misc/files/cases/Mungbean-75-23-NIAB-Mung-2021/Morphological-Descriptor.pdf), PBRR filing, 2 pp.; General 1.3, 2.1–2.5. | Named local breeder/cultivar. Extracted PDF text reviewed; image rendering unavailable. Recheck signed original before activation. |
| S02 | FAO EcoCrop, n.d. [Vigna radiata data sheet, ID 2150](https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=2150), [taxonomy](https://ecocrop.apps.fao.org/ecocrop/srv/en/cropView?id=2150), Ecology/Cultivation. | Global species compilation, not a Punjab trial; Leguminosae is the Fabaceae synonym used in taxonomy. |
| S03 | Saeed, M.S., Kaukab, S., Rehman, A.U., Amin, M.A., Khan, R.A.H., Khan, M.E., and Mahboob, A. (2022). [Chronological levels for selection and development of disease resistant, climate-resilient and high yielding lentil cultivar for food security](https://ikprress.org/index.php/PCBMB/article/download/7706/6805). Plant Cell Biotechnology and Molecular Biology 23(23–24):6–21. DOI 10.56557/PCBMB/2022/v23i23-247706. Methods pp.8, characterization pp.15–16, Figures 6–7 pp.17–18. | PRI Faisalabad local cultivar trials. Search engine PDF title incorrectly mentions Saraca; PDF body is the lentil paper. |
| S04 | FAO EcoCrop, n.d. [Lens culinaris data sheet, ID 7209](https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=7209), [taxonomy](https://ecocrop.apps.fao.org/ecocrop/srv/en/cropView?id=7209), Ecology. | Global species envelopes; Leguminosae/Fabaceae family synonyms. |
| S05 | Punjab Agriculture Department / AARI, n.d. [Lentil varieties](https://agripunjab.gov.pk/Lentil), Punjab Masoor-2019 row. | Official regional listing; indexed text available, direct fetch failed. Disease wording needs reconciliation with S03. |
| S06 | Punjab Agriculture Department / AARI Oilseeds Research Institute, n.d. [Sesame varieties](https://agripunjab.gov.pk/aari-cvoriSesame), TS-5 row. | Official Punjab cultivar listing; indexed table reviewed, direct fetch timed out. Calendar provisional. |
| S07 | Pakistan Oilseed Department (2024). [Field survey report of sesame](https://pod.gov.pk/SiteImage/Downloads/Final%20Field%20Survey%20Report%20of%20sesame%20%282024%29%20C.pdf), Annex II, printed p.37, TS-5 and other named cultivar rows. | Pakistan official report; conflicts with S06. |
| S08 | Allen, R.G., Pereira, L.S., Raes, D., and Smith, M. (1998). [Crop evapotranspiration: FAO Irrigation and Drainage Paper 56, Chapter 8](https://www.fao.org/4/x0490e/x0490e0e.htm), Table 22 and footnotes. | Generic effective root ranges; upper ends assume no restrictive soil layer. |
| S09 | Allen et al. (1998). [FAO-56 Chapter 6](https://www.fao.org/4/x0490e/x0490e0b.htm), Tables 11–12; [Chapter 2](https://www.fao.org/4/x0490e/x0490e06.htm), reference ET0 equation. | Reference methodology, not cultivar/field calibration. |
| S10 | Pearson, C.J., Norman, D.W., and Dixon, J. (1995). [Sustainable dryland cropping in relation to soil productivity, Chapter 4: Sustainable crop rotations](https://www.fao.org/4/v9926e/v9926e06.htm), FAO Soils Bulletin72; Rotations and soil productivity section. | Directional management guidance; no Field Shift point scores or guaranteed N credits. |
| S11 | FAO EcoCrop, n.d. [Sesamum indicum data sheet, ID 1937](https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=1937), [taxonomy page](https://ecocrop.apps.fao.org/ecocrop/srv/en/cropView?id=1937), Ecology/Taxon. | Global species, family Pedaliaceae. |
| S12 | FAO EcoCrop, n.d. [Triticum aestivum, ID 2114](https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=2114), [Cicer arietinum, ID 2479](https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=2479), [Zea mays, ID 238663](https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=238663), Ecology. | Optimal vs absolute distinction for existing crops. |
| S13 | Rasool, I., Hussain, K., Ameen, M.A., Batool, A., Anam, M., Aziz, A., Hussain, A., Mahmood, M.T., Maqsood, Z., Ahmad, R.T., and Samad, R.A. (2024). [Evaluation of chickpea varieties for climate resilience and yield stability at different planting dates](https://bcsrj.com/ojs/index.php/bcsrj/article/download/986/1230/3302), Biological and Clinical Sciences Research Journal, 2024:986, DOI 10.54112/bcsrj.v2024i1.986; abstract/Methods, pp.1–2. | Faisalabad 2021–22/2022–23, breeding lines and Bittal-2016 check; dates tested, not a universal continuous window. |
| S14 | Gaur, P.M. et al. (2010). [Chickpea seed production manual](https://oar.icrisat.org/10276/1/ChickpeaManual_full.pdf), ICRISAT, printed pp.3, 8, 12, 19. | General/Indian management context; Fusarium-infested-field exclusion in years, not all Fabaceae in crop counts. |
| S15 | Brouwer, C., and Heibloem, M. (1986). [Irrigation water management: irrigation water needs, Chapter 2](https://www.fao.org/4/s2022e/s2022e02.htm), FAO Training Manual3, Tables4–5. | Broad total crop-water needs/growing periods; not rainfall, irrigation alone or local cultivar harvest guarantees. |
| S16 | USDA NRCS, n.d. [Soil health assessment](https://www.nrcs.usda.gov/conservation-basics/soil/soil-health/soil-health-assessment); [Soil quality indicators: total organic carbon](https://www.nrcs.usda.gov/sites/default/files/2022-10/total_organic_carbon.pdf). USDA NRCS (2025), [Technical Note 470-16: Soil health testing to support conservation planning](https://directives.nrcs.usda.gov/sites/default/files2/1748890495/TN%20470-16%20Soil%20Health%20Testing%20to%20Support%20Conservation%20Planning.pdf), SOC and total-carbon interpretation. | Multivariate/context-sensitive assessment; US thresholds must not be imported to Punjab. Calcareous soils require inorganic-carbon consideration. |
| S17 | NASA POWER, n.d. [Daily API documentation](https://power.larc.nasa.gov/docs/services/api/temporal/daily/), parameters, time standard, point service. | Authentic gridded historical observations; specify UTC, distinguish native spatial support from field measurement. |
| S18 | ISRIC, n.d. [SoilGrids properties FAQ](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html), units/depths/uncertainty; [access FAQ](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html), access services. | Gridded modeled estimates; REST service paused at review time; WCS/WebDAV access alternatives. |
| S19 | Sadaf, A., and Tahir, M. (2017). [Effect of potassium on growth, yield and quality of mungbean under different irrigation regimes](https://bbasr.org/index.php/home/article/view/10), Bulletin of Biological and Allied Sciences Research, 2017(1):10. DOI 10.54112/bbasr.v2017i1.10; abstract and experimental setting. | UAF Faisalabad May–August2015 trial, NIAB-MUNG2011; supports management dependence, no numerical trait transferred to NIAB Mung-2021. |
| S20 | Existing catalog evidence: Agricultural Policy Institute, [Wheat policy analysis for 2017–18 crop](https://api.gov.pk/SiteImage/Policy/WheatPolicyAnalysis%20For2017-18Crop.pdf), Punjab irrigated sowing times; USAID, [Farm Management Handbook](https://pdf.usaid.gov/pdf_docs/PNABW084.pdf), p.94 Table 13, Faisalabad/Jhang main maize varieties. | Inherited v1 calendar evidence, historical guidance; contemporary cultivar/harvest review required for v2. |

## Evidence decision and validation gates

1. Calendar and maturity claims are anchored to a named cultivar wherever available. Species ecology is explicitly separate. No annual rainfall entry is presented as seasonal demand.
2. **Mungbean**: approve research scheduling only; require NIAB/PRI confirmation of current sowing guidance, reliable seed supply, local pH/salinity/drainage suitability, crop-specific pathogen hosts, and full harvest/clearance range.
3. **Lentil**: approve discrete-date trial evidence and duration for research; continuous window, shared legume pathogen intervals and field suitability remain gates. Preserve resistance disagreement.
4. **Sesame**: block scheduling approval until ORI resolves S06/S07 with cultivar, sowing system and location specified.
5. Water-comparison activation requires validated stage lengths, Kc adjustment, consistent ET0 inputs and effective-rainfall/storage assumptions for **every** compared crop. Relative labels need matched evidence too; no invented category or percentage.
6. N/residue and rooting facts support qualitative reasoning. Numerical nutrient credit, SOC change, yield, profit and root-score constants are not established by these references.

Acceptance: source/locator and context attached to each adopted trait; nulls remain for unverified values; no mixed-cultivar profile; signed local review of critical gates; conflicting or species-only evidence cannot silently become a hard rule. Documentation tests check faithful transcription and calendars; they do not replace agronomic peer review.
