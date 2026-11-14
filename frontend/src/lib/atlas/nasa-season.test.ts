import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseSeason,parseSeasonIndex,seasonRain,verifiedSeason,seasonalWindow} from './nasa-season';
const raw=()=>JSON.parse(readFileSync('public/atlas/nasa-season/2024-06.json','utf8'));
describe('seasonal scientific contracts',()=>{
 it('preserves native support, processing versions and separate snapshot uncertainty',()=>{const d=parseSeason(raw());expect(d.days).toHaveLength(30);expect(d.rootZone).toHaveLength(240);expect(d.diagnostics).toHaveLength(240);expect(d.diagnostics[0].snapshot).toBe('2024-06-01T00:00:00Z');expect(d.rootZone[0]).not.toHaveProperty('rootSpread');expect(d.smap[0].values[4]).toBeNull();expect(d.smap[0].reasons[4]).toContain('surface-condition-flags');expect(d.sources.some(s=>s.product==='SPL4SMAU'&&s.version==='008')).toBe(true);});
 it('integrates rates, rejects duplicates and withholds missing intervals',()=>{const d=parseSeason(raw());expect(seasonRain(d,'2024-06-01T00:00:00Z','2024-06-02T00:00:00Z').totalMm).toBeCloseTo(1.33);d.imerg.shift();const r=seasonRain(d,'2024-06-01T00:00:00Z','2024-06-02T00:00:00Z');expect(r.totalMm).toBeNull();expect(r.validSeconds).toBe(84600);d.imerg.push(d.imerg[0]);expect(()=>seasonRain(d,d.start,d.end)).toThrow('Overlapping');});
 it('recomputes daily summaries instead of trusting persisted totals',()=>{const d=raw();d.days[0].rain[4].totalMm=9999;d.imerg[0].values[4]=null;const parsed=parseSeason(d);expect(parsed.days[0].rain[4].totalMm).toBeNull();expect(parsed.days[0].rain[4].validSeconds).toBe(84600);});
 it('rejects duplicate model snapshots, bad QA and untrusted source support',()=>{for(const change of [(d:ReturnType<typeof raw>)=>{d.diagnostics.push(d.diagnostics[0]);d.coverage.acquired.diagnostics++;},(d:ReturnType<typeof raw>)=>{d.smap[0].values[4]=.3;},(d:ReturnType<typeof raw>)=>{d.sources[0].sourceUrl+='?token=not-real';},(d:ReturnType<typeof raw>)=>{d.region.point=[0,0];}]){const d=raw();change(d);expect(()=>parseSeason(d)).toThrow();}});
 it('verifies the complete processed-file checksum before enabling values',async()=>{const index=parseSeasonIndex(JSON.parse(readFileSync('public/atlas/nasa-season-index.json','utf8')));const text=readFileSync('public/atlas/nasa-season/2024-06.json','utf8');expect((await verifiedSeason(text,index.find(e=>e.month==='2024-06')!)).month).toBe('2024-06');await expect(verifiedSeason(text+' ',index.find(e=>e.month==='2024-06')!)).rejects.toThrow('checksum');});
});

