import type {GraceEvidence} from './grace';
import type {EcoEvidence} from './ecostress';
import type {NasaSeason} from './nasa-season';
import type { EvidenceSeries, ScenarioRequest } from './types';
import { DEFAULT_REQUEST } from './catalog';
import type { FieldEvidence } from './field-evidence';
import { validateRequest } from './engine';
import { buildReportPayload, downloadFormattedReport, type ExportFormat } from './export-report';
export const STORAGE_KEY='rotation-atlas-decision-v1';
// pending is retained for legacy schema compatibility; this demo never queues sync.
export interface SavedDecision { schema:1; updatedAt:string; request:ScenarioRequest; pending:boolean; }
export function saveDecision(request:ScenarioRequest):SavedDecision { validateRequest(request); const value:SavedDecision={schema:1,updatedAt:new Date().toISOString(),request,pending:false}; localStorage.setItem(STORAGE_KEY,JSON.stringify(value)); return value; }
export function loadDecision():SavedDecision|null { try { const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'); if(value?.schema!==1)return null; if(!value.request?.horizon&&value.request?.field){value.request={...structuredClone(DEFAULT_REQUEST),...value.request,field:{...structuredClone(DEFAULT_REQUEST.field),...value.request.field,boundaryConfirmed:null,baselineConfirmed:null},decision:{selection:null,notes:'Restored from Atlas v1; review new horizon and feasibility checks.',reviewed:false}};}if(value.request&&value.request.history===undefined)value.request.history=structuredClone(DEFAULT_REQUEST.history);if(value.request&&value.request.enterprise===undefined)value.request.enterprise=structuredClone(DEFAULT_REQUEST.enterprise);validateRequest(value.request); if(value.pending!==false){value.pending=false;try{localStorage.setItem(STORAGE_KEY,JSON.stringify(value));}catch{/* Readable drafts remain restorable when browser writes are blocked. */}} return value; } catch { return null; } }
export function downloadReport(request:ScenarioRequest,result:unknown,evidence:EvidenceSeries|null,fieldEvidence:FieldEvidence|null=null,historicalWeather:EvidenceSeries|null=evidence,regionalSeasonalEvidence:NasaSeason|null=null,ecostressEvidence:EcoEvidence|null=null,graceEvidence:GraceEvidence|null=null,regionalSeasonalPackages:NasaSeason[]=[],format:ExportFormat='json'):void {
  const payload=buildReportPayload(request,result,evidence,fieldEvidence,historicalWeather,regionalSeasonalEvidence,ecostressEvidence,graceEvidence,regionalSeasonalPackages);
  downloadFormattedReport(payload,format);
}
