import {STRATEGIES} from './catalog';
import {ecoMatches,type EcoEvidence} from './ecostress';
import {matchesEvidenceField,type FieldEvidence} from './field-evidence';
import {graceContains,type GraceEvidence} from './grace';
import {historyMatchesField,usableObservation} from './history';
import type {NasaSeason} from './nasa-season';
import type {EvidenceSeries,ScenarioRequest,StrategyId,StrategyResult} from './types';

export const RATIONALE_METHOD='strategy-rationale-v1';

export type EvidenceApplicability='matching'|'mismatched'|'unavailable'|'regional-only'|'not-used';
export type EvidenceRole='observed-context'|'withheld'|'management-assumption';

export interface RationaleCitation {
  id:string;
  source:'power-forcing'|'farmer-history'|'farmer-management'|'landsat'|'seasonal-regional'|'ecostress'|'grace'|'template';
  role:EvidenceRole;
  applicability:EvidenceApplicability;
  period:string|null;
  summary:string;
  claimLimit:string;
}

export interface AgronomicMechanism {
  id:string;
  title:string;
  description:string;
  claimLimit:string;
}

export interface StrategyRationale {
  method:typeof RATIONALE_METHOD;
  strategyId:StrategyId;
  templateBasis:string;
  question:string;
  mechanisms:AgronomicMechanism[];
  observedContext:RationaleCitation[];
  contraryOrMissing:string[];
  localReviewQuestions:string[];
  projectedBenefitsNote:string;
  scoringUnaffected:true;
}

export interface RationaleEvidenceBundle {
  weather:EvidenceSeries|null;
  fieldEvidence?:FieldEvidence|null;
  seasonalPackages?:NasaSeason[];
  ecostress?:EcoEvidence|null;
  grace?:GraceEvidence|null;
}

const TEMPLATE_BASIS='Fixed Atlas template. Satellite panels explore history and do not generate or rank this rotation.';
const BENEFITS_NOTE='Modeled water, cover and margin outcomes are unvalidated scenarios. They are not measured farm benefits, causal satellite effects or probabilities of improvement.';

const MECHANISMS:Record<StrategyId,AgronomicMechanism[]>={
  baseline:[
    {id:'familiar-cash',title:'Familiar dual cash-crop sequence',description:'Maize–soybean keeps known markets and equipment while remaining the comparison baseline for every alternative.',claimLimit:'Familiarity is not evidence of soil, water or pest resilience.'},
    {id:'winter-gap',title:'Winter living-cover gap',description:'After harvest and before spring planting the calendar leaves a living-cover gap unless residue or another crop is present.',claimLimit:'Calendar gaps are not measured bare soil; residue and weeds are unknown without local observation.'},
  ],
  cover:[
    {id:'winter-cover',title:'Winter living cover between cash crops',description:'Rye is scheduled to occupy the post-maize / pre-soybean window so living cover continues into colder months.',claimLimit:'Calendar occupancy is not measured protective biomass, infiltration improvement or erosion reduction.'},
    {id:'spring-water',title:'Spring water-use trade-off',description:'Cover growth and residue can change spring evaporation and early soybean water access in the illustrative water balance.',claimLimit:'Modeled spring water use is not a field measurement of cover benefit or yield protection.'},
  ],
  diverse:[
    {id:'third-crop',title:'Third crop and legume companion',description:'Winter wheat with red clover adds a small-grain year and an assumed following-crop nitrogen contribution range.',claimLimit:'Nitrogen figures are partial input/fixation illustrations, not fertilizer advice or measured soil-N change.'},
    {id:'sequence-break',title:'Breaks continuous maize–soybean timing',description:'Inserting wheat/clover changes the cash-crop sequence and winter occupancy relative to the baseline.',claimLimit:'Sequence change alone does not prove pest interruption, disease break or soil-carbon gain.'},
  ],
  forage:[
    {id:'perennial-cover',title:'Multi-year forage occupancy',description:'Oats with undersown alfalfa, then alfalfa, extend living cover across seasons within the four-year horizon.',claimLimit:'Living-cover days include dormancy and do not measure biomass, rooting depth realized in the field or erosion control.'},
    {id:'market-conditional',title:'Forage value is market-conditional',description:'Illustrative hay revenue depends on confirmed buyer, equipment and site suitability constraints.',claimLimit:'Hypothetical sales while markets are unknown must not be read as assured income.'},
  ],
};

