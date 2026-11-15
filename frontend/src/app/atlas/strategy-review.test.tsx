// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import weather from '../../../public/atlas/iowa.json';
import field from '../../../public/atlas/field-evidence.json';
import Atlas from './atlas-client';

let host:HTMLDivElement,root:Root;
beforeEach(()=>{
  localStorage.clear();host=document.createElement('div');document.body.append(host);root=createRoot(host);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  vi.spyOn(window.navigator,'onLine','get').mockReturnValue(false);
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>url==='/atlas/iowa.json'?{ok:true,json:async()=>weather}:url==='/atlas/field-evidence.json'?{ok:true,json:async()=>field}:{ok:false,status:404}));
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
const click=async(text:string)=>{
  const b=Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes(text));
  expect(b,text).toBeTruthy();await act(async()=>b!.click());
};
const select=async(label:string,value:string)=>{
  const input=Array.from(host.querySelectorAll('label')).find(l=>l.textContent?.startsWith(label))!.querySelector('select')!;
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('change',{bubbles:true}));});
};

describe('Rotation review guidance',()=>{
  it('explains unknown farm checks with an action and keeps model limitations separate',async()=>{
    await act(async()=>root.render(<Atlas/>));await click('Compare rotations');
    const review=host.querySelector('.ra-feasibility-review')!;
    expect(review.textContent).toContain('Farm details need your review');
    expect(review.querySelectorAll('li')).toHaveLength(4);
    expect(review.textContent).not.toContain('unknown:');
    expect(review.textContent).toContain('Keep Unknown when you cannot confirm');
    const notes=host.querySelector('.ra-model-notes')!;
    expect(notes.textContent).toContain('Unvalidated water/yield/economic scenario');
    expect(notes.textContent).toContain('Soil capacity is a demonstration assumption');
    expect(notes.classList.contains('ra-issues')).toBe(false);
    await click('Review farm inputs');
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    for(const label of ['Boundary is the intended cropped field','I confirm this baseline and management history','Labor available for these operations','Cover sowing and termination equipment']){
      const input=Array.from(host.querySelectorAll('label')).find(l=>l.textContent?.startsWith(label))!.querySelector('select')!;
      expect(input.value).toBe('unknown');
      await select(label,'true');
    }
    await click('Apply to all four rotations');
    expect(host.querySelector('.ra-feasibility-review')!.textContent).toContain('Farm checks complete');
    expect(host.querySelector('.ra-feasibility-review')!.querySelectorAll('li')).toHaveLength(0);
    expect(host.querySelector('.ra-strategy.ra-selected .ra-match')!.textContent).toContain('Preference score');
    expect(host.querySelector('.ra-model-notes')!.textContent).toContain('Unvalidated');
    expect(host.querySelector('.ra-model-notes')!.textContent).toContain('demonstration assumption');
    // Confirming this option must not silently resolve other rotations' constraints.
    expect(host.querySelector('.ra-current-choice')!.textContent).toContain('Preference withheld');
    await click('Review farm inputs');await select('Cover sowing and termination equipment','false');await click('Apply to all four rotations');
    expect(host.querySelector('.ra-feasibility-review')!.textContent).toContain('Conditions not met');
    expect(host.querySelector('.ra-strategy.ra-selected .ra-match')!.textContent).toContain('Review requirements to rank');
  });

  it('provides access to soil inputs without removing or changing the demonstration assumption',async()=>{
    await act(async()=>root.render(<Atlas/>));await click('Compare rotations');
    await click('Review soil and starting state');
    const input=Array.from(host.querySelectorAll('label')).find(l=>l.textContent?.startsWith('Available soil water capacity'))!.querySelector('input')!;
    expect(input.value).toBe('160');
    await click('Apply to all four rotations');
    expect(host.querySelector('.ra-model-notes')!.textContent).toContain('demo soil-water capacity of 160 mm/m');
  });
});
