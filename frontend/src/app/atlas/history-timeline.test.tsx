// @vitest-environment jsdom
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {DEFAULT_REQUEST} from '@/lib/atlas/catalog';
import {reviewCandidates,usableObservation,daysBetween} from '@/lib/atlas/history';
import type {FieldObservation} from '@/lib/atlas/field-evidence';
import captured from '../../../public/atlas/field-evidence.json';
import {HistoryTimeline} from './history-timeline';

const history=structuredClone(DEFAULT_REQUEST.history);
const observations=captured.observations as FieldObservation[];
const fixture=(date:string,value:number|null):FieldObservation=>({...observations[0],id:date,observedAt:date+'T16:00:00Z',ndvi:value,bsi:value===null?null:.1,validFraction:value===null?.5:.9,status:value===null?'insufficient-coverage':'available'});
function render(props:Partial<Parameters<typeof HistoryTimeline>[0]>={}){
  const host=document.createElement('div');
  host.innerHTML=renderToStaticMarkup(<HistoryTimeline history={history} observations={[]} candidates={[]} windows={[]} operations={[]} satelliteApplicable historyApplicable {...props}/>);
  return host;
}

describe('Historical evidence timeline plotting',()=>{
  it('plots every accepted captured value at the correct UTC date and fixed-scale NDVI coordinate',()=>{
    const host=render({observations,candidates:reviewCandidates(observations,history)});
    const accepted=observations.filter(usableObservation);
    expect(accepted).toHaveLength(17);
    expect(host.querySelectorAll('circle[data-observation-id]')).toHaveLength(17);
    for(const observation of accepted){
      const point=Array.from(host.querySelectorAll('circle')).find(p=>p.getAttribute('data-observation-id')===observation.id)!;
      expect(Number(point.getAttribute('cx'))).toBeCloseTo(185+daysBetween(history.start,observation.observedAt.slice(0,10))/daysBetween(history.start,history.end)*740,8);
      expect(Number(point.getAttribute('cy'))).toBeCloseTo(110-observation.ndvi!*40,8);
      expect(point.querySelector('title')!.textContent).toContain(String(observation.ndvi));
    }
    expect(host.querySelectorAll('[data-withheld-id]')).toHaveLength(49);
    expect(host.textContent).toContain('No review pairs meet the current filters');
    expect(host.textContent).toContain('No management records in this period');
    expect(host.textContent).toContain('No farmer-confirmed windows in this period');
  });

  it('preserves real zero and negative values, with missing NDVI on a separate QA row',()=>{
    const host=render({observations:[fixture('2024-03-01',-1),fixture('2024-03-02',0),fixture('2024-03-03',1),fixture('2024-03-04',null)]});
    expect(Array.from(host.querySelectorAll('circle')).map(p=>Number(p.getAttribute('cy')))).toEqual([150,110,70]);
    expect(host.querySelector('[data-withheld-id]')!.getAttribute('y')).toBe('186');
    expect(host.querySelectorAll('circle')).toHaveLength(3);
    expect(host.querySelectorAll('polyline')).toHaveLength(0);
  });

  it('uses the correct spacing across leap day and finite coordinates for a single-day view',()=>{
    const h={...history,start:'2024-02-28',end:'2024-03-01'};
    const host=render({history:h,observations:[fixture('2024-02-28',.2),fixture('2024-02-29',.2),fixture('2024-03-01',.2)]});
    expect(Array.from(host.querySelectorAll('circle')).map(p=>Number(p.getAttribute('cx')))).toEqual([185,555,925]);
    const single=render({history:{...h,start:'2024-03-01'},observations:[fixture('2024-03-01',.2)]});
    expect(single.innerHTML).not.toMatch(/NaN|Infinity/);
  });

  it('clips partial windows to the period and contains one-day bars at its final date',()=>{
    const base={id:'fixture',start:'2024-02-20',end:'2024-03-10',status:'farmer-confirmed' as const,cover:'bare-soil' as const,note:'Synthetic fixture',observationIds:[],updatedAt:'2026-11-15T00:00:00Z'};
    const host=render({windows:[base,{...base,id:'last-day',start:history.end,end:history.end}],operations:[{id:'operation',date:'2024-04-01',operation:'plant',crop:'maize',note:'Synthetic fixture',updatedAt:base.updatedAt}]});
    const bars=host.querySelectorAll('[data-window-id]');
    expect(bars[0].getAttribute('x')).toBe('185');
    expect(Number(bars[1].getAttribute('x'))+Number(bars[1].getAttribute('width'))).toBeLessThanOrEqual(925);
    expect(host.querySelector('[data-management-id]')!.querySelector('title')!.textContent).toContain('2024-04-01');
    expect(host.textContent).not.toContain('No farmer-confirmed windows');
  });

  it('labels missing boundary evidence explicitly and provides calendar month ticks',()=>{
    const host=render({satelliteApplicable:false,historyApplicable:false});
    expect(host.textContent).toContain('Satellite evidence unavailable for this boundary');
    expect(host.textContent).toContain('No matching management records for this boundary');
    for(const month of ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov'])expect(host.textContent).toContain(month);
    expect(host.querySelector('svg')!.getAttribute('aria-labelledby')).toContain('history-timeline-title');
  });

  it('keeps candidate intervals and saved uncertain windows on distinct subrows at the same dates',()=>{
    const pair=[fixture('2024-03-01',.2),fixture('2024-03-09',.2)];
    const candidates=reviewCandidates(pair,history);
    const window={id:'saved-fixture',start:'2024-03-01',end:'2024-03-09',status:'uncertain' as const,cover:'unknown' as const,note:'Synthetic uncertainty fixture',observationIds:pair.map(o=>o.id),updatedAt:'2026-11-15T00:00:00Z'};
    const host=render({observations:pair,candidates,windows:[window]});
    const candidate=host.querySelector('[data-candidate-id]')!,saved=host.querySelector('[data-window-id]')!;
    expect(candidate.getAttribute('x')).toBe(saved.getAttribute('x'));
    expect(Number(candidate.getAttribute('width'))).toBeCloseTo(8/274*740);
    expect(candidate.getAttribute('y')).toBe('221');expect(saved.getAttribute('y')).toBe('234');
    expect(candidate.getAttribute('stroke-dasharray')).toBe('3 2');
    expect(host.textContent).not.toContain('No review pairs meet');
  });
});
