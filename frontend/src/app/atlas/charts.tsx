'use client';

import { rainfallSummary } from '@/lib/atlas/rainfall-summary';
import { useId } from 'react';
import type { CSSProperties } from 'react';
import { CROPS } from '@/lib/atlas/catalog';
import type { EvidenceSeries, SensitivityResult, StrategyId, StrategyResult } from '@/lib/atlas/types';

export const shortNames: Record<StrategyId, string> = {
  baseline: 'Current rotation', cover: 'Winter cover', diverse: 'Grain + legume', forage: 'Forage phase',
};
export const strategyColors: Record<StrategyId, string> = {
  baseline: '#666b53', cover: '#426d45', diverse: '#856123', forage: '#3c7176',
};
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const number = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 1 });

export function RainChart({ data, adjustment }: { data: EvidenceSeries; adjustment: number }) {
  const id = useId();
  const totals = rainfallSummary(data).monthlyMeans;
  const max = Math.max(1, ...totals.filter((v): v is number => v !== null)) * 1.4;
  return <div className="ra-rainchart">
    <p id={id} className="ra-small">Mean monthly NASA POWER precipitation, 2013–2024. Incomplete or duplicate daily support withholds that monthly mean. Solid left bars: historical mean; hatched right bars: your rainfall scenario.</p>
    <div className="ra-chart-bars" role="img" aria-labelledby={id}>{totals.map((value, i) => <div key={months[i]}>
      <div className="ra-chart-bar-pair">{value===null ? <small>Withheld</small> : <><span data-rain-series="historical" data-value={value} style={{ height: `${value / max * 100}%` }} /><span data-rain-series="scenario" data-value={value * adjustment / 100} className="ra-pattern-hatch" style={{ height: `${value * adjustment / 100 / max * 100}%` }} /></>}</div><small>{months[i]}</small>
    </div>)}</div>
    <div className="ra-legend" aria-hidden="true"><span><i className="ra-historical-key" />Historical mean · left</span><span><i className="ra-scenario-key ra-pattern-hatch" />Scenario · right</span></div>
    <details className="ra-chart-data"><summary>View monthly rainfall values</summary><div className="ra-table-scroll"><table>
      <caption>Mean monthly precipitation (mm); scenario at {adjustment}% of history</caption>
      <thead><tr><th scope="col">Month</th><th scope="col">Historical mean</th><th scope="col">Scenario</th></tr></thead>
      <tbody>{totals.map((value, i) => <tr key={months[i]}><th scope="row">{months[i]}</th><td>{value===null?'Withheld':number(value)}</td><td>{value===null?'Withheld':number(value * adjustment / 100)}</td></tr>)}</tbody>
    </table></div></details>
  </div>;
}

export function SensitivityChart({ result }: { result: SensitivityResult }) {
  const id = useId();
  return <div className="ra-sweep" aria-labelledby={id}>
    <p id={id} className="ra-small">Preferred rotation at each tested rainfall level. Each cell names the rotation; percentages are relative to historical rainfall.</p>
    <div className="ra-sweep-label" aria-hidden="true"><span>Lower rainfall</span><span>Higher rainfall</span></div>
    <div className="ra-sweep-track">{result.sweeps.rainfall.map(p => <div key={p.value} style={{ '--ra-sweep-color': p.preferred ? strategyColors[p.preferred] : '#e4e1d7' } as CSSProperties}>
      <span><strong>{p.value}%</strong><span>{p.preferred ? shortNames[p.preferred] : 'Preference withheld'}</span></span>
    </div>)}</div>
    <details className="ra-chart-data"><summary>View rainfall sensitivity values</summary><div className="ra-table-scroll"><table>
      <caption>Rainfall sensitivity: preference and reference-strategy margin (baseline while preference is withheld)</caption>
      <thead><tr><th scope="col">Rainfall (% of history)</th><th scope="col">Preferred rotation</th><th scope="col">Margin ($/ha/year)</th></tr></thead>
      <tbody>{result.sweeps.rainfall.map(p => <tr key={p.value}><th scope="row">{p.value}%</th><td>{p.preferred ? shortNames[p.preferred] : 'Preference withheld'}</td><td>{p.margin === null ? 'Not available' : number(p.margin)}</td></tr>)}</tbody>
    </table></div></details>
  </div>;
}

export function Timeline({ result }: { result: StrategyResult }) {
  const id = useId();
  const years = result.years.map(year => {
    const days = result.daily.filter(d => d.planningYear===year.year);
    // Contiguous labeled periods are the text equivalent of the daily color track.
    const periods: { start: string; end: string; crop: typeof days[number]['crop']; days: number }[] = [];
    for (const day of days) {
      const last = periods.at(-1);
      if (last && last.crop === day.crop) { last.end = day.date; last.days++; }
      else periods.push({ start: day.date, end: day.date, crop: day.crop, days: 1 });
    }
    return { year, days, periods };
  });
  return <div className="ra-timeline ra-prose">
    <p id={id} className="ra-small">2027–2030 planning calendar using the 2013–2016 weather member. Named periods identify crops; dates below retain source-weather months and days.</p>
    {years.map(({ year, days, periods }) => <div className="ra-season" key={year.year}>
      <span>{year.year}<small>{CROPS[year.crop].name}<br/>weather {year.weatherYear}</small></span><div className="ra-season-body">
        <div className="ra-season-months" aria-hidden="true">{months.map((month,i)=><span key={month} style={{flex:new Date(Date.UTC(year.weatherYear,i+1,0)).getUTCDate()}}>{month}</span>)}</div>
        <div className="ra-season-track" aria-hidden="true">{days.map(d => <span key={d.date} data-date={d.date} data-crop={d.crop??'gap'} className={d.crop ? `ra-crop-pattern-${d.crop}` : 'ra-gap'} title={`${d.date}: ${d.crop ? CROPS[d.crop].name : 'Possible cover gap'} · ${number(d.deficit)} mm unmet demand`} style={{ backgroundColor: d.crop ? CROPS[d.crop].color : undefined }} />)}</div>
        <div className="ra-season-labels">{periods.map(p => <span key={p.start}>{p.crop ? CROPS[p.crop].name : 'Possible cover gap'}: {p.start.slice(5)}–{p.end.slice(5)}</span>)}</div>
      </div>
    </div>)}
    <details className="ra-chart-data"><summary>View crop calendar dates</summary><div className="ra-table-scroll"><table aria-describedby={id}>
      <caption>{result.name}: four-year planning horizon (source-weather dates)</caption><thead><tr><th scope="col">Crop / period</th><th scope="col">Start</th><th scope="col">End</th><th scope="col">Days</th></tr></thead>
      <tbody>{years.flatMap(({ periods }) => periods.map(p => <tr key={p.start}><th scope="row">{p.crop ? CROPS[p.crop].name : 'Possible cover gap'}</th><td>{p.start}</td><td>{p.end}</td><td>{p.days}</td></tr>))}</tbody>
    </table></div></details>
    <details className="ra-chart-data"><summary>Planting, harvest and termination events</summary><div className="ra-table-scroll"><table><thead><tr><th>Planning year</th><th>Source-weather date</th><th>Operation</th></tr></thead><tbody>{result.daily.filter(d=>d.events.length).map(d=><tr key={d.date}><td>{d.planningYear}</td><td>{d.date}</td><td>{d.events.join('; ')}</td></tr>)}</tbody></table></div></details>
    <p className="ra-small">Modeled calendar, not observed crop history. Living cover is calendar occupancy, including winter dormancy; it does not measure biomass or protective ground cover. Residue can remain during gaps.</p>
  </div>;
}
