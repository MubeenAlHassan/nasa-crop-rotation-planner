// @vitest-environment jsdom
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {DEFAULT_REQUEST} from './catalog';
import {loadDecision,saveDecision,STORAGE_KEY,syncDecision} from './storage';
beforeEach(()=>{localStorage.clear();vi.restoreAllMocks();});
describe('Device decision queue',()=>{
 it('persists and restores field constraints and scenario settings',()=>{const request=structuredClone(DEFAULT_REQUEST);request.rainfall=60;request.field.forageBuyer=true;saveDecision(request);expect(loadDecision()?.request).toEqual(request);});
 it('ignores corrupted stored decisions',()=>{localStorage.setItem(STORAGE_KEY,'{');expect(loadDecision()).toBeNull();localStorage.setItem(STORAGE_KEY,JSON.stringify({schema:1,request:{}}));expect(loadDecision()).toBeNull();});
 it('retains a pending edit when the service cannot be reached',async()=>{vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));const saved=saveDecision(DEFAULT_REQUEST);expect(await syncDecision(saved)).toBe(false);expect(loadDecision()?.pending).toBe(true);});
 it('clears pending only after the service saves the current saved scenario',async()=>{vi.stubGlobal('fetch',vi.fn().mockImplementation(async (_url,options)=>({ok:true,json:async()=>({status:'saved',updatedAt:JSON.parse(options.body).updatedAt})})));const saved=saveDecision(DEFAULT_REQUEST);expect(await syncDecision(saved)).toBe(true);expect(loadDecision()?.pending).toBe(false);});
});
