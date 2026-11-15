// @vitest-environment jsdom
import {readFileSync} from 'node:fs';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import {DEFAULT_FIELD} from '@/lib/atlas/catalog';
import {parseFieldEvidence} from '@/lib/atlas/field-evidence';
import {FieldMap} from './field-map';

const evidence=parseFieldEvidence(JSON.parse(readFileSync('public/atlas/field-evidence.json','utf8')));
let host:HTMLDivElement;
let root:Root;

beforeEach(()=>{
  host=document.createElement('div');
  document.body.append(host);
  root=createRoot(host);
  // @ts-expect-error test environment flag for React 19 act()
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;
});
afterEach(async()=>{
  await act(async()=>root.unmount());
  host.remove();
});

describe('Field map evidence layers',()=>{
  it('auto-selects Landsat NDVI when the captured package matches the field',async()=>{
    await act(async()=>{root.render(<FieldMap field={DEFAULT_FIELD} evidence={evidence} onBoundary={()=>{}} initialLayer="landsat"/>);});
    const select=host.querySelector<HTMLSelectElement>('select[aria-label="Map evidence layer"]');
    expect(select?.value).toBe('landsat');
    expect(host.textContent).toContain('Captured field evidence');
    expect(host.textContent).toMatch(/Light to dark green: NDVI/);
    expect(host.querySelectorAll('svg path').length).toBeGreaterThan(20);
    expect(host.textContent).not.toMatch(/No aerial basemap underneath/);
  });

  it('withholds Landsat when the boundary no longer matches the package',async()=>{
    const field={...DEFAULT_FIELD,boundary:[[-93.654,42.022],[-93.646,42.022],[-93.646,42.027],[-93.654,42.027],[-93.654,42.022]] as [number,number][]};
    await act(async()=>{root.render(<FieldMap field={field} evidence={evidence} onBoundary={()=>{}} initialLayer="landsat"/>);});
    const select=host.querySelector<HTMLSelectElement>('select[aria-label="Map evidence layer"]');
    expect(select?.value).toBe('field');
    expect(host.textContent).toMatch(/Landsat and soil overlays withheld/);
  });

  it('keeps a manual outline choice after evidence is available',async()=>{
    await act(async()=>{root.render(<FieldMap field={DEFAULT_FIELD} evidence={evidence} onBoundary={()=>{}} initialLayer="landsat"/>);});
    const select=host.querySelector<HTMLSelectElement>('select[aria-label="Map evidence layer"]')!;
    expect(select.value).toBe('landsat');
    await act(async()=>{
      select.value='field';
      select.dispatchEvent(new Event('change',{bubbles:true}));
    });
    expect(select.value).toBe('field');
    expect(host.textContent).toMatch(/No aerial basemap underneath/);
  });
});