const COMMON_QUESTIONS=[
  'Are planting, harvest and termination dates realistic for this cultivar and field?',
  'Is available soil-water capacity measured, or still an assumption?',
  'Do local costs, prices and nutrient credits match these scenario budgets?',
];

function strategyQuestions(id:StrategyId,request:ScenarioRequest):string[] {
  const out=[...COMMON_QUESTIONS];
  if(id==='cover'){
    out.push('Can rye establishment and termination fit labor and equipment without delaying soybean?');
    out.push(`Is the modeled rye termination on day ${request.terminationDay} locally appropriate?`);
  }
  if(id==='diverse'){
    out.push('Are wheat and clover calendars, markets and clover termination before maize confirmed locally?');
    out.push('Is the assumed following-crop nitrogen credit range acceptable to the adviser?');
  }
  if(id==='forage'){
    out.push('Are forage buyer, machinery and site suitability confirmed or explicitly unsuitable?');
    out.push('Is a productive alfalfa stand after year four valued locally, given this model assigns no residual asset?');
  }
  if(id==='baseline')out.push('Does the entered maize/soybean phase match the actual next crop on this field?');
  if(request.field.boundaryConfirmed!==true)out.push('Is the cropped boundary confirmed before treating any satellite window as field evidence?');
  if(request.field.baselineConfirmed!==true)out.push('Has the current/baseline rotation been farmer-confirmed for this field?');
  if(!request.enterprise?.reviewed)out.push('Have local crop prices, operating costs and nitrogen-credit values been reviewed against a current quote or adviser?');
  return out;
}

function powerCitation(weather:EvidenceSeries|null):RationaleCitation {
  if(!weather)return {id:'power-unavailable',source:'power-forcing',role:'withheld',applicability:'unavailable',period:null,summary:'POWER simulation forcing is unavailable for this export.',claimLimit:'Without forcing weather, strategy outcomes are not computed.'};
  return {
    id:weather.id,
    source:'power-forcing',
    role:'observed-context',
    applicability:'regional-only',
    period:`${weather.start} to ${weather.end}`,
    summary:`Paired historical POWER weather (${weather.spatialSupport}) drives every strategy with identical initial water, snow and residue.`,
    claimLimit:'Regional forcing is not a field weather station and does not by itself justify a rotation choice.',
  };
}

function historyCitations(request:ScenarioRequest):RationaleCitation[] {
  const applicable=historyMatchesField(request.history,request.field);
  if(!request.history.windows.length&&!request.history.management.length){
    return [{id:'history-empty',source:'farmer-history',role:'withheld',applicability:applicable?'matching':'unavailable',period:request.history.start&&request.history.end?`${request.history.start} to ${request.history.end}`:null,summary:'No farmer-reviewed windows or management records are attached.',claimLimit:'Absence of reviewed history is not evidence that the field was covered or bare.'}];
  }
  if(!applicable){
    return [{id:'history-mismatched',source:'farmer-history',role:'withheld',applicability:'mismatched',period:null,summary:`${request.history.windows.length} window(s) and ${request.history.management.length} management record(s) are retained but not attributed to the current boundary.`,claimLimit:'Mismatched history must not support field-specific rationale.'}];
  }
  const windows=request.history.windows.map(w=>({
    id:`window-${w.id}`,
    source:'farmer-history' as const,
    role:'observed-context' as const,
    applicability:'matching' as const,
    period:`${w.start} to ${w.end}`,
    summary:`Farmer ${w.status} window labeled ${w.cover}: ${w.note||'no note'}.`,
    claimLimit:w.status==='uncertain'?'Uncertain intervals are review hypotheses, not detected bare soil or confirmed damage.':'Farmer confirmation is local knowledge, not independent remote-sensing validation.',
  }));
  const management=request.history.management.map(m=>({
    id:`mgmt-${m.id}`,
    source:'farmer-management' as const,
    role:'observed-context' as const,
    applicability:'matching' as const,
    period:m.date,
    summary:`Recorded ${m.operation} (${m.crop||'unspecified crop'}): ${m.note||'no note'}.`,
    claimLimit:'Management records describe entered operations; they do not prove satellite-derived cover class.',
  }));
  return [...windows,...management];
}

