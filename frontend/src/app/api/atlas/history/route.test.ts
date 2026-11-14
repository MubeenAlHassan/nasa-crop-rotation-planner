import {describe,it,expect} from 'vitest';
import {GET} from './route';
describe('Historical regional POWER API',()=>{
 it('serves the inspected 20-year archive with independent cache identity',async()=>{const r=await GET(new Request('http://localhost/api/atlas/history'));expect(r.status).toBe(200);const d=await r.json();expect(d.weather).toHaveLength(7305);expect(d.role).toContain('model forcing remains');expect(d.sources).toHaveLength(20);expect((await GET(new Request('http://localhost/api/atlas/history',{headers:{'if-none-match':r.headers.get('etag')!}}))).status).toBe(304);});
 it('never substitutes Iowa data for another region',async()=>{expect((await GET(new Request('http://localhost/api/atlas/history?region=other'))).status).toBe(404);});
});
