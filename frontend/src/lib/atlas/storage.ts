import type {GraceEvidence} from './grace';
import {ecoMatches, type EcoEvidence} from './ecostress';
import {seasonalWindow,type NasaSeason} from './nasa-season';
import type { ComparisonResult, EvidenceSeries, ScenarioRequest } from './types';
import { DEFAULT_REQUEST } from './catalog';
import { matchesEvidenceField, type FieldEvidence } from './field-evidence';
import { validateRequest } from './engine';
import { historyMatchesField, historyReport } from './history';
import { attachStrategyRationales } from './strategy-rationale';
export const STORAGE_KEY='rotation-atlas-decision-v1';
export interface SavedDecision { schema:1; updatedAt:string; request:ScenarioRequest; pending:boolean; }
export function saveDecision(request:ScenarioRequest):SavedDecision { validateRequest(request); const value:SavedDecision={schema:1,updatedAt:new Date().toISOString(),request,pending:true}; localStorage.setItem(STORAGE_KEY,JSON.stringify(value)); return value; }
export function loadDecision():SavedDecision|null { try { const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'); if(value?.schema!==1)return null; if(!value.request?.horizon&&value.request?.field){value.request={...structuredClone(DEFAULT_REQUEST),...value.request,field:{...structuredClone(DEFAULT_REQUEST.field),...value.request.field,boundaryConfirmed:null,baselineConfirmed:null},decision:{selection:null,notes:'Restored from Atlas v1; review new horizon and feasibility checks.',reviewed:false}};}if(value.request&&value.request.history===undefined)value.request.history=structuredClone(DEFAULT_REQUEST.history);if(value.request&&value.request.enterprise===undefined)value.request.enterprise=structuredClone(DEFAULT_REQUEST.enterprise);validateRequest(value.request); return value; } catch { return null; } }
export async function syncDecision(value:SavedDecision):Promise<boolean> {
  // One opaque per-device key; no public listing or account-based sharing.
  try { let key=localStorage.getItem('rotation-atlas-device');if(!key){key=crypto.randomUUID();localStorage.setItem('rotation-atlas-device',key);}const response=await fetch('/api/atlas/decisions',{method:'POST',headers:{'Content-Type':'application/json','X-Atlas-Device':key},body:JSON.stringify(value)}); if(!response.ok)return false; const result=await response.json(); if(result.status!=='saved'||result.updatedAt!==value.updatedAt)return false;
    const latest=loadDecision(); if(latest?.updatedAt===value.updatedAt) localStorage.setItem(STORAGE_KEY,JSON.stringify({...value,pending:false})); return true;
  } catch { return false; }
}
export function downloadReport(request:ScenarioRequest,result:unknown,evidence:EvidenceSeries|null,fieldEvidence:FieldEvidence|null=null,historicalWeather:EvidenceSeries|null=evidence,regionalSeasonalEvidence:NasaSeason|null=null,ecostressEvidence:EcoEvidence|null=null,graceEvidence:GraceEvidence|null=null,regionalSeasonalPackages:NasaSeason[]=[]):void {
  const crossMonthWindows=historyMatchesField(request.history,request.field)?request.history.windows.map(w=>({id:w.id,status:w.status,summary:seasonalWindow(regionalSeasonalPackages,w.start+'T00:00:00Z',new Date(Date.parse(w.end+'T00:00:00Z')+86400000).toISOString())})):null;
  const packages=regionalSeasonalPackages.length?regionalSeasonalPackages:regionalSeasonalEvidence?[regionalSeasonalEvidence]:[];
  const enriched=result&&typeof result==='object'&&Array.isArray((result as ComparisonResult).strategies)
    ?attachStrategyRationales(result as ComparisonResult,request,{weather:evidence??historicalWeather,fieldEvidence,seasonalPackages:packages,ecostress:ecostressEvidence,grace:graceEvidence})
    :result;
  const strategyReviewQuestions=(enriched&&typeof enriched==='object'&&Array.isArray((enriched as ComparisonResult).strategies))
    ?(enriched as ComparisonResult).strategies.flatMap(s=>s.rationale?.localReviewQuestions??[])
    :[];
  const payload={comparisonBasis:{rotations:'Fixed templates; not satellite-generated',forcing:'POWER 2013–2024 paired four-year blocks',satelliteRole:'Historical exploration only; does not modify scoring',rationaleMethod:'strategy-rationale-v1'},ecostressEvidenceApplicability:ecostressEvidence?(ecoMatches(ecostressEvidence,request)?'matching-boundary':'different-boundary-not-field-evidence'):'unavailable',regionalSeasonalPackages,crossMonthWindows,graceEvidence,ecostressEvidence,regionalSeasonalEvidence,historicalWeather:historicalWeather?{...historicalWeather,weather:undefined,satellites:undefined}:null,title:'Rotation Atlas decision report',createdAt:new Date().toISOString(),request,result:enriched,history:historyReport(request.history,request.field,historicalWeather,fieldEvidence),evidence:evidence?{...evidence,weather:undefined,satellites:undefined}:null,fieldEvidence,fieldEvidenceApplicability:fieldEvidence?(matchesEvidenceField(request.field,fieldEvidence)?'matching-boundary':'different-boundary-not-field-evidence'):'unavailable',decisionStatus:request.decision.selection===null?'draft-unselected':request.decision.reviewed?'farmer-reviewed-not-validated':'draft-needs-review',reviewQuestions:[...new Set(['Are these planting windows suitable for the cultivar and farm?','Is available water capacity measured or assumed?','Are buyers and machinery confirmed?','Do local costs and nitrogen credits match these assumptions?',...strategyReviewQuestions])],notice:'Illustrative decision support, not a forecast or fertilizer prescription. AI-assisted software. POWER source responses and real Landsat/soil provenance are retained. Crop, yield, nutrient and economic outcomes are simplified scenarios; no probabilities of benefit are available. Per-strategy rationale separates observed context, agronomic mechanisms and unvalidated projections.'};
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})); const a=document.createElement('a');a.href=url;a.download='rotation-atlas-decision.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