function landsatCitation(request:ScenarioRequest,fieldEvidence:FieldEvidence|null|undefined):RationaleCitation {
  if(!fieldEvidence)return {id:'landsat-unavailable',source:'landsat',role:'withheld',applicability:'unavailable',period:null,summary:'Landsat field package not loaded.',claimLimit:'Missing Landsat evidence cannot support or refute a template.'};
  if(!matchesEvidenceField(request.field,fieldEvidence)){
    return {id:'landsat-mismatched',source:'landsat',role:'withheld',applicability:'mismatched',period:null,summary:'Landsat package boundary differs from the current field; indices are not attributed to this polygon.',claimLimit:'Mismatched satellite evidence is withheld from strategy rationale.'};
  }
  const usable=fieldEvidence.observations.filter(usableObservation);
  const period=usable.length?`${usable[0].observedAt.slice(0,10)} to ${usable.at(-1)!.observedAt.slice(0,10)}`:null;
  return {
    id:'landsat-matching',
    source:'landsat',
    role:'observed-context',
    applicability:'matching',
    period,
    summary:`${usable.length} usable Landsat field summaries (≥80% valid area). Low NDVI remains a review cue only.`,
    claimLimit:'No automatic bare-soil/residue classifier; Landsat does not generate or rank rotations.',
  };
}

function seasonalCitation(packages:NasaSeason[]|undefined):RationaleCitation {
  if(!packages?.length)return {id:'seasonal-unavailable',source:'seasonal-regional',role:'withheld',applicability:'unavailable',period:null,summary:'No NASA seasonal moisture/precipitation packages are loaded.',claimLimit:'Missing seasonal context is not treated as zero rainfall or dry soil.'};
  const months=packages.map(p=>p.month).sort();
  const nearestAccepted=packages.reduce((n,p)=>n+p.smap.filter(r=>r.values[4]!==null).length,0);
  return {
    id:'seasonal-regional',
    source:'seasonal-regional',
    role:'observed-context',
    applicability:'regional-only',
    period:`${months[0]} to ${months.at(-1)}`,
    summary:`${packages.length} loaded regional month package(s). Nearest-pilot L3 accepted retrieval count in loaded packages: ${nearestAccepted}.`,
    claimLimit:'SMAP/IMERG remain regional native cells. Rejected L3 slots stay withheld; L4 assimilation is not a field probe.',
  };
}

function ecoCitation(request:ScenarioRequest,eco:EcoEvidence|null|undefined):RationaleCitation {
  if(!eco)return {id:'eco-unavailable',source:'ecostress',role:'withheld',applicability:'unavailable',period:null,summary:'ECOSTRESS package not loaded.',claimLimit:'Missing thermal/ET evidence cannot diagnose crop stress for a template.'};
  if(!ecoMatches(eco,request)){
    return {id:'eco-mismatched',source:'ecostress',role:'withheld',applicability:'mismatched',period:null,summary:'ECOSTRESS boundary differs from the current field; thermal/ET means are not field evidence here.',claimLimit:'Mismatched ECOSTRESS evidence is withheld from strategy rationale.'};
  }
  const usable=eco.records.filter(r=>Object.values(r.bands).some(b=>b.fieldMean!==null));
  return {
    id:'eco-matching',
    source:'ecostress',
    role:'observed-context',
    applicability:'matching',
    period:usable.length?`${usable[0].start.slice(0,10)} to ${usable.at(-1)!.start.slice(0,10)}`:null,
    summary:`${usable.length} ECOSTRESS record(s) with a usable field mean after QA. Sparse dates and withheld June ET/ESI remain explicit.`,
    claimLimit:'LST is mixed surface temperature; ET/ESI are not irrigation requirements or stress diagnoses.',
  };
}

