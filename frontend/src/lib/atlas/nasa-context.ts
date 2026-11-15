export interface NasaCell {id:string;center:number[];geometry:{type:'Polygon';coordinates:number[][][]};pilot:boolean}
export interface NasaRow {id:string;cell:string;value:number|null;uncertainty:number|null;status:'accepted'|'withheld';source:string;observedAt?:string|null;period?:string;start?:string;end?:string;qualityIndex?:number|null;retrievalFlag?:number;surfaceFlag?:number}
export interface NasaProduct {product:string;version:string;kind:string;units:string;spatialSupport:string;qa:string;cells:NasaCell[];rows:NasaRow[];assets:{path:string;sha256:string}[];sources:{file:string;sha256:string;sourceUrl:string;bytes:number}[];documentation:string}
export interface NasaContext {schemaVersion:'nasa-context-v1';verifiedAt:string;region:{id:string;point:number[]};start:string;end:string;policy:string;smap:NasaProduct;imerg:NasaProduct;rootZone:NasaProduct & {status:string;reason:string;start:string;end:string};limitations:string[];provenance:Record<string,unknown>}
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const nullable=(v:unknown)=>v===null||(finite(v)&&v>=0);
const date=(v:unknown):v is string=>typeof v==='string'&&v.endsWith('Z')&&Number.isFinite(Date.parse(v));
export function precipitationSummary(rows:NasaRow[],start:string,end:string){
 if(!date(start)||!date(end)||Date.parse(end)<=Date.parse(start))throw Error('Invalid precipitation period');
 let validSeconds=0,partial=0,last=-Infinity;
 for(const r of [...rows].sort((a,b)=>(a.start??'').localeCompare(b.start??''))){
  if(!date(r.start)||!date(r.end)||r.end<=r.start)throw Error('Invalid interval');
  const a=Math.max(Date.parse(start),Date.parse(r.start)),b=Math.min(Date.parse(end),Date.parse(r.end));if(b<=a)continue;
  if(a<last)throw Error('Overlapping precipitation intervals');last=b;
  if(r.value!==null){if(!nullable(r.value))throw Error('Invalid rate');validSeconds+=(b-a)/1000;partial+=r.value*(b-a)/3600000;}
 }
 const expectedSeconds=(Date.parse(end)-Date.parse(start))/1000;
 return {validSeconds,expectedSeconds,coverage:validSeconds/expectedSeconds,partialMm:validSeconds?partial:null,totalMm:validSeconds===expectedSeconds?partial:null};
}
export function parseNasaContext(value:unknown):NasaContext {
 const d=value as NasaContext;
 if(d?.schemaVersion!=='nasa-context-v1'||d.policy!=='nasa-regional-v1'||d.region?.id!=='iowa-pilot-region'||JSON.stringify(d.region.point)!=='[-93.65,42.025]'||!date(d.start)||!date(d.end)||d.end<=d.start)throw Error('Invalid regional NASA support');
 for(const [key,product,version,units] of [['smap','SPL3SMP_E','006','m3/m3'],['imerg','GPM_3IMERGHH','07','mm/hr'],['rootZone','SPL4SMGP','008','m3/m3']] as const){
  const p=d[key];if(p?.product!==product||p.version!==version||p.units!==units||!Array.isArray(p.cells)||p.cells.length!==9||!Array.isArray(p.rows)||p.rows.length===0||!Array.isArray(p.sources)||!Array.isArray(p.assets))throw Error('Invalid NASA product metadata');
  const cells=new Set(p.cells.map(c=>c.id));if(cells.size!==9||p.cells.filter(c=>c.pilot).length!==1)throw Error('Invalid native cells');
  for(const c of p.cells){if(!c.center.every(finite)||c.geometry.type!=='Polygon'||c.geometry.coordinates[0].length!==5||c.geometry.coordinates[0].some(pt=>pt.length!==2||!pt.every(finite)))throw Error('Invalid native geometry');}
  const pilot=p.cells.find(c=>c.pilot)!;if(!p.rows.some(r=>r.cell===pilot.id))throw Error('Missing pilot records');
  const sources=new Set(p.sources.map(s=>s.file)),ids=new Set<string>();
  for(const s of p.sources)if(!/^[a-f0-9]{64}$/.test(s.sha256)||!s.sourceUrl.startsWith('https://')||s.sourceUrl.includes('?')||!finite(s.bytes)||s.bytes<=0)throw Error('Invalid source provenance');
  for(const a of p.assets)if(!/^\/atlas\/nasa-native\/[A-Za-z0-9_.-]+\.json$/.test(a.path)||!/^[a-f0-9]{64}$/.test(a.sha256))throw Error('Invalid subset provenance');
  for(const r of p.rows){
   if(ids.has(r.id)||!cells.has(r.cell)||!sources.has(r.source)||!nullable(r.value)||!nullable(r.uncertainty)||r.status!==(r.value===null?'withheld':'accepted'))throw Error('Invalid NASA value/QA/provenance');ids.add(r.id);
   if(key==='smap'){
    if(r.observedAt!==null&&!date(r.observedAt))throw Error('Invalid overpass time');
    if(r.value!==null&&(!date(r.observedAt)||r.retrievalFlag===undefined||(r.retrievalFlag&3)!==0||r.surfaceFlag!==0||r.value<.02||r.value>.5))throw Error('Unscreened SMAP retrieval');
   }else if(key==='rootZone'){if(!date(r.start)||!date(r.end)||Date.parse(r.end)-Date.parse(r.start)!==10800000||!['sm_surface','sm_rootzone'].includes(r.period??'')||(r.value!==null&&r.value>.9)||r.uncertainty!==null)throw Error('Invalid L4 model support');}else if(!date(r.start)||!date(r.end)||Date.parse(r.end)-Date.parse(r.start)!==1800000||r.start<d.start||r.end>d.end||!nullable(r.qualityIndex)||(r.qualityIndex??0)>1)throw Error('Invalid IMERG bounds/quality');
  }
  if(key==='imerg')for(const c of p.cells)precipitationSummary(p.rows.filter(r=>r.cell===c.id),d.start,d.end);
 }
 return d;
}