describe('Cross-month temporal contracts',()=>{
 it('integrates partial UTC boundary intervals and explicitly counts missing time',()=>{const d=parseSeason(raw());const r=seasonalWindow([d],'2024-05-31T23:45:00Z','2024-06-01T00:45:00Z');expect(r.imerg.expectedSeconds).toBe(3600);expect(r.imerg.acquiredSeconds).toBe(2700);expect(r.imerg.totalMm).toBeNull();expect(r.imerg.partialMm).toBeCloseTo(d.imerg[0].values[4]!*.5+d.imerg[1].values[4]!*.25);expect(r.unloadedMonths).toEqual(['2024-05']);expect(r.rootZone.root.observedMean).toBeCloseTo(d.rootZone[0].root[4]!);expect(r.rootZone.root.mean).toBeNull();});
 it('deduplicates identical packages and rejects conflicting or overlapping records',()=>{const d=parseSeason(raw());const one=seasonalWindow([d],d.start,d.end),two=seasonalWindow([d,d],d.start,d.end);expect(two).toEqual(one);const changed=structuredClone(d);changed.imerg[0].values[4]=999;expect(()=>seasonalWindow([d,changed],d.start,d.end)).toThrow('Conflicting duplicate');const overlap=structuredClone(d);overlap.imerg[0].start='2024-06-01T00:15:00Z';overlap.imerg[0].end='2024-06-01T00:45:00Z';expect(()=>seasonalWindow([overlap],d.start,d.end)).toThrow('Overlapping');});
 it('distinguishes rejected from unacquired rain and never attaches snapshot spread to means',()=>{const d=parseSeason(raw());d.imerg[0].values[4]=null;d.imerg.splice(1,1);const r=seasonalWindow([d],'2024-06-01T00:00:00Z','2024-06-01T01:30:00Z');expect(r.imerg.missingSeconds).toBe(1800);expect(r.imerg.rejectedSeconds).toBe(1800);expect(r.imerg.validSeconds).toBe(1800);expect(r.imerg.totalMm).toBeNull();expect(r.rootZone.root).not.toHaveProperty('rootSpread');expect(r.diagnostics.acquiredSnapshots).toBe(1);});
 it('selects L3 by actual UTC observation time, independently of nominal catalog date',()=>{const d=parseSeason(raw());d.smap[0].times[4]='2024-06-02T00:01:00Z';d.smap[0].values[4]=.2;const r=seasonalWindow([d],'2024-06-02T00:00:00Z','2024-06-02T00:10:00Z');expect(r.smap.validObservations).toBe(1);expect(r.smap.observationMean).toBe(.2);});
});

it('loads every published month and joins actual March–April intervals',()=>{const entries=parseSeasonIndex(JSON.parse(readFileSync('public/atlas/nasa-season-index.json','utf8')));const packages=entries.map(e=>parseSeason(JSON.parse(readFileSync('public'+e.path,'utf8'))));const r=seasonalWindow(packages,'2024-03-31T00:00:00Z','2024-04-02T00:00:00Z');expect(r.imerg.acquiredSeconds).toBe(172800);expect(r.imerg.validSeconds).toBe(172800);},30_000);

it('reconciles the full requested season with actual published intervals and missing packages',()=>{
 const entries=parseSeasonIndex(JSON.parse(readFileSync('public/atlas/nasa-season-index.json','utf8')));
 const packages=entries.map(e=>parseSeason(JSON.parse(readFileSync('public'+e.path,'utf8'))));
 const start='2024-03-01T00:00:00Z',end='2024-12-01T00:00:00Z';
 for(const selected of [packages,packages.filter(p=>p.month!=='2024-04')]){
  const result=seasonalWindow(selected,start,end);
  const rows=selected.flatMap(p=>p.imerg);
  const valid=rows.filter(r=>r.values[4]!==null);
  const seconds=(r:typeof rows[number])=>(Date.parse(r.end)-Date.parse(r.start))/1000;
  const acquiredSeconds=rows.reduce((s,r)=>s+seconds(r),0);
  const validSeconds=valid.reduce((s,r)=>s+seconds(r),0);
  const accumulation=valid.reduce((s,r)=>s+r.values[4]!*seconds(r)/3600,0);
  expect(result.imerg.expectedSeconds).toBe(275*86400);
  expect(result.imerg.acquiredSeconds).toBe(acquiredSeconds);
  expect(result.imerg.validSeconds).toBe(validSeconds);
  expect(result.imerg.missingSeconds).toBe(275*86400-acquiredSeconds);
  expect(result.imerg.rejectedSeconds).toBe(acquiredSeconds-validSeconds);
  expect(result.imerg.partialMm).toBeCloseTo(accumulation,8);
  if(validSeconds===275*86400) expect(result.imerg.totalMm).toBeCloseTo(accumulation,8);
  else expect(result.imerg.totalMm).toBeNull();
  if(!selected.some(p=>p.month==='2024-04')) expect(result.unloadedMonths).toContain('2024-04');
 }
},30_000);
