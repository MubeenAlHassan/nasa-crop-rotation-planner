import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {GET,POST} from './route';
import {DEFAULT_REQUEST} from '../../../../lib/atlas/catalog';
let directory:string;
beforeEach(async()=>{directory=await mkdtemp(path.join(tmpdir(),'atlas-decisions-test-'));vi.stubEnv('ATLAS_DECISIONS_DIR',directory);});
afterEach(async()=>{vi.unstubAllEnvs();await rm(directory,{recursive:true,force:true});});
describe('Per-device decision synchronization',()=>{
 it('round-trips history and rejects unsupported confirmation without overwriting it',async()=>{
   const key=randomUUID(),request=structuredClone(DEFAULT_REQUEST);
   request.history.boundary=structuredClone(request.field.boundary);
   request.history.windows=[{id:'local',start:'2024-10-01',end:'2024-10-08',status:'farmer-confirmed',cover:'residue-present',note:'API test fixture only.',observationIds:[],updatedAt:'2026-11-09T00:00:00Z'}];
   const value={schema:1,updatedAt:'2026-11-09T00:00:00Z',request};
   const post=()=>POST(new Request('http://localhost/api/atlas/decisions',{method:'POST',headers:{'x-atlas-device':key},body:JSON.stringify(value)}));
   expect((await post()).status).toBe(200);
   const saved=structuredClone(request.history);
   request.history.windows[0].cover='unknown';expect((await post()).status).toBe(422);
   const read=await GET(new Request('http://localhost/api/atlas/decisions',{headers:{'x-atlas-device':key}}));
   expect((await read.json()).request.history).toEqual(saved);
 });
 it('persists a saved decision and isolates other device keys',async()=>{const key=randomUUID(),value={schema:1,updatedAt:'2026-11-03T00:00:00.000Z',request:DEFAULT_REQUEST};const response=await POST(new Request('http://localhost/api/atlas/decisions',{method:'POST',headers:{'x-atlas-device':key},body:JSON.stringify(value)}));expect(response.status).toBe(200);const read=await GET(new Request('http://localhost/api/atlas/decisions',{headers:{'x-atlas-device':key}}));expect((await read.json()).request).toEqual(DEFAULT_REQUEST);expect((await GET(new Request('http://localhost/api/atlas/decisions',{headers:{'x-atlas-device':randomUUID()}}))).status).toBe(404);});
 it('rejects missing and path-like capability keys',async()=>{for(const key of ['', '../../etc/passwd'])expect((await GET(new Request('http://localhost/api/atlas/decisions',{headers:{'x-atlas-device':key}}))).status).toBe(401);});
});
