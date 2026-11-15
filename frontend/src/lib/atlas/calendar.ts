import {DEFAULT_REQUEST, STRATEGIES} from './catalog';
import type {CropId, ScenarioRequest, StrategyId} from './types';
const clamp=(x:number)=>Math.min(1,Math.max(0,x));

export function mainCrop(id:StrategyId,yearIndex:number,request:ScenarioRequest):CropId {
  const cycle=STRATEGIES.find(s=>s.id===id)!.cycle;
  const offset=request.field.baseline==='soybean-maize'?1:0;
  // Forage establishment must precede its productive stand, regardless of baseline phase.
  if(id==='forage') return (offset?['soybean','maize','oats','alfalfa'] as CropId[]:cycle)[yearIndex%4];
  return cycle[(yearIndex+offset)%cycle.length];
}
/** Illustrative calendars, not remotely inferred phenology. No cover is invented before the starting state. */
export function cropAt(id:StrategyId,yearIndex:number,day:number,termination:number,request:ScenarioRequest=DEFAULT_REQUEST):{crop:CropId|null;progress:number;cash:boolean} {
  const main=mainCrop(id,yearIndex,request), prev=yearIndex>0?mainCrop(id,yearIndex-1,request):null;
  const window=(crop:CropId,start:number,end:number,cash:boolean)=>({crop,progress:clamp((day-start)/(end-start)),cash});
  if(id==='cover') {
    if(main==='soybean'&&prev==='maize'&&day<termination) return window('rye',60,termination,false);
    if(main==='maize'&&day>=request.calendar.ryeSow&&day>request.calendar.maize[1]) return window('rye',request.calendar.ryeSow,365,false);
  }
  if(id==='diverse') {
    if(main==='soybean'&&day>=Math.max(280,request.calendar.soybean[1]+3)) return window('wheat',Math.max(280,request.calendar.soybean[1]+3),365,false);
    if(main==='wheat') return day<=200?window('wheat',60,200,true):window('clover',201,365,false);
    if(prev==='wheat'&&day<105) return window('clover',60,105,false);
  }
  if(id==='forage') {
    if(main==='oats'&&day>210) return window('alfalfa',210,365,false);
    if(main==='alfalfa') return window('alfalfa',60,310,true);
  }
  const windows:Partial<Record<CropId,[number,number]>>={maize:request.calendar.maize,soybean:request.calendar.soybean,oats:[100,210]};
  const w=windows[main];
  return w&&day>=w[0]&&day<=w[1]?window(main,...w,true):{crop:null,progress:0,cash:false};
}
