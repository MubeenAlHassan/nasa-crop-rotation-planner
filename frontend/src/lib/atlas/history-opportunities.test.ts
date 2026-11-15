import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {DEFAULT_REQUEST} from './catalog';
import {compare} from './engine';
import {parseFieldEvidence,type FieldObservation} from './field-evidence';
import {historyOpportunities} from './history-opportunities';
import {attachStrategyRationales} from './strategy-rationale';
import type {EvidenceSeries,StrategyResult} from './types';

const weather=JSON.parse(readFileSync('public/atlas/iowa.json','utf8')) as EvidenceSeries;
const captured=parseFieldEvidence(JSON.parse(readFileSync('public/atlas/field-evidence.json','utf8')));
// Synthetic observations exercise review logic only; no farm measurements claimed.
const observation=(date:string):FieldObservation=>({id:date,datasetId:'landsat',observedAt:date+'T16:00:00Z',ndvi:.2,bsi:.1,validFraction:.9,directAerosolRetrievalFieldFraction:.9,interpolatedAerosolFieldFraction:0,status:'available',classification:'withheld',qaPolicy:'synthetic-test',assets:[]});
const evidence={...captured,observations:[observation('2024-03-01'),observation('2024-03-09')]};
const physical=(strategies:StrategyResult[])=>strategies.map(s=>{const out={...s};delete out.rationale;return out;});
function request(){
  const r=structuredClone(DEFAULT_REQUEST);
  Object.assign(r.field,{boundaryConfirmed:true,baselineConfirmed:true,laborAvailable:true,coverEquipment:true,smallGrainBuyer:true,smallGrainEquipment:true,smallGrainSuitable:true,forageSuitable:true,forageBuyer:true,forageEquipment:true,budget:4000});
  r.history.boundary=structuredClone(r.field.boundary);
  r.history.windows=[{id:'review',start:'2024-03-01',end:'2024-03-09',status:'farmer-confirmed',cover:'bare-soil',note:'Synthetic dated scouting fixture.',updatedAt:'2026-11-15T00:00:00Z',observationIds:evidence.observations.map(o=>o.id)}];
  return r;
}

