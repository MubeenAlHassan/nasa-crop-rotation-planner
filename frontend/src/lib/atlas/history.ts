import type {EvidenceSeries,FieldContext,FieldHistory,HistoryWindow} from './types';
import {matchesEvidenceField,type FieldEvidence,type FieldObservation} from './field-evidence';

const DAY=86400000;
export const HISTORY_METHOD='history-review-v1';
export function validDate(value:unknown):value is string {
  return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
}
export const daysBetween=(a:string,b:string)=>(Date.parse(b)-Date.parse(a))/DAY;
const bounded=(n:unknown,lo:number,hi:number)=>typeof n==='number'&&Number.isFinite(n)&&n>=lo&&n<=hi;
export function validateHistory(value:unknown):asserts value is FieldHistory {
  const h=value as FieldHistory;
  if(!h||h.schemaVersion!=='field-history-v1'||!validDate(h.start)||!validDate(h.end)||daysBetween(h.start,h.end)<0||daysBetween(h.start,h.end)>366||!bounded(h.lowNdvi,-1,1)||!Number.isInteger(h.maxGapDays)||!bounded(h.maxGapDays,1,32)||!bounded(h.rainThresholdMm,1,200)||!bounded(h.heatThresholdC,20,50)||!Array.isArray(h.windows)||h.windows.length>15||!Array.isArray(h.management)||h.management.length>20)throw Error('Invalid history season, exploration thresholds or record limits (15 windows / 20 operations).');
  if(h.boundary!==null&&(!Array.isArray(h.boundary)||h.boundary.length<4||h.boundary.length>100||h.boundary.some(p=>!Array.isArray(p)||p.length!==2||!bounded(p[0],-94,-93)||!bounded(p[1],41.5,42.5))||JSON.stringify(h.boundary[0])!==JSON.stringify(h.boundary.at(-1))))throw Error('Invalid history boundary association.');
  if((h.windows.length||h.management.length)&&h.boundary===null)throw Error('Historical records require their original boundary.');
  const ids=new Set<string>();
  const common=(r:{id:string;note:string;updatedAt:string})=>{if(typeof r?.id!=='string'||!r.id.length||r.id.length>128||ids.has(r.id)||typeof r.note!=='string'||r.note.length>400||typeof r.updatedAt!=='string'||!Number.isFinite(Date.parse(r.updatedAt)))throw Error('Invalid or duplicate historical record.');ids.add(r.id);};
  for(const w of h.windows){common(w);if(!validDate(w.start)||!validDate(w.end)||daysBetween(w.start,w.end)<0||daysBetween(w.start,w.end)>366||!['uncertain','farmer-confirmed'].includes(w.status)||!['unknown','bare-soil','residue-present','living-cover','mixed'].includes(w.cover)||!Array.isArray(w.observationIds)||w.observationIds.length>10||w.observationIds.some(id=>typeof id!=='string'||id.length>128))throw Error('Invalid historical window.');if(w.status==='farmer-confirmed'&&(w.cover==='unknown'||!w.note.trim()))throw Error('Confirmation needs an observed cover condition and a local observation or record note.');}
  for(const m of h.management){common(m);if(!validDate(m.date)||!['plant','harvest','tillage','termination','residue-retained','residue-removed'].includes(m.operation)||typeof m.crop!=='string'||m.crop.length>80)throw Error('Invalid management record.');}
  if(new TextEncoder().encode(JSON.stringify(h)).length>24000)throw Error('Historical records exceed the local report limit (24 KiB). Shorten notes or export and remove older records.');
}
export function historyMatchesField(history:FieldHistory,field:Pick<FieldContext,'boundary'>):boolean {
  return history.boundary!==null&&JSON.stringify(history.boundary)===JSON.stringify(field.boundary);
}
export function usableObservation(o:FieldObservation):boolean {
  return o.datasetId==='landsat'&&o.status==='available'&&typeof o.validFraction==='number'&&o.validFraction>=.8&&o.ndvi!==null&&Number.isFinite(o.ndvi)&&o.bsi!==null&&Number.isFinite(o.bsi);
}
export function reviewCandidates(observations:FieldObservation[],history:FieldHistory) {
  const valid=observations.filter(o=>usableObservation(o)&&o.observedAt.slice(0,10)>=history.start&&o.observedAt.slice(0,10)<=history.end).sort((a,b)=>a.observedAt.localeCompare(b.observedAt));
  return valid.flatMap((b,i)=>{
    const a=valid[i-1];if(!a)return [];
    const start=a.observedAt.slice(0,10),end=b.observedAt.slice(0,10),gap=daysBetween(start,end);
    if(gap<=0||gap>history.maxGapDays||a.ndvi!>history.lowNdvi||b.ndvi!>history.lowNdvi)return [];
    return [{id:`review-${a.id}-${b.id}`,start,end,observationIds:[a.id,b.id],classification:'withheld' as const,reason:'Two low vegetation-index observations. Cover between dates and residue protection remain unknown; this is a review interval, not detected bare soil.'}];
  });
}
/** Unperturbed captured UTC days. Null != zero; assess rainfall and Tmax separately. */
export function weatherExposure(weather:EvidenceSeries|null,start:string,end:string,rainThresholdMm:number,heatThresholdC:number) {
  if(!validDate(start)||!validDate(end)||daysBetween(start,end)<0||daysBetween(start,end)>366)throw Error('Invalid exposure interval.');
  if(!bounded(rainThresholdMm,1,200)||!bounded(heatThresholdC,20,50))throw Error('Invalid exposure thresholds.');
  const totalDays=daysBetween(start,end)+1;
  const index=new Map<string,EvidenceSeries['weather'][number]>(),duplicates=new Set<string>();
  if(weather?.timeStandard==='UTC')for(const day of weather.weather){if(index.has(day.date))duplicates.add(day.date);index.set(day.date,day);}
  let rainDays=0,heatDays=0,rainSum=0,rainEvents=0,hotDays=0;const events:{date:string;rainMm:number|null;tmaxC:number|null;heavyRain:boolean;hot:boolean}[]=[];
  for(let i=0;i<totalDays;i++){
    const date=new Date(Date.parse(start)+i*DAY).toISOString().slice(0,10),day=duplicates.has(date)?undefined:index.get(date);
    const rain=typeof day?.rain==='number'&&Number.isFinite(day.rain)&&day.rain>=0?day.rain:null;
    const heat=typeof day?.tmax==='number'&&Number.isFinite(day.tmax)&&day.tmax>=-90&&day.tmax<=65?day.tmax:null;
    if(rain!==null){rainDays++;rainSum+=rain;if(rain>=rainThresholdMm)rainEvents++;}
    if(heat!==null){heatDays++;if(heat>=heatThresholdC)hotDays++;}
    if((rain!==null&&rain>=rainThresholdMm)||(heat!==null&&heat>=heatThresholdC))events.push({date,rainMm:rain,tmaxC:heat,heavyRain:rain!==null&&rain>=rainThresholdMm,hot:heat!==null&&heat>=heatThresholdC});
  }
  return {evidenceId:weather?.id??null,timeStandard:'UTC',spatialSupport:weather?.spatialSupport??'Weather unavailable',start,end,totalDays,rainValidDays:rainDays,heatValidDays:heatDays,rainMissingDays:totalDays-rainDays,heatMissingDays:totalDays-heatDays,rainTotalMm:rainDays===totalDays?rainSum:null,rainObservedSubtotalMm:rainDays?rainSum:null,rainThresholdDays:rainDays===totalDays?rainEvents:null,hotDays:heatDays===totalDays?hotDays:null,observedRainThresholdDays:rainEvents,observedHotDays:hotDays,rainThresholdMm,heatThresholdC,events,status:rainDays===totalDays&&heatDays===totalDays?'complete-utc-regional-context':'incomplete-withheld-totals',interpretation:'Temporal overlap only; not field rain intensity, erosivity, soil loss, crop heat damage or a causal rotation effect.'};
}
export function historyReport(history:FieldHistory,field:FieldContext,weather:EvidenceSeries|null,evidence:FieldEvidence|null) {
  validateHistory(history);
  const applicable=historyMatchesField(history,field),satelliteApplicable=!!evidence&&matchesEvidenceField(field,evidence);
  const exposure=(w:Pick<HistoryWindow,'start'|'end'>)=>weatherExposure(weather,w.start,w.end,history.rainThresholdMm,history.heatThresholdC);
  return {method:HISTORY_METHOD,classification:'withheld: no validated soil/residue classifier',historyApplicable:applicable,satelliteApplicable,season:{start:history.start,end:history.end},thresholds:{lowNdvi:history.lowNdvi,maxGapDays:history.maxGapDays,rainMm:history.rainThresholdMm,heatC:history.heatThresholdC,meaning:'Exploration assumptions, not calibrated detection or damage thresholds'},candidates:satelliteApplicable?reviewCandidates(evidence!.observations,history):[],windows:history.windows.map(w=>({...w,exposure:applicable?exposure(w):null,reviewFlags:[...(field.boundaryConfirmed===true?[]:['Field boundary is not farmer-confirmed; review the cropped area.']),...(applicable?[]:['Boundary mismatch: original records retained but not attributed to this field.']),...(w.status==='uncertain'?['Hypothesized interval; exposure condition unconfirmed.']:['Farmer report, not independent remote-sensing validation.']),...(w.cover==='residue-present'?['Residue presence does not quantify protective cover or erosion resistance.']:[]),...(w.observationIds.some(id=>!evidence?.observations.some(o=>o.id===id))?['Linked observation missing from the current package.']:[])]})),management:history.management,requirements:['Dated field photos or transects with bare soil, residue, sparse/live vegetation, water and cloud labels.','Residue percentage/biomass, crop stage, tillage and termination records matched to overpass dates.','Independent farms and later seasons for detection precision/recall and window-boundary error; cloud/edge uncertainty and abstention.','Local rain gauges (intensity for erosion), canopy temperature and crop-stage thresholds for damage interpretation.']};
}
