import {it,expect} from 'vitest';
import {GET} from './route';
it('serves verified acquired regional evidence and conditional replay only',async()=>{const r=await GET(new Request('http://localhost/api/atlas/grace'));expect(r.status).toBe(200);const d=await r.json();expect(d.records).toHaveLength(240);expect(d.source.sha256).toMatch(/^[a-f0-9]{64}$/);expect((await GET(new Request('http://localhost/api/atlas/grace',{headers:{'If-None-Match':r.headers.get('ETag')!}}))).status).toBe(304);expect((await GET(new Request('http://localhost/api/atlas/grace?field=other'))).status).toBe(404);});
