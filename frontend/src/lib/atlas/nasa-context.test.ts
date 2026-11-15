import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseNasaContext,precipitationSummary} from './nasa-context';
const raw=()=>JSON.parse(readFileSync('public/atlas/nasa-context.json','utf8'));
describe('verified native NASA archive',()=>{
 it('retains raw support, screened SMAP and all actual IMERG intervals',()=>{const d=parseNasaContext(raw());expect(d.imerg.rows).toHaveLength(432);expect(d.rootZone.rows).toHaveLength(18);expect(d.rootZone.kind).toBe('land-model-assimilation');expect(d.smap.rows.filter(r=>r.value!==null)).toHaveLength(6);const pilot=d.smap.cells.find(c=>c.pilot)!;expect(d.smap.rows.filter(r=>r.cell===pilot.id).every(r=>r.value===null&&r.uncertainty===null)).toBe(true);});
 it('integrates actual bounds and withholds incomplete totals including unacquired seasons',()=>{const d=parseNasaContext(raw()),cell=d.imerg.cells.find(c=>c.pilot)!.id,rows=d.imerg.rows.filter(r=>r.cell===cell);expect(precipitationSummary(rows,d.start,d.end).totalMm).toBeCloseTo(1.33);expect(precipitationSummary(rows.slice(1),d.start,d.end).totalMm).toBeNull();expect(precipitationSummary(rows,'2024-03-01T00:00:00Z','2024-11-30T00:00:00Z').totalMm).toBeNull();expect(()=>precipitationSummary([...rows,rows[0]],d.start,d.end)).toThrow('Overlapping');});
 it('rejects incorrect units, quality, version, point association and provenance',()=>{for(const mutate of [(d:ReturnType<typeof raw>)=>d.imerg.units='mm/day',(d:ReturnType<typeof raw>)=>d.smap.rows[0].surfaceFlag=8,(d:ReturnType<typeof raw>)=>d.imerg.version='06',(d:ReturnType<typeof raw>)=>d.region.point=[0,0],(d:ReturnType<typeof raw>)=>d.imerg.sources[0].sha256='missing']){const d=raw();mutate(d);expect(()=>parseNasaContext(d)).toThrow();}});
});
