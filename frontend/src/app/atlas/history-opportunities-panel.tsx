'use client';
import {CROPS,STRATEGIES} from '@/lib/atlas/catalog';
import {WINDOW_CONNECTION_LIMIT,type HistoryOpportunity} from '@/lib/atlas/history-opportunities';
import type {ComparisonResult,StrategyId} from '@/lib/atlas/types';

const number=(n:number)=>n.toLocaleString('en-US',{maximumFractionDigits:1});
const signed=(n:number)=>`${n>0?'+':''}${number(n)}`;
type Props={windows:HistoryOpportunity[];result:ComparisonResult|null;onReview?:()=>void;onInspect?:(id:StrategyId)=>void};

export function HistoryOpportunitiesPanel({windows,result,onReview,onInspect}:Props) {
  return <section className="ra-card ra-window-connections ra-prose" aria-labelledby="window-connections-title">
    <span className="ra-eyebrow">OBSERVATION → LOCAL REVIEW → COMPARISON</span>
    <h2 id="window-connections-title">What your reviewed windows could change</h2>
    <p>Confirm what was on the ground, then explore which planned crop calendars could occupy those seasonal dates. This highlights questions for comparison; it does not select a rotation.</p>
    {!windows.length&&<p>No historical windows recorded. In Field history &amp; windows, review a Landsat interval or enter dated local observations.</p>}
    {windows.map(w=><article className="ra-history-record" key={w.windowId}>
      <h3>{w.start} → {w.end}</h3>
      <p><strong>{w.status==='confirmed-bare-soil'?'Farmer-confirmed bare soil':w.status==='review-required'?'Ground review needed':w.status==='other-cover'?'Other ground cover reported':'Connection withheld'}</strong> · {w.reason}</p>
      <p>Local record: {w.note||'No local source note yet.'} <small>Updated {w.updatedAt}</small></p>
      {w.observations.length>0&&<details><summary>Linked Landsat dates and quality · {w.satelliteLink==='linked-review-pair'?'review pair linked':'partial context only'}</summary><ul>{w.observations.map(o=><li key={o.id}>{o.date} · NDVI {o.ndvi.toFixed(3)} · {number(o.validFraction*100)}% valid field area · {o.qaPolicy}<br/><code>{o.id}</code></li>)}</ul><p className="ra-small">Low NDVI prompted a question. It does not establish bare soil, residue cover or conditions between observations.</p></details>}
      {w.warnings.map(warning=><p className="ra-small" key={warning}>{warning}</p>)}
      {w.calendars.length>0&&<><p className="ra-small">Scroll across the table to compare water, margin and feasibility. Open “Dates, crops and days” for each planning year.</p><div className="ra-table-scroll" tabIndex={0} role="region" aria-label={`Rotation calendar comparison for ${w.start} to ${w.end}`}><table>
        <caption>Same seasonal dates in 2027–2030 · illustrative crop calendars; modeled differences are whole four-year outcomes per hectare</caption>
        <thead><tr><th scope="col">Rotation</th><th scope="col">Calendar connection</th><th scope="col">Water shortfall Δ (mm)</th><th scope="col">Gross margin Δ (USD/ha)</th><th scope="col">Feasibility</th><th scope="col">Explore</th></tr></thead>
        <tbody>{w.calendars.map(c=>{
          const strategy=result?.status==='ready'?result.strategies.find(s=>s.id===c.strategyId):undefined;
          const added=c.years.filter(y=>y.addedDays>0).length;
          return <tr key={c.strategyId}>
            <th scope="row">{STRATEGIES.find(s=>s.id===c.strategyId)!.name}</th>
            <td><strong>{c.strategyId==='baseline'?'Baseline calendar':added?`Additional scheduled cover in ${added}/${c.years.length} seasonal windows`:'No additional calendar cover in these windows'}</strong>
              <details><summary>Dates, crops and days</summary><ul>{c.years.map(y=><li key={y.start}>{y.start} to {y.end}: {y.scheduledDays}/{y.days} days with a scheduled crop ({y.crops.map(id=>CROPS[id].name).join(', ')||'none'}); baseline {y.baselineDays}; added {y.addedDays}, lost {y.lostDays} days.</li>)}</ul>{c.omittedYears.length>0&&<p>Start years omitted for leap-date or horizon limits: {c.omittedYears.join(', ')}.</p>}</details>
            </td>
            <td>{strategy?signed(strategy.pairedDifferences.deficit.mean):'Withheld'}<small>Lower means less shortfall</small></td>
            <td>{strategy?signed(strategy.pairedDifferences.margin.mean):'Withheld'}<small>Unvalidated scenario</small></td>
            <td>{strategy?.feasibility??'Not computed'}</td>
            <td>{onInspect&&<button type="button" className="ra-button ra-button-outline" onClick={()=>onInspect(c.strategyId)}>Inspect {STRATEGIES.find(s=>s.id===c.strategyId)!.name}</button>}</td>
          </tr>;
        })}</tbody>
      </table></div></>}
    </article>)}
    <p className="ra-small">{WINDOW_CONNECTION_LIMIT} Whole-horizon modeled differences are not benefits attributed to the historical window. Failed or unknown feasibility still prevents ranking.</p>
    {onReview&&<button type="button" className="ra-button ra-button-outline" onClick={onReview}>Review field history and ground conditions</button>}
  </section>;
}
