import type { EvidenceSeries } from './types';
/** Fixed forcing support; incomplete or duplicate days withhold totals, never imply zero. */
export function rainfallSummary(data: EvidenceSeries) {
  const rows = new Map<string, EvidenceSeries['weather']>();
  for (const row of data.timeStandard==='UTC'?data.weather:[]) rows.set(row.date, [...(rows.get(row.date) ?? []), row]);
  const sums = Array<number>(12).fill(0), valid = Array<number>(12).fill(0), expected = Array<number>(12).fill(0);
  for (let time=Date.UTC(2013,0,1); time<Date.UTC(2025,0,1); time+=86400000) {
    const date=new Date(time), month=date.getUTCMonth(), matches=rows.get(date.toISOString().slice(0,10));
    expected[month]++;
    const rain=matches?.length===1 ? matches[0].rain : null;
    if (rain !== null && rain !== undefined && Number.isFinite(rain) && rain>=0) { sums[month]+=rain; valid[month]++; }
  }
  const monthlyMeans=sums.map((sum,i)=>valid[i]===expected[i]?sum/12:null);
  return {monthlyMeans,valid,expected,annualMean:monthlyMeans.every(x=>x!==null)?sums.reduce((a,b)=>a+b,0)/12:null};
}
