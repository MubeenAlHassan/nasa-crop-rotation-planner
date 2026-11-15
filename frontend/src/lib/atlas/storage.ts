import type {GraceEvidence} from './grace';
import type {EcoEvidence} from './ecostress';
import type {NasaSeason} from './nasa-season';
import type { EvidenceSeries, ScenarioRequest } from './types';
import { DEFAULT_REQUEST } from './catalog';
import type { FieldEvidence } from './field-evidence';
import { validateRequest } from './engine';
import { buildReportPayload, downloadFormattedReport, type ExportFormat } from './export-report';
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
export function downloadReport(request:ScenarioRequest,result:unknown,evidence:EvidenceSeries|null,fieldEvidence:FieldEvidence|null=null,historicalWeather:EvidenceSeries|null=evidence,regionalSeasonalEvidence:NasaSeason|null=null,ecostressEvidence:EcoEvidence|null=null,graceEvidence:GraceEvidence|null=null,regionalSeasonalPackages:NasaSeason[]=[],format:ExportFormat='json'):void {
  const payload=buildReportPayload(request,result,evidence,fieldEvidence,historicalWeather,regionalSeasonalEvidence,ecostressEvidence,graceEvidence,regionalSeasonalPackages);
  downloadFormattedReport(payload,format);
}
