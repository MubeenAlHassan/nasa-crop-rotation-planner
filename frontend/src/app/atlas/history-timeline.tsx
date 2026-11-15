import {daysBetween,usableObservation} from '@/lib/atlas/history';
import type {FieldObservation} from '@/lib/atlas/field-evidence';
import type {FieldHistory,HistoryWindow,ManagementRecord} from '@/lib/atlas/types';

type Candidate={id:string;start:string;end:string};
type Props={history:FieldHistory;observations:FieldObservation[];candidates:Candidate[];windows:HistoryWindow[];operations:ManagementRecord[];satelliteApplicable:boolean;historyApplicable:boolean};
const LEFT=185,RIGHT=925;
export function HistoryTimeline({history,observations,candidates,windows,operations,satelliteApplicable,historyApplicable}:Props){
  const duration=Math.max(1,daysBetween(history.start,history.end));
  const x=(date:string)=>LEFT+Math.max(0,Math.min(1,daysBetween(history.start,date)/duration))*(RIGHT-LEFT);
  const y=(ndvi:number)=>110-ndvi*40;
  const uncertain=windows.filter(w=>w.status==='uncertain'),confirmed=windows.filter(w=>w.status==='farmer-confirmed');
  const months:string[]=[];
  const cursor=new Date(history.start+'T00:00:00Z');cursor.setUTCDate(1);cursor.setUTCMonth(cursor.getUTCMonth()+1);
  while(cursor.toISOString().slice(0,10)<history.end){months.push(cursor.toISOString().slice(0,10));cursor.setUTCMonth(cursor.getUTCMonth()+1);}
  const bar=(record:Candidate,row:number,confirmed=false)=>{
    const start=x(record.start),end=x(record.end);
    // A one-day interval still needs a visible glyph, contained in the plot.
    const width=Math.max(3,end-start),left=Math.min(start,RIGHT-width);
    return <rect key={record.id} data-window-id={record.id} x={left} y={row} width={width} height="10" fill={confirmed?'#245a43':'#d6b47c'}><title>{`${record.start} to ${record.end}${'cover' in record?`: ${(record as HistoryWindow).cover}`:''}`}</title></rect>;
  };
  return <section className="ra-card"><h2>Four distinct evidence lanes</h2>
    <p className="ra-small">Dates use UTC. Scroll across the timeline to inspect the full season. Withheld acquisitions have their own quality row and are not plotted as NDVI zero.</p>
    <div className="ra-table-scroll" tabIndex={0} role="region" aria-label="Scrollable seasonal evidence timeline">
      <svg className="ra-history-timeline" viewBox="0 0 960 375" role="img" aria-labelledby="history-timeline-title history-timeline-description">
        <title id="history-timeline-title">Historical timeline: observed indices, uncertain review intervals, management records and farmer-confirmed windows</title>
        <desc id="history-timeline-description">NDVI uses a fixed scale from minus one to one. Crosses in the separate withheld-dates row represent unavailable values. Empty evidence lanes do not establish continuous cover or the absence of farming operations.</desc>
        <text x={LEFT} y="20">{history.start}</text><text x={RIGHT} y="20" textAnchor="end">{history.end}</text>
        {months.map(date=><g key={date}><path d={`M${x(date)} 52V350`} stroke="#dce2d8" strokeDasharray="3 5"/><text x={x(date)} y="44" textAnchor="middle" fontSize="11">{new Date(date+'T00:00:00Z').toLocaleDateString('en-US',{month:'short',timeZone:'UTC'})}</text></g>)}
        {[1,0,-1].map(value=><g key={value}><text x={LEFT-8} y={y(value)+4} textAnchor="end" fontSize="12">{value}</text><path d={`M${LEFT} ${y(value)}H${RIGHT}`} stroke={value===0?'#aebda8':'#e2e7de'}/></g>)}
        <text x="4" y="110">Observed NDVI</text>
        {observations.filter(usableObservation).map(o=><circle key={o.id} data-observation-id={o.id} cx={x(o.observedAt.slice(0,10))} cy={y(o.ndvi!)} r="4" fill="#245a43"><title>{`${o.observedAt}: NDVI ${o.ndvi}; ${((o.validFraction??0)*100).toFixed(1)}% valid field area`}</title></circle>)}
        {!observations.some(usableObservation)&&<text x={LEFT+8} y="96" fontSize="12">{satelliteApplicable?'No QA-accepted observations in this period':'Satellite evidence unavailable for this boundary'}</text>}
        <text x="4" y="186" fontSize="12">Withheld dates (QA)</text><path d={`M${LEFT} 182H${RIGHT}`} stroke="#ccd3c9"/>
        {observations.filter(o=>!usableObservation(o)).map(o=><text key={o.id} data-withheld-id={o.id} x={x(o.observedAt.slice(0,10))} y="186" textAnchor="middle" fill="#685b4b"><title>{`${o.observedAt}: ${o.status}. ${o.reason??'Field summary withheld; no NDVI value plotted.'}`}</title>×</text>)}
        {['Uncertain intervals','Management','Farmer confirmed'].map((label,i)=><g key={label}><text x="4" y={236+i*55}>{label}</text><path d={`M${LEFT} ${232+i*55}H${RIGHT}`} stroke="#ccd3c9"/></g>)}
        {candidates.map(c=><rect key={c.id} data-candidate-id={c.id} x={Math.min(x(c.start),RIGHT-3)} y="221" width={Math.max(3,x(c.end)-x(c.start))} height="9" fill="none" stroke="#95682a" strokeDasharray="3 2"><title>{`Uncertain review: ${c.start} to ${c.end}; not detected bare soil`}</title></rect>)}
        {uncertain.map(w=>bar(w,234))}
        {operations.map(m=><path key={m.id} data-management-id={m.id} d={`M${x(m.date)} 280l5 7-5 7-5-7Z`} fill="#5c618d"><title>{`${m.date}: ${m.operation}; ${m.crop||'crop unspecified'}`}</title></path>)}
        {confirmed.map(w=>bar(w,336,true))}
        {!candidates.length&&!uncertain.length&&<text x={LEFT+8} y="221" fontSize="12">{satelliteApplicable?'No review pairs meet the current filters; no uncertain windows saved':'Review pairs unavailable; no uncertain windows shown'}</text>}
        {!operations.length&&<text x={LEFT+8} y="276" fontSize="12">{historyApplicable?'No management records in this period':'No matching management records for this boundary'}</text>}
        {!confirmed.length&&<text x={LEFT+8} y="331" fontSize="12">{historyApplicable?'No farmer-confirmed windows in this period':'No matching farmer-confirmed windows for this boundary'}</text>}
      </svg>
    </div>
    <p className="ra-small">Dots: observed NDVI, not a cover class. × in the quality row: field summary withheld or acquisition excluded, not zero NDVI. Dashed bars: unconfirmed review intervals. Diamonds: farmer management records. Solid green bars: farmer-confirmed conditions, not independent validation. No lines interpolate between satellite observations. Detailed dates, QA and records follow.</p>
  </section>;
}
