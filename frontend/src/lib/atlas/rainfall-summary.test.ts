import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import type {EvidenceSeries} from './types';
import {rainfallSummary} from './rainfall-summary';
const fixture=()=>JSON.parse(readFileSync('public/atlas/iowa.json','utf8')) as EvidenceSeries;
describe('fixed-support rainfall summaries',()=>{
 it('retains true zero and complete archive means',()=>{const d=fixture();expect(rainfallSummary(d).annualMean).toBeGreaterThan(0);d.weather.forEach(r=>r.rain=0);expect(rainfallSummary(d).annualMean).toBe(0);});
 it('withholds missing values, absent days and duplicates without discarding complete months',()=>{for(const mode of ['null','absent','duplicate']){const d=fixture();if(mode==='null')d.weather[0].rain=null;else if(mode==='absent')d.weather.shift();else d.weather.push({...d.weather[0]});const s=rainfallSummary(d);expect(s.annualMean).toBeNull();expect(s.monthlyMeans[0]).toBeNull();expect(s.monthlyMeans[1]).not.toBeNull();}});
});
