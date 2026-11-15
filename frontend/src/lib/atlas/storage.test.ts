// @vitest-environment jsdom
import {parseEco} from './ecostress';
import {parseSeason} from './nasa-season';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {DEFAULT_REQUEST} from './catalog';
import {downloadReport,loadDecision,saveDecision,STORAGE_KEY} from './storage';
beforeEach(()=>{localStorage.clear();vi.restoreAllMocks();});
afterEach(()=>{vi.unstubAllGlobals();});
describe('Device-local decisions',()=>{
 it('exports retained historical records when weather and modeled results are unavailable',async()=>{
   // Load Node's fixture reader directly; jsdom's Vite transform stubs node:fs.
   const {readFileSync}=await vi.importActual<typeof import('node:fs')>('node:fs');
   const request=structuredClone(DEFAULT_REQUEST);
   request.history.boundary=structuredClone(request.field.boundary);
   request.history.windows=[{id:'missing-weather',start:'2024-04-01',end:'2024-04-02',status:'uncertain',cover:'unknown',note:'Test fixture: no observations claimed.',observationIds:[],updatedAt:'2026-11-09T00:00:00Z'}];
   let captured:Blob|undefined;
   vi.stubGlobal('URL',{createObjectURL:(blob:Blob)=>{captured=blob;return 'blob:test';},revokeObjectURL:vi.fn()});
   vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
   const season=parseSeason(JSON.parse(readFileSync('public/atlas/nasa-season/2024-06.json','utf8')));
   const eco=parseEco(JSON.parse(readFileSync('public/atlas/ecostress/pilot.json','utf8')));
   eco.field.geometry.coordinates[0][0][0]+=0.001;
   downloadReport(request,null,null,null,null,season,eco);
   const text=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsText(captured!);});
   const payload=JSON.parse(text);
   expect(payload.ecostressEvidenceApplicability).toBe('different-boundary-not-field-evidence');
   expect(payload.ecostressEvidence.records).toEqual(eco.records);
   expect(payload.comparisonBasis.rotations).toContain('not satellite-generated');
   expect(payload.regionalSeasonalEvidence.sources).toEqual(season.sources);
   expect(payload.regionalSeasonalEvidence.imerg).toEqual(season.imerg);
   expect(payload.result).toBeNull();expect(payload.evidence).toBeNull();
   expect(payload.history.windows[0].exposure.rainTotalMm).toBeNull();
   expect(payload.history.windows[0].exposure.rainMissingDays).toBe(2);
   expect(payload.history.windows[0].reviewFlags.join()).toContain('boundary is not farmer-confirmed');
   expect(payload.request.history.windows).toEqual(request.history.windows);
 });
 it('persists and restores field constraints and scenario settings',()=>{const request=structuredClone(DEFAULT_REQUEST);request.rainfall=60;request.field.forageBuyer=true;saveDecision(request);expect(loadDecision()?.request).toEqual(request);});
 it('migrates legacy drafts without inventing farmer confirmation',()=>{const old={...DEFAULT_REQUEST,field:{...DEFAULT_REQUEST.field,name:'Legacy farm'}} as Record<string,unknown>;delete old.horizon;delete old.initialState;delete old.calendar;delete old.decision;localStorage.setItem(STORAGE_KEY,JSON.stringify({schema:1,updatedAt:'2026-01-01',request:old,pending:true}));const saved=loadDecision();expect(saved?.request.field.name).toBe('Legacy farm');expect(saved?.request.field.baselineConfirmed).toBeNull();expect(saved?.request.horizon.years).toBe(4);expect(saved?.request.decision.selection).toBeNull();});
 it('adds empty history to existing four-year drafts without discarding inputs',()=>{const r=structuredClone(DEFAULT_REQUEST) as Partial<typeof DEFAULT_REQUEST>;delete r.history;r.field!.name='My saved field';localStorage.setItem(STORAGE_KEY,JSON.stringify({schema:1,request:r,pending:true,updatedAt:'2026-11-07'}));const loaded=loadDecision();expect(loaded?.request.field.name).toBe('My saved field');expect(loaded?.request.history.windows).toEqual([]);expect(loaded?.request.history.boundary).toBeNull();});
 it('adds default enterprise assumptions without inventing farmer review',()=>{const r=structuredClone(DEFAULT_REQUEST) as Partial<typeof DEFAULT_REQUEST>;delete r.enterprise;r.field!.name='Budget field';localStorage.setItem(STORAGE_KEY,JSON.stringify({schema:1,request:r,pending:true,updatedAt:'2026-11-14'}));const loaded=loadDecision();expect(loaded?.request.field.name).toBe('Budget field');expect(loaded?.request.enterprise.schemaVersion).toBe('enterprise-inputs-v1');expect(loaded?.request.enterprise.reviewed).toBe(false);expect(loaded?.request.enterprise.source).toBe('catalog-default');expect(loaded?.request.enterprise.crops).toEqual({});});
 it('ignores corrupted stored decisions',()=>{localStorage.setItem(STORAGE_KEY,'{');expect(loadDecision()).toBeNull();localStorage.setItem(STORAGE_KEY,JSON.stringify({schema:1,request:{}}));expect(loadDecision()).toBeNull();});
 it('saves locally without network requests or a sync queue',()=>{const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);const saved=saveDecision(DEFAULT_REQUEST);expect(saved.pending).toBe(false);expect(loadDecision()?.request).toEqual(DEFAULT_REQUEST);expect(fetcher).not.toHaveBeenCalled();});
 it('migrates old pending drafts without losing their content or timestamp',()=>{const updatedAt='2026-11-14T00:00:00Z';localStorage.setItem(STORAGE_KEY,JSON.stringify({schema:1,updatedAt,request:DEFAULT_REQUEST,pending:true}));const loaded=loadDecision();expect(loaded?.request).toEqual(DEFAULT_REQUEST);expect(loaded?.updatedAt).toBe(updatedAt);expect(loaded?.pending).toBe(false);expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).pending).toBe(false);});
 it('restores a readable legacy draft even if migration cannot be written',()=>{localStorage.setItem(STORAGE_KEY,JSON.stringify({schema:1,updatedAt:'2026-11-14',request:DEFAULT_REQUEST,pending:true}));vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('Storage full');});expect(loadDecision()?.request).toEqual(DEFAULT_REQUEST);expect(loadDecision()?.pending).toBe(false);});
});
