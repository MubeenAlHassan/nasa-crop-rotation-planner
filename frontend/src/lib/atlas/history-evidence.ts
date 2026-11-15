import type {EvidenceSeries} from './types';
import {readEvidenceJson} from './evidence-fetch';
export function parseHistoricalWeather(value:unknown):EvidenceSeries {
 const d=value as EvidenceSeries;
 if(d?.schemaVersion!=='atlas-evidence-1'||d.id!=='iowa-power-history-2005-2024'||d.start!=='2005-01-01'||d.end!=='2024-12-31'||d.timeStandard!=='UTC'||d.latitude!==42.025||d.longitude!==-93.65||!Array.isArray(d.weather)||d.weather.length!==7305||!Array.isArray(d.sources)||d.sources.length!==20)throw Error('Extended POWER history has incompatible coverage, support or time metadata.');
 const start=Date.parse('2005-01-01');
 d.weather.forEach((r,i)=>{if(r.date!==new Date(start+i*86400000).toISOString().slice(0,10)||['rain','tmin','tmax','rh','wind','solar'].some(k=>{const v=r[k as keyof typeof r];return v!==null&&(typeof v!=='number'||!Number.isFinite(v));}))throw Error('Extended history has duplicate/missing dates or invalid values.');});
 return d;
}

import {weatherExposure,validDate} from './history';
export function seasonalWeatherSummary(weather:EvidenceSeries,start:string,end:string,rain:number,heat:number) {
 const offset=Number(end.slice(0,4))-Number(start.slice(0,4));
 const years=Array.from({length:Number(weather.end.slice(0,4))-Number(weather.start.slice(0,4))+1},(_,i)=>Number(weather.start.slice(0,4))+i);
 const rows=years.map(year=>{const a=`${year}${start.slice(4)}`,b=`${year+offset}${end.slice(4)}`;return {year,start:a,end:b,exposure:validDate(a)&&validDate(b)?weatherExposure(weather,a,b,rain,heat):null};});
 const complete=rows.filter(r=>r.exposure?.rainTotalMm!==null&&r.exposure?.rainTotalMm!==undefined);
 return {rows,rainCompleteYears:complete.length,rainMeanMm:complete.length?complete.reduce((s,r)=>s+r.exposure!.rainTotalMm!,0)/complete.length:null,referenceStart:weather.start,referenceEnd:weather.end};
}
export async function loadHistoricalWeather(signal:AbortSignal,online:boolean):Promise<EvidenceSeries> {
 try{return parseHistoricalWeather(await readEvidenceJson('/atlas/power-history.json',signal));}
 catch(error){signal.throwIfAborted();if(!online)throw error;}
 return parseHistoricalWeather(await readEvidenceJson('/api/atlas/history',signal));
}
