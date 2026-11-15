// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import data from '../../../public/atlas/iowa.json';
import fieldData from '../../../public/atlas/field-evidence.json';
import { DEFAULT_REQUEST } from '@/lib/atlas/catalog';
import { saveDecision } from '@/lib/atlas/storage';
import type { EvidenceSeries, SensitivityResult } from '@/lib/atlas/types';
import Atlas from './atlas-client';
import { RainChart, SensitivityChart } from './charts';
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  localStorage.clear();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});
const click = async (text: string) => {
  const button = Array.from(host.querySelectorAll('button')).find(b => b.textContent?.includes(text));
  expect(button, text).toBeTruthy(); await act(async () => button!.click());
};
const residueInput = () => Array.from(host.querySelectorAll('label')).find(l => l.textContent?.includes('Retain crop residue or mulch'))!.querySelector<HTMLInputElement>('input')!;
describe('Workspace bootstrap and evidence retries', () => {
  it('renders a deterministic server shell without reading device storage', () => {
    const read = vi.spyOn(Storage.prototype, 'getItem');
    expect(renderToString(<Atlas />)).toContain('Restoring your workspace');
    expect(read).not.toHaveBeenCalled();
  });
  it('preserves edits when retrying evidence after restoring a saved decision', async () => {
    saveDecision({ ...DEFAULT_REQUEST, field: { ...DEFAULT_REQUEST.field, name: 'Saved farm' } });
    let weatherCalls=0;const fetcher = vi.fn().mockImplementation(async (url:string)=>{if(url.includes('power-history')||url.includes('landsat-seasons')||url.includes('nasa-context'))return {ok:false,status:404};if((url.includes('field-evidence')||url.includes('/api/atlas/evidence')))return {ok:true,json:async()=>fieldData};if(weatherCalls++===0)throw new Error('Download interrupted');return {ok:true,json:async()=>data};});
    vi.stubGlobal('fetch', fetcher);
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    await act(async () => root.render(<Atlas />));
    expect(host.textContent).toContain('Saved farm');
    expect(host.textContent).toContain('Download interrupted');
    await click('Farm assumptions');
    expect(residueInput().checked).toBe(true);
    await act(async () => residueInput().click());
    await click('Apply to all four rotations');
    await click('Retry evidence download');
    expect(host.querySelectorAll('.ra-stat')).toHaveLength(4);
    await click('Farm assumptions');
    expect(residueInput().checked).toBe(false);
    expect(host.textContent).toContain('Saved farm');
    expect(weatherCalls).toBe(2);expect(fetcher).toHaveBeenCalledTimes(6);
  });
  it('updates connectivity through a browser subscription', async () => {
    let online = true;
    vi.spyOn(window.navigator, 'onLine', 'get').mockImplementation(() => online);
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url:string)=>({ok:true,json:async()=>(url.includes('field-evidence')||url.includes('/api/atlas/evidence'))?fieldData:data})));
    await act(async () => root.render(<Atlas />));
    expect(host.querySelector('.ra-connection')?.textContent).toContain('Online');
    online = false;
    await act(async () => window.dispatchEvent(new Event('offline')));
    expect(host.querySelector('.ra-connection')?.textContent).toContain('Offline');
  });
  it('shows a failed field download on the overview and retries without losing farm inputs',async()=>{
    saveDecision({...DEFAULT_REQUEST,field:{...DEFAULT_REQUEST.field,name:'Retained farm'}});
    vi.spyOn(window.navigator,'onLine','get').mockReturnValue(false);
    let fieldCalls=0;
    vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
      if(url==='/atlas/iowa.json')return {ok:true,json:async()=>data};
      if(url==='/atlas/field-evidence.json'&&++fieldCalls>1)return {ok:true,json:async()=>fieldData};
      return {ok:false,status:503};
    }));
    await act(async()=>root.render(<Atlas/>));
    expect(host.querySelector('.ra-map')?.textContent).toContain('Field evidence unavailable');
    expect(host.querySelector('.ra-map')?.textContent).not.toContain('Field evidence is still loading');
    await click('Retry field evidence');
    expect(host.querySelector('.ra-map')?.textContent).toContain('Captured field evidence');
    expect(host.textContent).toContain('Retained farm');
    expect(fieldCalls).toBe(2);
  });
  it('restores old pending drafts and saves offline/reconnect without server requests', async () => {
    localStorage.setItem('rotation-atlas-decision-v1', JSON.stringify({schema:1, updatedAt:'2026-11-14T00:00:00Z', request:DEFAULT_REQUEST, pending:true}));
    let online=true;
    vi.spyOn(window.navigator,'onLine','get').mockImplementation(()=>online);
    const fetcher=vi.fn().mockResolvedValue({ok:false,status:404});
    vi.stubGlobal('fetch',fetcher);
    await act(async()=>root.render(<Atlas/>));
    expect(JSON.parse(localStorage.getItem('rotation-atlas-decision-v1')!).pending).toBe(false);
    await click('Save on this device');
    expect(host.textContent).toContain('Clearing browser storage can remove your draft');
    online=false;await act(async()=>window.dispatchEvent(new Event('offline')));
    await click('Save on this device');
    online=true;await act(async()=>window.dispatchEvent(new Event('online')));
    expect(fetcher.mock.calls.some(([url])=>String(url).includes('/api/atlas/decisions'))).toBe(false);
    expect(JSON.parse(localStorage.getItem('rotation-atlas-decision-v1')!).request).toEqual(DEFAULT_REQUEST);
  });
});
describe('Chart text alternatives', () => {
  it('provides monthly historical and scenario values in a semantic table', () => {
    host.innerHTML = renderToStaticMarkup(<RainChart data={data as EvidenceSeries} adjustment={60} />);
    const rows = host.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(12);
    const january = data.weather.filter(d => d.date.slice(5, 7) === '01').reduce((sum, d) => sum + (d.rain ?? 0), 0) / 12;
    expect(Number(rows[0].querySelectorAll('td')[1].textContent)).toBeCloseTo(january * .6, 0);
    expect(host.querySelector('.ra-chart-bar-pair .ra-pattern-hatch')).not.toBeNull();
    expect(host.textContent).toContain('Solid left bars');
  });
  it('visibly names preferred rotations and missing sensitivity results', () => {
    const points = [{ value: 40, preferred: 'cover' as const, margin: 123 }, { value: 50, preferred: null, margin: null }];
    const result: SensitivityResult = { reference: 'cover', tested: 2, favored: { baseline: 0, cover: 1, diverse: 0, forage: 0 }, ranges: { baseline: [0,0], cover: [0,0], diverse: [0,0], forage: [0,0] }, sweeps: { rainfall: points, price: [], soil: [] }, changes: [], nextObservation: '' };
    host.innerHTML = renderToStaticMarkup(<SensitivityChart result={result} />);
    const cells = host.querySelectorAll('.ra-sweep-track > div');
    expect(cells[0].textContent).toContain('Winter cover');
    expect(cells[1].textContent).toContain('Preference withheld');
    expect(host.querySelector('tbody')?.textContent).toContain('Not available');
  });
});