describe('Reviewed-window calendar connections',()=>{
  it('connects a QA-accepted review pair and local confirmation to paired seasonal calendars',()=>{
    const [window]=historyOpportunities(request(),evidence);
    expect(window.status).toBe('confirmed-bare-soil');
    expect(window.satelliteLink).toBe('linked-review-pair');
    expect(window.observations.map(o=>[o.date,o.validFraction])).toEqual([['2024-03-01T16:00:00Z',.9],['2024-03-09T16:00:00Z',.9]]);
    expect(window.calendars).toHaveLength(4);
    const cover=window.calendars.find(c=>c.strategyId==='cover')!;
    expect(cover.years.map(y=>y.addedDays)).toEqual([0,9,0,9]);
    expect(cover.years.map(y=>y.baselineDays)).toEqual([0,0,0,0]);
    expect(cover.years[1].crops).toEqual(['rye']);
    expect(window.calendars[0].years.every(y=>y.addedDays===0&&y.lostDays===0)).toBe(true);
  });

  it.each(['unknown','bare-soil','residue-present','living-cover','mixed'] as const)('never turns an uncertain %s record into a gap',cover=>{
    const r=request();Object.assign(r.history.windows[0],{status:'uncertain',cover});
    const [window]=historyOpportunities(r,evidence);
    expect(window.status).toBe('review-required');expect(window.calendars).toEqual([]);
  });

  it.each(['residue-present','living-cover','mixed'] as const)('removes opportunities when a farmer corrects bare soil to %s',cover=>{
    const r=request();r.history.windows[0].cover=cover;
    const [window]=historyOpportunities(r,evidence);
    expect(window.status).toBe('other-cover');expect(window.calendars).toEqual([]);
  });

  it('withholds connections after a boundary edit or unconfirmed baseline, while retaining source records',()=>{
    const r=request();r.field.boundary[1][0]-=.001;
    const [window]=historyOpportunities(r,evidence);
    expect(window.status).toBe('withheld');expect(window.calendars).toEqual([]);expect(window.observations).toEqual([]);
    expect(window.note).toContain('scouting');
    const unconfirmed=request();unconfirmed.field.boundaryConfirmed=null;
    expect(historyOpportunities(unconfirmed,evidence)[0].calendars).toEqual([]);
    unconfirmed.field.boundaryConfirmed=true;unconfirmed.field.baselineConfirmed=null;
    expect(historyOpportunities(unconfirmed,evidence)[0].reason).toMatch(/baseline/);
  });

  it('withholds conflicting confirmed windows, but permits non-conflicting corrections and deletion',()=>{
    const r=request();r.history.windows.push({...r.history.windows[0],id:'conflict',cover:'residue-present'});
    expect(historyOpportunities(r,evidence).every(w=>w.status==='withheld'&&w.calendars.length===0)).toBe(true);
    r.history.windows[1].status='uncertain';
    expect(historyOpportunities(r,evidence)[0].status).toBe('confirmed-bare-soil');
    r.history.windows=[];expect(historyOpportunities(r,evidence)).toEqual([]);
  });

  it('does not claim satellite support for missing, poor-quality, high-NDVI or long-gap observations',()=>{
    for(const mutation of [
      (o:FieldObservation[])=>{o.pop();},
      (o:FieldObservation[])=>{o[1].validFraction=.7;},
      (o:FieldObservation[])=>{o[1].ndvi=.8;},
      (o:FieldObservation[])=>{o[1].observedAt='2024-04-09T16:00:00Z';},
    ]){
      const changed=structuredClone(evidence);mutation(changed.observations);
      const [window]=historyOpportunities(request(),changed);
      expect(window.satelliteLink).toBe('local-record-only');expect(window.warnings.length).toBeGreaterThan(0);
      expect(window.status).toBe('confirmed-bare-soil'); // Explicit local report remains usable.
    }
    expect(historyOpportunities(request(),null)[0].observations).toEqual([]);
  });

  it('requires the full reviewed window inside the selected history period and a local source note',()=>{
    const r=request();r.history.start='2024-03-02';
    expect(historyOpportunities(r,evidence)[0].status).toBe('withheld');
    r.history.start='2024-03-01';r.history.windows[0].note='';
    expect(historyOpportunities(r,evidence)[0].status).toBe('review-required');
  });

  it('keeps leap dates explicit and omits cross-year windows beyond the planning horizon',()=>{
    const r=request();r.history.start='2024-01-01';
    Object.assign(r.history.windows[0],{start:'2024-02-29',end:'2024-03-01'});
    const leap=historyOpportunities(r)[0].calendars[0];
    expect(leap.years.map(y=>[y.start,y.days])).toEqual([['2028-02-29',2]]);
    expect(leap.omittedYears).toEqual([2027,2029,2030]);
    r.history.end='2025-01-02';r.history.start='2024-12-28';
    Object.assign(r.history.windows[0],{start:'2024-12-28',end:'2025-01-02'});
    const cross=historyOpportunities(r)[0].calendars[0];
    expect(cross.years.map(y=>y.days)).toEqual([6,6,6]);expect(cross.omittedYears).toEqual([2030]);
  });

  it('uses the edited baseline phase and planting/termination calendar, not a separate approximation',()=>{
    const r=request();r.field.baseline='soybean-maize';
    expect(historyOpportunities(r)[0].calendars.find(c=>c.strategyId==='cover')!.years.map(y=>y.addedDays)).toEqual([0,0,9,0]);
    r.field.baseline='maize-soybean';Object.assign(r.history.windows[0],{start:'2024-04-10',end:'2024-04-15'});
    r.terminationDay=100;
    const early=historyOpportunities(r)[0].calendars.find(c=>c.strategyId==='cover')!;
    r.terminationDay=110;
    const late=historyOpportunities(r)[0].calendars.find(c=>c.strategyId==='cover')!;
    expect(early.years[1].addedDays).toBe(0);expect(late.years[1].addedDays).toBe(6);
  });

  it('enriches each rationale without changing any simulation, preference, constraints or farmer selection',()=>{
    const r=request();const original=compare(weather,r);
    const enriched=attachStrategyRationales(original,r,{weather,fieldEvidence:evidence});
    expect(enriched.strategies[1].rationale!.windowConnections[0].calendar!.years[1].addedDays).toBe(9);
    expect(enriched.preferred).toBe(original.preferred);
    expect(physical(enriched.strategies)).toEqual(physical(original.strategies));
    r.history.windows[0].cover='residue-present';
    const corrected=compare(weather,r);
    expect(physical(corrected.strategies)).toEqual(physical(original.strategies));
    expect(r.decision.selection).toBeNull();
  });
});
