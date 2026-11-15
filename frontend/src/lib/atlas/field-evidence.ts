import {parseNasaContext, type NasaContext} from './nasa-context';
import {readEvidenceJson} from './evidence-fetch';
import type { FieldContext } from './types';
export type PolygonGeometry = {type:'Polygon';coordinates:number[][][]} | {type:'MultiPolygon';coordinates:number[][][][]};
export interface EvidenceAsset {path:string;sha256:string;variable?:string;sourceUrl?:string}
export interface FieldObservation {
  id:string;datasetId:string;observedAt:string;ndvi:number|null;bsi:number|null;
  validFraction:number|null;directAerosolRetrievalFieldFraction:number|null;interpolatedAerosolFieldFraction:number|null;
  status:string;classification:string;qaPolicy:string;assets:EvidenceAsset[];
  reason?:string;platform?:string;nativeSupportM?:number;mapAsset?:EvidenceAsset;
}
export interface FieldEvidence {
  schemaVersion:'field-evidence-v1';verifiedAt:string;nasaContext?:NasaContext;
  field:{id:string;bbox:number[];geometry:PolygonGeometry;areaHa:number;boundaryStatus:string};
  datasets:{id:string;status:string;evidenceKind:string;product:string;version:string;sourceUrl:string;spatialSupport:string;dates:string[];units:string|null;qa:Record<string,unknown>;summary:Record<string,unknown>|null;limitations:string[];assets:EvidenceAsset[];provenance?:Record<string,unknown>}[];
  observations:FieldObservation[];
  season?:{start:string;end:string;discovery:string;minimumValidFraction:number;interpolation:'none';catalogComplete:boolean};
  map:{type:'FeatureCollection';features:{type:'Feature';geometry:PolygonGeometry;properties:Record<string,unknown>}[]};
  capturePeriods?:{start:string;end:string;catalogComplete:boolean}[];
  provenance:Record<string,unknown>;
}
export function matchesEvidenceField(field:Pick<FieldContext,'boundary'>,data:FieldEvidence):boolean {
  const rings=data.field.geometry.coordinates;
  if(data.field.geometry.type!=='Polygon')return false;
  return JSON.stringify(field.boundary)===JSON.stringify(rings[0]);
}
export function parseFieldEvidence(value:unknown):FieldEvidence {
  const data=value as FieldEvidence;
  if(data?.schemaVersion!=='field-evidence-v1'||!Array.isArray(data.datasets)||!Array.isArray(data.observations)||data.map?.type!=='FeatureCollection'||!Array.isArray(data.map.features)||data.field?.geometry?.type!=='Polygon')throw new Error('Field evidence package is unavailable or has an unsupported schema.');
  if(data.nasaContext)parseNasaContext(data.nasaContext);
  const ids=new Set<string>();
  const fraction=(v:unknown)=>v===null||(typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1);
  for(const o of data.observations){
    if(typeof o.id!=='string'||ids.has(o.id)||o.datasetId!=='landsat'||typeof o.observedAt!=='string'||!o.observedAt.endsWith('Z')||!Number.isFinite(Date.parse(o.observedAt))||!fraction(o.validFraction)||!fraction(o.directAerosolRetrievalFieldFraction)||!fraction(o.interpolatedAerosolFieldFraction)||!['available','insufficient-coverage','excluded-tier','acquisition-failed'].includes(o.status)||![o.ndvi,o.bsi].every(v=>v===null||(typeof v==='number'&&Number.isFinite(v)&&v>=-1&&v<=1))||typeof o.classification!=='string'||!o.classification.startsWith('withheld')||!Array.isArray(o.assets))throw new Error('Invalid observation date, quality, units or missingness.');
    if(o.status==='available'?(o.validFraction===null||o.validFraction<.8||o.ndvi===null||o.bsi===null):(o.ndvi!==null||o.bsi!==null))throw new Error('Field indices must be withheld when quality coverage is insufficient or unavailable.');
    if(['excluded-tier','acquisition-failed'].includes(o.status)&&o.validFraction!==null)throw new Error('Unprocessed scenes cannot claim measured QA coverage.');
    if(o.mapAsset&&(!/^\/atlas\/history-maps\/[A-Za-z0-9_-]+\.geojson$/.test(o.mapAsset.path)||!/^[a-f0-9]{64}$/.test(o.mapAsset.sha256)))throw new Error('Invalid dated map reference.');
    ids.add(o.id);
  }
  return data;
}