function graceCitation(request:ScenarioRequest,grace:GraceEvidence|null|undefined):RationaleCitation {
  if(!grace)return {id:'grace-unavailable',source:'grace',role:'withheld',applicability:'unavailable',period:null,summary:'GRACE/GRACE-FO regional package not loaded.',claimLimit:'Missing regional storage context is not field moisture.'};
  if(!graceContains(grace,request.field.boundary)){
    return {id:'grace-outside',source:'grace',role:'withheld',applicability:'mismatched',period:null,summary:'Current boundary falls outside the captured GRACE regional support.',claimLimit:'Out-of-region GRACE values are withheld from field rationale.'};
  }
  const accepted=grace.records.filter(r=>r.status==='accepted').length;
  return {
    id:'grace-regional',
    source:'grace',
    role:'observed-context',
    applicability:'regional-only',
    period:`${grace.records[0]?.month??'?'} to ${grace.records.at(-1)?.month??'?'}`,
    summary:`Regional terrestrial water storage context: ${accepted} accepted monthly estimates over ~${grace.region.areaKm2.toFixed(0)} km² support.`,
    claimLimit:'GRACE is regional TWS anomaly context, not field soil moisture or direct groundwater depletion.',
  };
}

function contraryOrMissing(id:StrategyId,strategy:StrategyResult,request:ScenarioRequest,citations:RationaleCitation[]):string[] {
  const out=[
    'Templates are fixed; observed satellite context does not create or re-rank this option.',
    BENEFITS_NOTE,
  ];
  for(const c of citations){
    if(c.role==='withheld')out.push(`${c.source}: ${c.summary}`);
  }
  out.push(...strategy.issues.map(i=>`Constraint: ${i}`));
  out.push(...strategy.reviewFlags);
  if(strategy.unavailable.soilCarbonChange===null)out.push('Soil-carbon change is unavailable.');
  if(strategy.unavailable.soilLoss===null)out.push('Calibrated soil-loss reduction is unavailable.');
  if(strategy.unavailable.pestReduction===null)out.push('Pest/pathogen interruption is unavailable.');
  if(strategy.unavailable.probabilityBetter===null)out.push('Probability of outperforming the baseline is unavailable.');
  if(id==='cover'&&request.field.coverEquipment===null)out.push('Cover-crop equipment confirmation is still unknown.');
  if(id==='diverse'&&request.field.smallGrainBuyer===null)out.push('Small-grain market access is still unknown.');
  if(id==='forage'&&(request.field.forageBuyer===null||request.field.forageEquipment===null))out.push('Forage market or equipment confirmation is still unknown.');
  if(request.field.soilSource==='demo-assumption')out.push('Soil capacity remains a demonstration assumption, not a soil test.');
  if(request.enterprise?.source==='catalog-default'||!request.enterprise?.reviewed)out.push('Enterprise prices/costs remain catalog or unreviewed farmer entries, not validated market quotes.');
  return [...new Set(out)];
}

/** Build qualified, evidence-linked rationale for one strategy. Does not change scores. */
export function buildStrategyRationale(strategy:StrategyResult,request:ScenarioRequest,bundle:RationaleEvidenceBundle):StrategyRationale {
  const meta=STRATEGIES.find(s=>s.id===strategy.id)!;
  const citations=[
    powerCitation(bundle.weather),
    ...historyCitations(request),
    landsatCitation(request,bundle.fieldEvidence),
    seasonalCitation(bundle.seasonalPackages),
    ecoCitation(request,bundle.ecostress),
    graceCitation(request,bundle.grace),
    {id:`template-${strategy.id}`,source:'template' as const,role:'management-assumption' as const,applicability:'not-used' as const,period:`${request.horizon.startYear}–${request.horizon.startYear+request.horizon.years-1}`,summary:`${meta.name}: ${meta.sequence}.`,claimLimit:TEMPLATE_BASIS},
  ];
  return {
    method:RATIONALE_METHOD,
    strategyId:strategy.id,
    templateBasis:TEMPLATE_BASIS,
    question:meta.question,
    mechanisms:MECHANISMS[strategy.id],
    observedContext:citations.filter(c=>c.role==='observed-context'),
    contraryOrMissing:contraryOrMissing(strategy.id,strategy,request,citations),
    localReviewQuestions:strategyQuestions(strategy.id,request),
    projectedBenefitsNote:BENEFITS_NOTE,
    scoringUnaffected:true,
  };
}

export function attachStrategyRationales<T extends {strategies:StrategyResult[]}>(
  result:T,
  request:ScenarioRequest,
  bundle:RationaleEvidenceBundle,
):T {
  return {
    ...result,
    strategies:result.strategies.map(s=>({...s,rationale:buildStrategyRationale(s,request,bundle)})),
  };
}
