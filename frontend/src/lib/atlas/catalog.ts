import type { Crop, CropId, FieldContext, ScenarioRequest, StrategyId } from './types';
export const MODEL_VERSION = 'atlas-2.1.0';
export const SOURCES = {
  power: 'https://power.larc.nasa.gov/docs/services/api/temporal/daily/',
  fao: 'https://www.fao.org/4/x0490e/x0490e00.htm',
  yield: 'https://www.fao.org/4/X5647E/x5647e0e.htm',
  budgets: 'https://www.extension.iastate.edu/agdm/crops/pdf/a1-20.pdf',
  termination: 'https://crops.extension.iastate.edu/post/start-planning-2026-cover-crop-termination',
  rotations: 'https://www.sare.org/publications/managing-cover-crops-profitably/Crop-Rotation-with-Cover-Crops/',
  clover: 'https://crops.extension.iastate.edu/encyclopedia/red-clover-cover-crop',
  nitrogen: 'https://extension.umn.edu/agriculture/crop-production/corn/managing-the-rotation-from-alfalfa-to-corn',
};
// SI units throughout: tonnes/ha, USD/tonne, USD/ha, kg N/ha, m roots.
// Budgets are adapted scenarios, not verbatim extension budgets or current market quotes.
const common = { source: SOURCES.budgets, assumption: '2026 USD scenario; adapted Iowa enterprise budget. Prices, nutrient removal and fixation fractions are editable-model assumptions, not measured farm values.' };
export const CROPS: Record<CropId, Crop> = {
  maize: { ...common, id:'maize', name:'Maize', color:'#c79a3c', family:'grass', root:1.2, kc:[0.3,1.2,0.6], yieldT:13.24, price:165, cost:1577, fertilizerN:178, removalN:12, fixation:0, ky:1.25 },
  soybean: { ...common, id:'soybean', name:'Soybean', color:'#718e55', family:'legume', root:1, kc:[0.4,1.15,0.5], yieldT:4.10, price:385, cost:920, fertilizerN:0, removalN:65, fixation:0.7, ky:0.85 },
  wheat: { ...common, id:'wheat', name:'Winter wheat', color:'#b77d45', family:'grass', root:1.2, kc:[0.4,1.15,0.4], yieldT:4.5, price:220, cost:850, fertilizerN:100, removalN:23, fixation:0, ky:1.05, assumption:'Illustrative wheat budget; local enterprise budget required. Yield 4.5 t/ha and price $220/t are assumptions.' },
  oats: { ...common, id:'oats', name:'Oats + alfalfa', color:'#a8ad71', family:'grass', root:0.9, kc:[0.35,1.15,0.45], yieldT:2.87, price:220, cost:1183, fertilizerN:67, removalN:20, fixation:0, ky:1.05, assumption:'Iowa 80 bu/acre oat reference yield; full establishment cost charged in establishment year. No straw or first-year hay revenue credited. Ky is a small-grain proxy.' },
  alfalfa: { ...common, id:'alfalfa', name:'Alfalfa', color:'#588e8a', family:'legume', root:1.5, kc:[0.4,1.05,0.7], yieldT:8.97, price:185, cost:921, fertilizerN:0, removalN:28, fixation:0.85, ky:1.1, assumption:'Iowa 4 US tons/acre reference yield. Establishment charged with oats, not charged twice. Harvest cost remains when no buyer is confirmed.' },
  rye: { ...common, id:'rye', name:'Rye cover', color:'#477958', family:'grass', root:0.7, kc:[0.3,0.85,0.6], yieldT:0, price:0, cost:145, fertilizerN:0, removalN:0, fixation:0, ky:1, source:SOURCES.rotations, assumption:'Illustrative $145/ha establishment and termination cost. No cover-crop sales or nitrogen-fixation credit.' },
  clover: { ...common, id:'clover', name:'Red clover', color:'#a87980', family:'legume', root:0.8, kc:[0.3,0.85,0.65], yieldT:0, price:0, cost:160, fertilizerN:0, removalN:0, fixation:0, ky:1, source:SOURCES.clover, assumption:'Illustrative establishment cost; 45–90 kg N/ha following-crop credit explored as an assumption range. Fixed 100 kg N/ha fixation proxy; no carbon claim.' },
};
export const STRATEGIES: { id: StrategyId; name: string; sequence: string; cycle: CropId[]; question: string }[] = [
  { id:'baseline', name:'Your current rotation', sequence:'Maize → soybean', cycle:['maize','soybean'], question:'A familiar starting point, with the same weather and costs as every alternative.' },
  { id:'cover', name:'Keep the soil covered', sequence:'Maize → rye cover → soybean', cycle:['maize','soybean'], question:'Can winter cover justify its cost and spring water use?' },
  { id:'diverse', name:'Bring a legume into the mix', sequence:'Maize → soybean → wheat + clover', cycle:['maize','soybean','wheat'], question:'Trade a cash-crop year for a grain market, more cover and a nitrogen contribution.' },
  { id:'forage', name:'Make room for forage', sequence:'Maize → soybean → oats + alfalfa → alfalfa', cycle:['maize','soybean','oats','alfalfa'], question:'A longer rotation, conditional on forage equipment and a buyer.' },
];
export const DEFAULT_FIELD: FieldContext = {
  name:'Prairie Creek · Iowa demo', latitude:42.025, longitude:-93.65,
  boundary:[[-93.654,42.022],[-93.646,42.022],[-93.646,42.028],[-93.654,42.028],[-93.654,42.022]],
  boundaryConfirmed:null, baselineConfirmed:null,
  soilCapacity:160, soilSource:'demo-assumption', irrigation:false, irrigationLimit:100, irrigationEfficiency:0.8,
  forageBuyer:null, forageEquipment:null, forageSuitable:null,
  smallGrainBuyer:null, smallGrainEquipment:null, smallGrainSuitable:null,
  coverEquipment:null, laborAvailable:null,
  residueRetained:true, budget:2000, baseline:'maize-soybean',
};
export const DEFAULT_REQUEST: ScenarioRequest = {
  field:DEFAULT_FIELD, horizon:{startYear:2027,years:4},
  initialState:{storageFraction:0.5,snowMm:0,residueCover:0.5,source:'assumption'},
  calendar:{maize:[120,288],soybean:[136,277],ryeSow:295},
  rainfall:100, warming:0, price:100, terminationDay:105,
  weights:{soil:1,water:1,economy:1}, showScores:true,
  decision:{selection:null,notes:'',reviewed:false},
  history:{schemaVersion:'field-history-v1',boundary:null,start:'2024-03-01',end:'2024-11-30',lowNdvi:0.3,maxGapDays:16,rainThresholdMm:25,heatThresholdC:35,windows:[],management:[]},
};
export const NORMALIZATION = {
  version:'iowa-four-year-v1',
  // Fixed policy ranges for FOUR-YEAR totals, not observed extrema or fitted targets.
  deficit:{unit:'mm / 4 years',direction:'min' as const,range:[0,1200] as [number,number],weight:'water' as const},
  coverDays:{unit:'days / 4 years',direction:'max' as const,range:[0,1461] as [number,number],weight:'soil' as const},
  margin:{unit:'2026 USD/ha / 4 years',direction:'max' as const,range:[-4000,12000] as [number,number],weight:'economy' as const},
};
export const WEATHER_BLOCKS = [2013,2017,2021];
export const ASSUMPTIONS = [
  '2027–2030 planning horizon, replayed separately with 2013–2016, 2017–2020 and 2021–2024 weather. Three paired historical members, not forecasts or probabilities.',
  'Each weather block starts from the same entered water, snow and residue state. States carry across all four years; terminal perennial stands are not assigned a resale or future nitrogen value.',
  'Iowa boundary, crop calendars, soil capacity and management require farmer confirmation. Day-of-year calendars are illustrative, not cultivar phenology.',
  'FAO-56 reference ET uses a mean-RH approximation. One 1.5 m available-water profile, simple root access and snowmelt, 10% liquid-input runoff, free overflow drainage. Frozen-soil infiltration and capillary rise are not calibrated; capillary rise is set to zero.',
  'Residue cover decays with an illustrative 120-day half-life and reduces bare-soil evaporation only. It does not generate a carbon, infiltration or erosion-benefit claim. Alfalfa establishment with oats is a simplified sequential resource partition.',
  'Illustrative irrigation tops available water up toward half capacity on cropped days with mean temperature >5°C and potential ET >0.5 mm/day. Irrigation allocation caps gross withdrawal at the field inlet. Applied root-zone water is withdrawal times entered efficiency; application losses are explicit. Conveyance losses upstream of the inlet are unknown.',
  'Reference yields and water-deficit yield response are uncalibrated scenarios. Heat, fertility, disease and cultivar effects are not fitted. Unknown buyers imply hypothetical sales, not assured revenue; feasibility remains unknown.',
  'Gross margin uses constant 2026 USD assumptions, excluding land rent, financing and general overhead. Establishment costs are charged when the operation occurs. No discounting or terminal asset valuation.',
  'Nitrogen is a partial input-minus-harvest illustration, not a soil-N balance or fertilizer prescription. Following-crop credits reduce fertilizer once. Carbon change, soil loss, pathogen reductions and probabilities of benefit are withheld.',
  'Preference scores use fixed four-year ranges: water shortfall 0–1200 mm (lower better), living cover 0–1461 days (higher better), gross margin −4000–12000 USD/ha (higher better). Ranges are policy assumptions, not validated targets. Out-of-range scores are clipped and flagged.',
  'Pareto status compares mean outcomes across all three objectives, independent of preference weights. Scores average member utilities; displayed ranges are descriptive scenario spread, not predictive intervals. No overall preference while a potentially feasible option has unknown constraints.',
];
