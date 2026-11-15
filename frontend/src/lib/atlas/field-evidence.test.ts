import {describe,it,expect,vi,afterEach} from 'vitest';
import {readFileSync} from 'node:fs';
import {loadFieldEvidence,matchesEvidenceField,parseFieldEvidence} from './field-evidence';
import {DEFAULT_FIELD} from './catalog';
const data=JSON.parse(readFileSync(new URL('../../../public/atlas/field-evidence.json',import.meta.url),'utf8'));
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
describe('Independent field evidence access',()=>{
 it('gates summaries by the exact captured boundary',()=>{expect(matchesEvidenceField(DEFAULT_FIELD,parseFieldEvidence(data))).toBe(true);const field=structuredClone(DEFAULT_FIELD);field.boundary[1][0]-=.001;expect(matchesEvidenceField(field,data)).toBe(false);});
 it('uses the cacheable pack online and falls back to the API on failure',async()=>{const fetcher=vi.fn().mockRejectedValueOnce(new Error('server unavailable')).mockResolvedValueOnce({ok:true,json:async()=>data});vi.stubGlobal('fetch',fetcher);const d=await loadFieldEvidence(new AbortController().signal,true);expect(d.observations.length).toBeGreaterThan(0);expect(fetcher.mock.calls.map(c=>c[0])).toEqual(['/atlas/field-evidence.json','/api/atlas/evidence']);});
 it('uses the cacheable local pack without calling an API while offline',async()=>{const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>data});vi.stubGlobal('fetch',fetcher);await loadFieldEvidence(new AbortController().signal,false);expect(fetcher).toHaveBeenCalledTimes(3);expect(fetcher.mock.calls[0][0]).toBe('/atlas/field-evidence.json');});
 it('rejects field indices below QA coverage and invented coverage for unprocessed scenes',()=>{const bad=structuredClone(data);bad.observations[0].validFraction=.2;bad.observations[0].status='available';bad.observations[0].ndvi=.3;expect(()=>parseFieldEvidence(bad)).toThrow(/withheld/);bad.observations[0].status='acquisition-failed';bad.observations[0].ndvi=null;bad.observations[0].bsi=null;expect(()=>parseFieldEvidence(bad)).toThrow(/coverage/);});
 it('does not accept weather JSON or missing observations as field evidence',()=>{expect(()=>parseFieldEvidence({schemaVersion:'atlas-evidence-1'})).toThrow();expect(()=>parseFieldEvidence({...data,observations:null})).toThrow();});
 it('publishes the base archive while optional downloads stall, then retains it on timeout',async()=>{
  vi.useFakeTimers();
  const published=vi.fn();
  const fetcher=vi.fn((url:string)=>url==='/atlas/field-evidence.json'?Promise.resolve({ok:true,json:async()=>data}):new Promise(()=>{}));
  vi.stubGlobal('fetch',fetcher);
  const pending=loadFieldEvidence(new AbortController().signal,true,published);
  await vi.advanceTimersByTimeAsync(0);
  expect(published).toHaveBeenCalledWith(data);
  expect(fetcher.mock.calls.some(([url])=>url.includes('/api/'))).toBe(false);
  await vi.advanceTimersByTimeAsync(120_000);
  const retained=await pending;
  expect(retained.observations).toEqual(data.observations);
  expect(retained.provenance.additionalSeasonStatus).toContain('unavailable');
 });
 it('does not start fallback requests after the caller cancels',async()=>{
  const controller=new AbortController();controller.abort();
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
  await expect(loadFieldEvidence(controller.signal,true)).rejects.toMatchObject({name:'AbortError'});
  expect(fetcher).not.toHaveBeenCalled();
 });
});
