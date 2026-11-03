import type { EvidenceSeries, ScenarioRequest } from './types';
import { validateRequest } from './engine';
export const STORAGE_KEY='rotation-atlas-decision-v1';
export interface SavedDecision { schema:1; updatedAt:string; request:ScenarioRequest; pending:boolean; }
export function saveDecision(request:ScenarioRequest):SavedDecision { validateRequest(request); const value:SavedDecision={schema:1,updatedAt:new Date().toISOString(),request,pending:true}; localStorage.setItem(STORAGE_KEY,JSON.stringify(value)); return value; }
export function loadDecision():SavedDecision|null { try { const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'); if(value?.schema!==1)return null; validateRequest(value.request); return value; } catch { return null; } }
export async function syncDecision(value:SavedDecision):Promise<boolean> {
  // One opaque per-device key; no public listing or account-based sharing.
  try { let key=localStorage.getItem('rotation-atlas-device');if(!key){key=crypto.randomUUID();localStorage.setItem('rotation-atlas-device',key);}const response=await fetch('/api/atlas/decisions',{method:'POST',headers:{'Content-Type':'application/json','X-Atlas-Device':key},body:JSON.stringify(value)}); if(!response.ok)return false; const result=await response.json(); if(result.status!=='saved'||result.updatedAt!==value.updatedAt)return false;
    const latest=loadDecision(); if(latest?.updatedAt===value.updatedAt) localStorage.setItem(STORAGE_KEY,JSON.stringify({...value,pending:false})); return true;
  } catch { return false; }
}
export function downloadReport(request:ScenarioRequest,result:unknown,evidence:EvidenceSeries):void {
  const payload={title:'Rotation Atlas decision report',createdAt:new Date().toISOString(),request,result,evidence:{...evidence,weather:undefined},reviewQuestions:['Are these planting windows suitable for the cultivar and farm?','Is available water capacity measured or assumed?','Are buyers and machinery confirmed?','Do local costs and nitrogen credits match these assumptions?'],notice:'Illustrative decision support, not a forecast or fertilizer prescription. AI-assisted software; observations are unmodified NASA POWER responses.'};
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})); const a=document.createElement('a');a.href=url;a.download='rotation-atlas-decision.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
