// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {DEFAULT_REQUEST} from '@/lib/atlas/catalog';
import type {NasaSeason} from '@/lib/atlas/nasa-season';
import {NasaSeasonPanel} from './nasa-season-panel';

const index=JSON.parse(readFileSync('public/atlas/nasa-season-index.json','utf8'));
const archive=(month:string)=>readFileSync(`public/atlas/nasa-season/${month}.json`,'utf8');
const request={...DEFAULT_REQUEST,history:{...DEFAULT_REQUEST.history,boundary:DEFAULT_REQUEST.field.boundary,windows:[{id:'test-window',start:'2024-05-01',end:'2024-06-30',status:'uncertain' as const,cover:'unknown' as const,note:'Test fixture only',observationIds:[],updatedAt:'2026-11-15T00:00:00Z'}]}};
let host:HTMLDivElement,root:Root;
const onLoad=vi.fn();
const cache={match:vi.fn(),delete:vi.fn(),keys:vi.fn().mockResolvedValue([])};
beforeEach(()=>{
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('crypto',webcrypto);
 vi.stubGlobal('caches',{open:vi.fn().mockResolvedValue(cache)});
 cache.match.mockReset().mockResolvedValue(undefined);cache.delete.mockReset().mockResolvedValue(true);onLoad.mockReset();
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
const click=async(text:string)=>{const button=Array.from(host.querySelectorAll('button')).find(b=>b.textContent===text);expect(button).toBeTruthy();await act(async()=>button!.click());};
const until=async(test:()=>boolean)=>{for(let i=0;i<200;i++){if(test())return;await act(async()=>{await new Promise(r=>setTimeout(r,10));});}throw Error('Condition not reached: '+host.querySelector('.ra-season-status')?.textContent);};
const render=async()=>{await act(async()=>root.render(<NasaSeasonPanel request={request} weather={null} onLoad={onLoad}/>));await until(()=>host.querySelectorAll('option').length>0);};

it('publishes verified partial coverage while the next month waits; cancellation preserves it and retry recovers',async()=>{
 let stalled=true;
 const fetcher=vi.fn(async(url:string)=>{
  if(url.endsWith('index.json'))return {ok:true,json:async()=>index};
  if(url.includes('2024-06')&&stalled)return new Promise<Response>(()=>{});
  return {ok:true,text:async()=>archive(url.includes('2024-05')?'2024-05':'2024-06')};
 });vi.stubGlobal('fetch',fetcher);
 await render();await click('Load available months for this window');
 await until(()=>host.querySelector('.ra-season-status')!.textContent!.includes('2/2: 2024-06'));
 expect(onLoad.mock.calls.at(-1)![1].map((p:NasaSeason)=>p.month)).toEqual(['2024-05']);
 expect(host.textContent).toContain('IMERG complete total Withheld');
 await click('Cancel seasonal download');
 expect(host.querySelector('select')!.disabled).toBe(false);
 expect(host.querySelector('.ra-season-status')!.textContent).toContain('canceled');
 expect(onLoad.mock.calls.at(-1)![1]).toHaveLength(1);
 stalled=false;await click('Load available months for this window');
 await until(()=>host.querySelector('.ra-season-status')!.textContent!.startsWith('Verified seasonal evidence loaded'));
 expect(onLoad.mock.calls.at(-1)![1].map((p:NasaSeason)=>p.month)).toEqual(['2024-05','2024-06']);
 expect(host.textContent).toContain('1464 / 1464 / 1464 hours');
},15_000);

it('removes a corrupted saved month offline, keeps valid coverage and withholds the complete total',async()=>{
 cache.match.mockImplementation(async(path:string)=>({text:async()=>archive(path.includes('2024-05')?'2024-05':'2024-06')+(path.includes('2024-05')?' ':'')}));
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>{if(url.endsWith('index.json'))return {ok:true,json:async()=>index};throw Error('Offline');}));
 await render();await click('Load available months for this window');
 await until(()=>host.querySelector('.ra-season-status')!.textContent!.startsWith('Some monthly packages unavailable'));
 expect(cache.delete).toHaveBeenCalledWith('/atlas/nasa-season/2024-05.json');
 expect(onLoad.mock.calls.at(-1)![1].map((p:NasaSeason)=>p.month)).toEqual(['2024-06']);
 expect(host.textContent).toContain('1464 / 720 / 720 hours');
 expect(host.textContent).toContain('IMERG complete total Withheld');
 expect(host.querySelector('select')!.disabled).toBe(false);
},15_000);