/** The optional archive adds dated observations, never resamples them or changes model forcing. */
export function mergeSeasons(base:FieldEvidence,value:unknown):FieldEvidence {
 const extra=value as {accessAttempt?:Record<string,unknown>;schemaVersion:string;field:FieldEvidence['field'];seasons:{id:string;start:string;end:string;catalogComplete:boolean;qaPolicy:string;minimumValidFraction:number;nativeSupportM:number;observations:FieldEvidence['observations'];assets:FieldEvidence['datasets'][number]['assets'];provenance:Record<string,unknown>}[]};
 if(extra?.schemaVersion!=='landsat-seasons-v1'||JSON.stringify(extra.field)!==JSON.stringify(base.field)||!Array.isArray(extra.seasons))throw Error('Additional Landsat seasons have an incompatible boundary or schema.');
 const observations=[...base.observations],assets:FieldEvidence['datasets'][number]['assets']=[],periods=[...(base.capturePeriods??(base.season?[{start:base.season.start,end:base.season.end,catalogComplete:base.season.catalogComplete}]:[]))];
 for(const s of extra.seasons){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s.start)||!/^\d{4}-\d{2}-\d{2}$/.test(s.end)||s.start>s.end||s.minimumValidFraction!==.8||s.nativeSupportM!==30||s.qaPolicy!=='landsat-c2-land-aerosol-tiered-v1'||!Array.isArray(s.observations)||!Array.isArray(s.assets)||periods.some(p=>s.start<=p.end&&s.end>=p.start)||s.observations.some(o=>o.observedAt.slice(0,10)<s.start||o.observedAt.slice(0,10)>s.end))throw Error('Additional season has invalid dates, overlapping coverage or incompatible QA.');
  periods.push({start:s.start,end:s.end,catalogComplete:s.catalogComplete});observations.push(...s.observations);assets.push(...s.assets);
 }
 observations.sort((a,b)=>a.observedAt.localeCompare(b.observedAt)||a.id.localeCompare(b.id));
 return parseFieldEvidence({...base,observations,capturePeriods:periods.sort((a,b)=>a.start.localeCompare(b.start)),datasets:base.datasets.map(d=>d.id!=='landsat'?d:{...d,dates:observations.map(o=>o.observedAt),assets:[...d.assets,...assets],qa:{...d.qa,validFractions:observations.map(o=>o.validFraction)},summary:{scenesDiscovered:observations.length,scenesAcquired:observations.filter(o=>o.validFraction!==null).length,usableFieldSummaries:observations.filter(o=>o.status==='available').length}}),provenance:{...base.provenance,accessAttempt:extra.accessAttempt??null,additionalSeasonProvenance:extra.seasons.map(s=>({id:s.id,...s.provenance})),coverage:'Only listed capture periods are acquired. Dates between them are not continuous coverage.'}});
}

/** Regional context is separately labeled; never appended to Landsat field observations. */
export function withNasaContext(base:FieldEvidence,value:unknown):FieldEvidence {
 const nasaContext=parseNasaContext(value);
 const datasets=base.datasets.map(d=>{if(d.id!=='smap'&&d.id!=='imerg')return d;const p=nasaContext[d.id];return {...d,status:'available',product:p.product,version:p.version,evidenceKind:p.kind,sourceUrl:p.documentation,spatialSupport:p.spatialSupport,units:p.units,dates:[nasaContext.start,nasaContext.end],qa:{policy:nasaContext.policy,description:p.qa},summary:{capturedRows:p.rows.length,acceptedRows:p.rows.filter(r=>r.value!==null).length,role:'regional context only'},assets:p.assets,limitations:nasaContext.limitations,provenance:nasaContext.provenance};});
 const p=nasaContext.rootZone;
 const root={id:'smap-rootzone',status:'available',product:p.product,version:p.version,evidenceKind:p.kind,sourceUrl:p.documentation,spatialSupport:p.spatialSupport,units:p.units,dates:[p.start,p.end],qa:{policy:nasaContext.policy,description:p.qa},summary:{role:'regional assimilation context only'},assets:p.assets,limitations:[p.reason,...nasaContext.limitations],provenance:nasaContext.provenance};
 return {...base,nasaContext,datasets:[...datasets.filter(d=>d.id!=='smap-rootzone'),root]};
}

/** Prefer CDN/offline archives; publish usable pixels before optional context finishes. */
export async function loadFieldEvidence(signal:AbortSignal,online:boolean,onBase?:(data:FieldEvidence)=>void):Promise<FieldEvidence> {
  let base:FieldEvidence;
  try{base=parseFieldEvidence(await readEvidenceJson('/atlas/field-evidence.json',signal));}
  catch(error){
    signal.throwIfAborted();
    if(!online)throw error;
    base=parseFieldEvidence(await readEvidenceJson('/api/atlas/evidence',signal));
    signal.throwIfAborted();
    onBase?.(base);
    // The API already merges the optional context and extra season.
    return base;
  }
  signal.throwIfAborted();
  onBase?.(base);
  const [context,season]=await Promise.allSettled([
    readEvidenceJson('/atlas/nasa-context.json',signal),
    readEvidenceJson('/atlas/landsat-seasons.json',signal),
  ]);
  signal.throwIfAborted();
  if(context.status==='fulfilled'){
    try{base=withNasaContext(base,context.value);}catch{/* Invalid regional context never removes field observations. */}
  }
  if(season.status==='fulfilled'){
    try{return mergeSeasons(base,season.value);}catch{/* Retain the verified base archive. */}
  }
  return {...base,provenance:{...base.provenance,additionalSeasonStatus:'unavailable or invalid; original season retained'}};
}
