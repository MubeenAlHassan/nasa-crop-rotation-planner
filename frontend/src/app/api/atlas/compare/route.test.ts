import {describe,it,expect} from 'vitest';
import {POST} from './route';
import {DEFAULT_REQUEST} from '../../../../lib/atlas/catalog';
describe('Atlas comparison endpoint',()=>{
  it('returns the same 12-year comparisons as the browser engine without daily bulk',async()=>{const response=await POST(new Request('http://localhost/api/atlas/compare',{method:'POST',body:JSON.stringify(DEFAULT_REQUEST)}));expect(response.status).toBe(200);const result=await response.json();expect(result.strategies).toHaveLength(4);expect(result.strategies[0].delta.margin).toBe(0);expect(result.strategies[0].daily).toEqual([]);expect(result.evidenceId).toBe('iowa-power-2013-2024');});
  it('rejects malformed and out-of-region input',async()=>{for(const body of ['{',JSON.stringify({...DEFAULT_REQUEST,field:{...DEFAULT_REQUEST.field,latitude:0}})]){const response=await POST(new Request('http://localhost/api/atlas/compare',{method:'POST',body}));expect(response.status).toBe(422);}});
  it('rejects oversized payloads',async()=>{const response=await POST(new Request('http://localhost/api/atlas/compare',{method:'POST',body:' '.repeat(33000)}));expect(response.status).toBe(413);});
  it('returns explicit insufficient information for unknown soil',async()=>{const response=await POST(new Request('http://localhost/api/atlas/compare',{method:'POST',body:JSON.stringify({...DEFAULT_REQUEST,field:{...DEFAULT_REQUEST.field,soilCapacity:null}})}));expect((await response.json()).status).toBe('insufficient-information');});
});
