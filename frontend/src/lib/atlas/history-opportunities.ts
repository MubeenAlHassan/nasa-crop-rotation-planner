import {cropAt} from './calendar';
import {STRATEGIES} from './catalog';
import {matchesEvidenceField, type FieldEvidence} from './field-evidence';
import {daysBetween, historyMatchesField, reviewCandidates, usableObservation} from './history';
import type {CropId, ScenarioRequest, StrategyId} from './types';

export const WINDOW_CONNECTION_METHOD='reviewed-window-calendar-v1';
export const WINDOW_CONNECTION_LIMIT='Seasonal calendar analogy only: a historical condition is not assumed to recur. Scheduled crops include dormancy, not measured protective biomass. Establishment, water use, termination and local feasibility need review. Scores and model outcomes are unchanged.';

export interface WindowCalendar {
  strategyId:StrategyId;
  years:{start:string;end:string;days:number;scheduledDays:number;baselineDays:number;addedDays:number;lostDays:number;crops:CropId[]}[];
  omittedYears:number[];
}
export interface HistoryOpportunity {
  windowId:string;start:string;end:string;cover:ScenarioRequest['history']['windows'][number]['cover'];
  note:string;updatedAt:string;
  status:'confirmed-bare-soil'|'review-required'|'other-cover'|'withheld';
  reason:string;
  satelliteLink:'linked-review-pair'|'local-record-only';
  observations:{id:string;date:string;ndvi:number;validFraction:number;qaPolicy:string}[];
  warnings:string[];
  calendars:WindowCalendar[];
}
export type StrategyWindowConnection=Omit<HistoryOpportunity,'calendars'> & {calendar:WindowCalendar|null;limit:string};

export function strategyWindowConnections(windows:HistoryOpportunity[],id:StrategyId):StrategyWindowConnection[] {
  return windows.map(({calendars,...window})=>({...window,calendar:calendars.find(c=>c.strategyId===id)??null,limit:WINDOW_CONNECTION_LIMIT}));
}

/** Calendar overlap, never a cover classifier or an additional scoring authority. */
export function historyOpportunities(request:ScenarioRequest,evidence:FieldEvidence|null=null):HistoryOpportunity[] {
  const {history,field}=request;
  const satelliteApplicable=historyMatchesField(history,field)&&!!evidence&&matchesEvidenceField(field,evidence);
  const candidates=satelliteApplicable?reviewCandidates(evidence.observations,history):[];
  return history.windows.map(w=>{
    const warnings:string[]=[];
    const observations=satelliteApplicable?evidence.observations.filter(o=>
      w.observationIds.includes(o.id)&&usableObservation(o)&&o.observedAt.slice(0,10)>=w.start&&o.observedAt.slice(0,10)<=w.end,
    ).map(o=>({id:o.id,date:o.observedAt,ndvi:o.ndvi!,validFraction:o.validFraction!,qaPolicy:o.qaPolicy})):[];
    const linked=candidates.some(c=>c.start===w.start&&c.end===w.end&&c.observationIds.every(id=>observations.some(o=>o.id===id)));
    if(!linked)warnings.push('No matching, QA-accepted low-NDVI review pair is linked to the full window; any calendar connection rests on the local record alone.');
    if(w.observationIds.some(id=>!observations.some(o=>o.id===id)))warnings.push('Some linked observations are missing, outside the window, rejected by QA or associated with a different boundary.');
    const conflict=history.windows.some(other=>other.id!==w.id&&other.status==='farmer-confirmed'&&other.cover!==w.cover&&other.start<=w.end&&other.end>=w.start);
    let status:HistoryOpportunity['status']='confirmed-bare-soil';
    let reason='Farmer reports bare soil. Compare scheduled crops in the same seasonal dates across the planning horizon.';
    if(!historyMatchesField(history,field)||field.boundaryConfirmed!==true){status='withheld';reason='Confirm the cropped boundary and restore matching history before connecting this record to rotations.';}
    else if(w.start<history.start||w.end>history.end){status='withheld';reason='The full window is outside the selected history period. Adjust the history filters to review it.';}
    else if(conflict){status='withheld';reason='Overlapping confirmed records report different ground conditions. Correct the conflicting windows before comparing calendars.';}
    else if(w.status!=='farmer-confirmed'||w.cover==='unknown'||!w.note.trim()){status='review-required';reason='Confirm the ground condition from dated local notes or photos before connecting this interval to rotations.';}
    else if(w.cover!=='bare-soil'){status='other-cover';reason='This record does not confirm a bare-soil gap. Residue, living vegetation and mixed cover are not treated as bare soil.';}
    else if(field.baselineConfirmed!==true){status='withheld';reason='Confirm the baseline crop sequence before comparing its calendar with alternatives.';}

    const calendars:WindowCalendar[]=status==='confirmed-bare-soil'?STRATEGIES.map(s=>{
      const years:WindowCalendar['years']=[],omittedYears:number[]=[];
      const lastYear=request.horizon.startYear+request.horizon.years-1;
      for(let year=request.horizon.startYear;year<=lastYear;year++){
        const start=`${year}${w.start.slice(4)}`;
        const end=`${year+Number(w.end.slice(0,4))-Number(w.start.slice(0,4))}${w.end.slice(4)}`;
        // Never roll Feb 29 into March or extend a comparison beyond its horizon.
        if(new Date(start).toISOString().slice(0,10)!==start||new Date(end).toISOString().slice(0,10)!==end||Number(end.slice(0,4))>lastYear){omittedYears.push(year);continue;}
        let scheduledDays=0,baselineDays=0,addedDays=0,lostDays=0;
        const crops=new Set<CropId>();
        const days=daysBetween(start,end)+1;
        for(let i=0;i<days;i++){
          const date=new Date(Date.parse(start)+i*86400000),yearIndex=date.getUTCFullYear()-request.horizon.startYear;
          const day=Math.floor((date.getTime()-Date.UTC(date.getUTCFullYear(),0,1))/86400000)+1;
          const crop=cropAt(s.id,yearIndex,day,request.terminationDay,request).crop;
          const baseline=cropAt('baseline',yearIndex,day,request.terminationDay,request).crop;
          if(crop){scheduledDays++;crops.add(crop);}
          if(baseline)baselineDays++;
          if(crop&&!baseline)addedDays++;
          if(baseline&&!crop)lostDays++;
        }
        years.push({start,end,days,scheduledDays,baselineDays,addedDays,lostDays,crops:[...crops]});
      }
      return {strategyId:s.id,years,omittedYears};
    }):[];
    return {windowId:w.id,start:w.start,end:w.end,cover:w.cover,note:w.note,updatedAt:w.updatedAt,status,reason,
      satelliteLink:linked?'linked-review-pair':'local-record-only',observations,warnings,calendars};
  });
}
