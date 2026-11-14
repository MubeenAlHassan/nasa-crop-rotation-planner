import {it,expect,vi,afterEach} from 'vitest';
const failure=vi.hoisted(()=>({mode:''}));
vi.mock('node:fs/promises',async importOriginal=>{
 const actual=await importOriginal<typeof import('node:fs/promises')>();
 return {...actual,readFile:async(...args:Parameters<typeof actual.readFile>)=>{
  if(String(args[0]).endsWith('/nasa-season/2024-06.json')){
   if(failure.mode==='missing')throw Object.assign(new Error('Test file missing'),{code:'ENOENT'});
   if(failure.mode==='corrupt')return String(await actual.readFile(...args))+' ';
  }
  return actual.readFile(...args);
 }};
});
afterEach(()=>{failure.mode='';});
import {GET} from './route';
it('serves only acquired months with provenance and conditional replay',async()=>{const index=await(await GET(new Request('http://localhost/api/atlas/nasa-season'))).json();expect(index.months.some((m:{month:string})=>m.month==='2024-06')).toBe(true);const r=await GET(new Request('http://localhost/api/atlas/nasa-season?month=2024-06'));expect(r.status).toBe(200);const data=await r.json();expect(data.sources[0].sha256).toMatch(/^[a-f0-9]{64}$/);const cached=await GET(new Request('http://localhost/api/atlas/nasa-season?month=2024-06',{headers:{'If-None-Match':r.headers.get('ETag')!}}));expect(cached.status).toBe(304);expect((await GET(new Request('http://localhost/api/atlas/nasa-season?month=../../.env'))).status).toBe(404);});
it.each(['missing','corrupt'])('withholds a %s monthly file instead of returning numerical evidence',async mode=>{
 failure.mode=mode;
 const response=await GET(new Request('http://localhost/api/atlas/nasa-season?month=2024-06'));
 expect(response.status).toBe(503);
 expect(await response.json()).toEqual({status:'unavailable',reason:'Seasonal evidence withheld; original forcing is unchanged.'});
});
it('serves every published month with its indexed checksum',async()=>{
 const index=await(await GET(new Request('http://localhost/api/atlas/nasa-season'))).json();
 for(const month of index.months){
  const response=await GET(new Request('http://localhost/api/atlas/nasa-season?month='+month.month));
  expect(response.status).toBe(200);expect(response.headers.get('etag')).toBe('"'+month.sha256+'"');
  expect((await response.json()).month).toBe(month.month);
 }
},30_000);
