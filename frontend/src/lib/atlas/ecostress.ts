import type {FieldEvidence} from './field-evidence';
import type {NasaSeason} from './nasa-season';
import type {ScenarioRequest} from './types';
import {historyMatchesField,usableObservation} from './history';
export const ECO_CACHE='fieldshift-ecostress-v1';
export interface EcoBand {units:string;nativeUnits:string;temporalSupport:string;rawValues:(number|null)[];values:(number|null)[];reasons:string[][];validAreaFraction:number;validPixels:number;fieldMean:number|null;schema:{scale:number;offset:number;embeddedUnits:string|null}}
export interface EcoRecord {id:string;product:string;version:string;build:string;pgeVersion:string;start:string;end:string;localTime:string;dayNight:string;bands:Record<string,EcoBand>;qa:{cloud:(number|null)[];water:(number|null)[];QC:(number|null)[];LST_err:(number|null)[];l2Source:string|null};sources:{file:string;sourceUrl:string;sha256:string;bytes:number}[];ancillaryInputs:string}
export interface EcoEvidence {schemaVersion:'ecostress-pilot-v1';policy:string;field:Omit<FieldEvidence['field'],'geometry'>&{geometry:{type:'Polygon';coordinates:number[][][]}};crs:string;nativeCellSizeM:number;minimumFieldCoverage:number;cells:{id:string;row:number;column:number;fieldAreaM2:number;geometry:{type:'Polygon';coordinates:number[][][]}}[];records:EcoRecord[];inventory:{id:string;product:string;start:string;end:string;status:string}[];limitations:string[];versionSelection:{selected:string;reason:string};provenance:Record<string,unknown>}
export interface EcoIndex {schemaVersion:string;path:string;sha256:string;bytes:number;records:number;dates:string[]}
export function parseEcoIndex(v:unknown):EcoIndex{const d=v as EcoIndex;if(d?.schemaVersion!=='ecostress-index-v1'||d.path!=='/atlas/ecostress/pilot.json'||!/^[a-f0-9]{64}$/.test(d.sha256)||!Number.isSafeInteger(d.bytes)||d.bytes<=0)throw Error('Invalid ECOSTRESS index');return d;}
const time=(v:string)=>typeof v==='string'&&v.endsWith('Z')&&Number.isFinite(Date.parse(v));
const nullable=(v:unknown)=>v===null||(typeof v==='number'&&Number.isFinite(v));
const UNITS:Record<string,string>={LST:'°C',LST_err:'K',PTJPLSMinst:'W/m²',ETdaily:'mm/day',ETinstUncertainty:'W/m²',ESI:'1',PET:'W/m²'};
export function parseEco(v:unknown):EcoEvidence{
 const d=v as EcoEvidence;if(d?.schemaVersion!=='ecostress-pilot-v1'||d.policy!=='ecostress-c2-conservative-v1'||d.crs!=='EPSG:32615'||d.nativeCellSizeM!==70||d.minimumFieldCoverage!==.8||d.field.id!=='iowa-demo'||!Array.isArray(d.cells)||!d.cells.length||!Array.isArray(d.records))throw Error('Unverified ECOSTRESS support');
 const count=d.cells.length,ids=new Set<string>(),area=d.cells.reduce((a,c)=>a+c.fieldAreaM2,0);if(!(area>0)||d.cells.some(c=>!Number.isFinite(c.fieldAreaM2)||c.fieldAreaM2<0||c.geometry.type!=='Polygon'||c.geometry.coordinates[0].length!==5||c.geometry.coordinates[0].some(p=>p.length!==2||!p.every(Number.isFinite))))throw Error('Invalid native geometry');
 for(const r of d.records){if(ids.has(r.id)||!['ECO_L2T_LSTE','ECO_L3T_JET','ECO_L4T_ESI'].includes(r.product)||r.version!=='002'||!['0711','0712'].includes(r.build)||!time(r.start)||!time(r.end)||Date.parse(r.end)<=Date.parse(r.start))throw Error('Unverified ECOSTRESS record');ids.add(r.id);
  for(const a of r.sources)if(!/^[a-f0-9]{64}$/.test(a.sha256)||!a.sourceUrl.startsWith('https://')||a.sourceUrl.includes('?')||a.bytes<=0)throw Error('Invalid ECOSTRESS provenance');
  for(const q of [r.qa.cloud,r.qa.water,r.qa.QC,r.qa.LST_err])if(q.length!==count||!q.every(nullable))throw Error('Invalid masks');
  for(const [name,b] of Object.entries(r.bands)){if(UNITS[name]!==b.units||b.nativeUnits!==(name==='LST'?'K':b.units)||b.schema.scale!==1||b.schema.offset!==0||b.values.length!==count||b.rawValues.length!==count||b.reasons.length!==count||!b.values.every(nullable)||!b.rawValues.every(nullable)||!nullable(b.fieldMean)||b.validAreaFraction<0||b.validAreaFraction>1)throw Error('Unverified units, packing or coverage');let validArea=0,sum=0;
   b.values.forEach((value,i)=>{if(value===null)return;const q=r.qa.QC[i],err=r.qa.LST_err[i];if(b.reasons[i].length||r.qa.cloud[i]!==0||r.qa.water[i]!==0||q===null||(q&15)!==0||err===null||err<0||err>2||b.rawValues[i]===null)throw Error('Unscreened ECOSTRESS value');if(name==='LST'?Math.abs(value-(b.rawValues[i]!-273.15))>1e-8:value!==b.rawValues[i]||value<0||(name==='ESI'&&value>1))throw Error('Invalid physical value');validArea+=d.cells[i].fieldAreaM2;sum+=value*d.cells[i].fieldAreaM2;});
   const fraction=Math.min(1,validArea/area);if(Math.abs(fraction-b.validAreaFraction)>1e-7)throw Error('Coverage does not match QA');const mean=fraction>=.8&&!['LST_err','ETinstUncertainty'].includes(name)?sum/validArea:null;if(mean===null?b.fieldMean!==null:b.fieldMean===null||Math.abs(mean-b.fieldMean)>1e-7)throw Error('Unsupported field summary');
  }
 }
 return d;
}
export async function verifiedEco(raw:string,index:EcoIndex){const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw))),v=>v.toString(16).padStart(2,'0')).join('');if(digest!==index.sha256)throw Error('ECOSTRESS checksum mismatch; values withheld');return parseEco(JSON.parse(raw));}
export function ecoMatches(d:EcoEvidence,request:ScenarioRequest){return JSON.stringify(d.field.geometry.coordinates[0])===JSON.stringify(request.field.boundary);}
export function ecoComparison(d:EcoEvidence,r:EcoRecord,request:ScenarioRequest,evidence:FieldEvidence|null,season:NasaSeason|null){
 const fieldMatches=ecoMatches(d,request);const candidates=fieldMatches&&evidence&&JSON.stringify(evidence.field.geometry.coordinates[0])===JSON.stringify(request.field.boundary)?evidence.observations.filter(usableObservation):[];
 const nearest=[...candidates].sort((a,b)=>Math.abs(Date.parse(a.observedAt)-Date.parse(r.start))-Math.abs(Date.parse(b.observedAt)-Date.parse(r.start)))[0];
 const hours=nearest?(Date.parse(nearest.observedAt)-Date.parse(r.start))/3600000:null;
 const landsat=nearest&&hours!==null&&Math.abs(hours)<=192?{id:nearest.id,time:nearest.observedAt,offsetHours:hours,ndvi:nearest.ndvi}:null;
 const model=season?.rootZone.find(v=>Date.parse(v.start)<=Date.parse(r.start)&&Date.parse(r.start)<Date.parse(v.end));const day=season?.days.find(v=>v.date===r.start.slice(0,10));
 const windows=fieldMatches&&historyMatchesField(request.history,request.field)?request.history.windows.filter(w=>w.start<=r.start.slice(0,10)&&w.end>=r.start.slice(0,10)):[];
 return {fieldMatches,landsat,model:model?{start:model.start,end:model.end,root:model.root[4],surface:model.surface[4]}:null,rain:day?day.rain[4]:null,windows};
}
