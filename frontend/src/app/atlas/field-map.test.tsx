// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {DEFAULT_FIELD} from '@/lib/atlas/catalog';
import {parseFieldEvidence} from '@/lib/atlas/field-evidence';
import {FieldMap} from './field-map';

// Load Node's fixture reader directly; jsdom's Vite transform stubs node:fs.
const {readFileSync}=await vi.importActual<typeof import('node:fs')>('node:fs');
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

  it('draws and closes a new boundary, clears points, and cancels drawing',async()=>{
    const onBoundary=vi.fn();
    await act(async()=>root.render(<FieldMap field={DEFAULT_FIELD} evidence={evidence} onBoundary={onBoundary}/>));
    const button=(text:string)=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes(text))!;
    await act(async()=>button('Draw field').click());
    expect(button('Cancel drawing').getAttribute('aria-pressed')).toBe('true');
    const svg=host.querySelector<SVGSVGElement>('svg[role="img"]')!;
    vi.spyOn(svg,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:800,height:460} as DOMRect);
    const place=async(x:number,y:number)=>act(async()=>{svg.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:x,clientY:y}));});
    await place(300,150);await place(500,150);
    expect((button('Use boundary') as HTMLButtonElement).disabled).toBe(true);
    await act(async()=>button('Clear').click());
    expect(host.textContent).toContain('0 placed');
    await place(300,150);await place(500,150);await place(400,300);
    await act(async()=>button('Use boundary').click());
    const ring=onBoundary.mock.calls[0][0];
    expect(ring).toHaveLength(4);expect(ring[0]).toEqual(ring[3]);
    expect(ring.flat().every(Number.isFinite)).toBe(true);
    expect(host.querySelector('.ra-draw-actions')).toBeNull();
    await act(async()=>button('Draw field').click());
    await act(async()=>button('Cancel drawing').click());
    expect(host.querySelector('.ra-draw-actions')).toBeNull();
    expect(onBoundary).toHaveBeenCalledTimes(1);
  });

  it('distinguishes failed downloads from a still-loading field',async()=>{
    await act(async()=>root.render(<FieldMap field={DEFAULT_FIELD} evidence={null} evidenceError="Network unavailable" onBoundary={()=>{}}/>));
    expect(host.textContent).toContain('Field evidence unavailable');
    expect(host.textContent).not.toContain('Field evidence is still loading');
    expect(host.querySelector('option[value="landsat"]')?.textContent).toContain('unavailable');
  });
});
