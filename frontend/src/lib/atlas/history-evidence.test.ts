import {describe,it,expect,vi,afterEach} from 'vitest';
import {readFileSync} from 'node:fs';
import {mergeSeasons,parseFieldEvidence} from './field-evidence';
import {loadHistoricalWeather,parseHistoricalWeather,seasonalWeatherSummary} from './history-evidence';
import {compare} from './engine';
import {DEFAULT_REQUEST} from './catalog';
const read=(name:string)=>JSON.parse(readFileSync(new URL('../../../public/atlas/'+name,import.meta.url),'utf8'));
const weather=parseHistoricalWeather(read('power-history.json')),base=parseFieldEvidence(read('field-evidence.json')),extra=read('landsat-seasons.json');
afterEach(()=>vi.unstubAllGlobals());
describe('Real multi-year historical evidence',()=>{
 it('adds only acquired periods without changing original evidence or model forcing',()=>{const before=JSON.stringify(base),merged=mergeSeasons(base,extra);expect(merged.capturePeriods).toHaveLength(2);expect(merged.observations).toHaveLength(73);expect(JSON.stringify(base)).toBe(before);expect(merged.map).toEqual(base.map);expect(compare(weather,DEFAULT_REQUEST).status).toBe('insufficient-information');});
 it('rejects another boundary, duplicate coverage and invalid QA instead of attributing them',()=>{const bad=structuredClone(extra);bad.field.geometry.coordinates[0][0][0]-=.001;expect(()=>mergeSeasons(base,bad)).toThrow(/boundary/);const duplicate=structuredClone(extra);duplicate.seasons.push(duplicate.seasons[0]);expect(()=>mergeSeasons(base,duplicate)).toThrow(/overlapping/);const qa=structuredClone(extra);qa.seasons[0].minimumValidFraction=.2;expect(()=>mergeSeasons(base,qa)).toThrow(/QA/);});
 it('joins real seasonal weather with all 20 years and withholds incomplete totals',()=>{const result=seasonalWeatherSummary(weather,'2023-04-01','2023-04-30',25,35);expect(result.rows).toHaveLength(20);expect(result.rainCompleteYears).toBe(20);expect(result.rows[0].exposure?.rainTotalMm).toBeCloseTo(weather.weather.filter(r=>r.date.startsWith('2005-04')).reduce((s,r)=>s+r.rain!,0));const missing=structuredClone(weather);missing.weather.find(r=>r.date==='2005-04-10')!.rain=null;const partial=seasonalWeatherSummary(missing,'2023-04-01','2023-04-30',25,35);expect(partial.rainCompleteYears).toBe(19);expect(partial.rows[0].exposure?.rainTotalMm).toBeNull();expect(partial.rows[0].exposure?.rainValidDays).toBe(29);});
 it('preserves leap-day missingness and rejects duplicate/unsupported weather time axes',()=>{const rows=seasonalWeatherSummary(weather,'2024-02-29','2024-03-01',25,35).rows;expect(rows[0].exposure).toBeNull();expect(rows.find(r=>r.year===2008)?.exposure?.totalDays).toBe(2);const bad=structuredClone(weather);bad.weather[1].date=bad.weather[0].date;expect(()=>parseHistoricalWeather(bad)).toThrow(/duplicate/);bad.timeStandard='LST';expect(()=>parseHistoricalWeather(bad)).toThrow(/time/);});
 it('prefers the cacheable validated history without requesting the server API',async()=>{
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>weather});vi.stubGlobal('fetch',fetcher);
  expect(await loadHistoricalWeather(new AbortController().signal,true)).toEqual(weather);
  expect(fetcher.mock.calls.map(c=>c[0])).toEqual(['/atlas/power-history.json']);
 });
 it('falls back to validated API history when the static archive is unavailable',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce({ok:false,status:503}).mockResolvedValueOnce({ok:true,json:async()=>weather});vi.stubGlobal('fetch',fetcher);
  expect(await loadHistoricalWeather(new AbortController().signal,true)).toEqual(weather);
  expect(fetcher.mock.calls.map(c=>c[0])).toEqual(['/atlas/power-history.json','/api/atlas/history']);
 });
});
