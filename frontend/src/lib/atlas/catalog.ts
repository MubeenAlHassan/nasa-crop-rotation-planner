import type { Crop, CropId, FieldContext, ScenarioRequest, StrategyId } from './types';
export const MODEL_VERSION = 'atlas-1.0.0';
export const SOURCES = {
  power: 'https://power.larc.nasa.gov/docs/services/api/temporal/daily/',
  fao: 'https://www.fao.org/4/x0490e/x0490e00.htm',
  yield: 'https://www.fao.org/4/X5647E/x5647e0e.htm',
  budgets: 'https://www.extension.iastate.edu/agdm/crops/pdf/a1-20.pdf',
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
export const DEFAULT_FIELD: FieldContext = { name:'Prairie Creek · Iowa demo', latitude:42.025, longitude:-93.65,
  boundary:[[-93.654,42.022],[-93.646,42.022],[-93.646,42.028],[-93.654,42.028],[-93.654,42.022]],
  soilCapacity:160, soilSource:'demo-assumption', irrigation:false, irrigationLimit:100, forageBuyer:false, forageEquipment:false,
  smallGrainBuyer:true, smallGrainEquipment:true, residueRetained:true, budget:2000, baseline:'maize-soybean' };
export const DEFAULT_REQUEST: ScenarioRequest = { field:DEFAULT_FIELD, rainfall:100, warming:0, price:100, terminationDay:105, weights:{soil:1,water:1,economy:1} };
export const ASSUMPTIONS = [
  'Historical weather replay, 2013–2024; scenarios are not forecasts.',
  'Crop calendars, soil capacity and management describe an illustrative Iowa field.',
  'FAO-56 ET0 with mean-relative-humidity approximation; daily crop coefficients and a one-layer soil-water bucket. No calibrated field-yield prediction.',
  'Snow uses a simple 3 mm/°C/day melt rule; runoff is 10% of liquid input. Soil-water storage starts half-full and carries between years.',
  'All prices and costs are constant 2026-dollar assumptions. Gross margin excludes land rent, financing and general overhead; no discounting.',
  'Yield response is bounded FAO-style water response; nutrient, pest and heat yield effects are not modeled.',
  'Nitrogen balance is a partial input-minus-harvest budget, excluding mineralization and environmental losses. Nitrogen credits reduce fertilizer; they are not counted as new nitrogen inputs.',
  'Priority match is an equal-domain weighted rank by default, not a measured soil-health score. Soil domain combines living-cover duration and following-crop N credit.',
];
