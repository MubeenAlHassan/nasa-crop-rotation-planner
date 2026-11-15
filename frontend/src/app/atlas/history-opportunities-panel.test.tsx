// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import data from '../../../public/atlas/iowa.json';
import fieldData from '../../../public/atlas/field-evidence.json';
import {DEFAULT_REQUEST} from '@/lib/atlas/catalog';
import {saveDecision,loadDecision} from '@/lib/atlas/storage';
import Atlas from './atlas-client';

let host:HTMLDivElement,root:Root;
beforeEach(()=>{
  localStorage.clear();host=document.createElement('div');document.body.append(host);root=createRoot(host);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  vi.spyOn(window.navigator,'onLine','get').mockReturnValue(false);
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
    if(url==='/atlas/iowa.json')return {ok:true,json:async()=>data};
    if(url==='/atlas/field-evidence.json')return {ok:true,json:async()=>({...fieldData,observations:[
      {...fieldData.observations[0],id:'fixture-a',observedAt:'2024-03-01T16:00:00Z',status:'available',ndvi:.2,bsi:.1,validFraction:.9,mapAsset:undefined},
      {...fieldData.observations[0],id:'fixture-b',observedAt:'2024-03-09T16:00:00Z',status:'available',ndvi:.2,bsi:.1,validFraction:.9,mapAsset:undefined},
    ]})};
    return {ok:false,status:404};
  }));
  HTMLElement.prototype.scrollIntoView=vi.fn();
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
const click=async(text:string,scope:ParentNode=host)=>{
  const button=Array.from(scope.querySelectorAll('button')).find(b=>b.textContent?.includes(text));
  expect(button,text).toBeTruthy();await act(async()=>button!.click());
};
const control=async(label:string,value:string)=>{
  const element=Array.from(host.querySelectorAll('label')).find(l=>l.textContent?.startsWith(label))!.querySelector('input,select,textarea')!;
  const proto=element.tagName==='SELECT'?HTMLSelectElement.prototype:element.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
  await act(async()=>{Object.getOwnPropertyDescriptor(proto,'value')!.set!.call(element,value);element.dispatchEvent(new Event(element.tagName==='SELECT'?'change':'input',{bubbles:true}));});
};

describe('Observation to farmer review to comparison workflow',()=>{
  it('requires local confirmation, inspects without choosing, corrects and restores the draft offline',async()=>{
    const request=structuredClone(DEFAULT_REQUEST);
    Object.assign(request.field,{boundaryConfirmed:true,baselineConfirmed:true,laborAvailable:true,coverEquipment:true,smallGrainBuyer:true,smallGrainEquipment:true,smallGrainSuitable:true,forageSuitable:true,forageBuyer:true,forageEquipment:true,budget:4000});
    saveDecision(request);
    await act(async()=>root.render(<Atlas/>));
    await click('Field history & windows');
    await click('Review this uncertain interval');
    await control('Window evidence status','farmer-confirmed');
    await control('Ground condition','bare-soil');
    // Candidate prompts never masquerade as a local observation note.
    await act(async()=>host.querySelector('#history-window-form form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    expect(host.textContent).toContain('Confirmation needs an observed cover condition');
    await control('Local observation / uncertainty note','Synthetic browser fixture: dated local scouting.');
    await click('Save historical window');
    const panel=()=>host.querySelector('.ra-window-connections')!;
    expect(panel().textContent).toContain('review pair linked');
    expect(panel().textContent).toContain('90% valid field area');
    expect(panel().textContent).toContain('Additional scheduled cover in 2/4 seasonal windows');
    await click('Inspect Keep the soil covered',panel());
    expect(host.querySelector('.ra-strategy.ra-selected h3')!.textContent).toBe('Winter cover');
    const selection=Array.from(host.querySelectorAll('label')).find(l=>l.textContent?.startsWith('Farmer’s selection'))!.querySelector('select')!;
    expect(selection.value).toBe('');
    expect(panel().textContent).toContain('whole four-year outcomes');
    await click('Review field history and ground conditions',panel());
    await click('Correct window');
    await control('Ground condition','residue-present');
    await control('Local observation / uncertainty note','Synthetic correction: residue present.');
    await click('Save historical window');
    expect(panel().querySelector('table')).toBeNull();
    expect(panel().textContent).toContain('Other ground cover reported');
    await click('Save on this device');
    expect(loadDecision()!.request.history.windows[0].cover).toBe('residue-present');
    expect(loadDecision()!.request.decision.selection).toBeNull();
    await act(async()=>root.unmount());root=createRoot(host);
    await act(async()=>root.render(<Atlas/>));
    await click('Compare rotations');
    expect(panel().textContent).toContain('Synthetic correction: residue present.');
    expect(panel().querySelector('table')).toBeNull();
  });
});
