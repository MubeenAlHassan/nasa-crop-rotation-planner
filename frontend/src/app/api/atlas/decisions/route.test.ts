import {describe,expect,it,vi} from 'vitest';
vi.mock('node:fs/promises',()=>({mkdir:vi.fn(),readFile:vi.fn(),rename:vi.fn(),writeFile:vi.fn()}));
import * as fs from 'node:fs/promises';
import {GET,POST} from './route';
describe('Local-only decision saving',()=>{
 it('explicitly disables reads and writes without accessing disk',async()=>{
  for(const handler of [GET,POST]){
   const response=handler();
   expect(response.status).toBe(501);
   expect(response.headers.get('Cache-Control')).toBe('no-store');
   expect(await response.json()).toMatchObject({status:'disabled',code:'SERVER_SYNC_DISABLED',storage:'device-only'});
  }
  for(const operation of Object.values(fs))expect(operation).not.toHaveBeenCalled();
 });
});
