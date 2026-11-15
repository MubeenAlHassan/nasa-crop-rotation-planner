import {afterEach,describe,expect,it,vi} from 'vitest';
import {EVIDENCE_DOWNLOAD_TIMEOUT_MS,readEvidenceJson,readEvidenceText} from './evidence-fetch';

afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
describe('Bounded slow-network evidence downloads',()=>{
  it('bounds a stalled scientific text body without changing checksum bytes',async()=>{
    vi.useFakeTimers();
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,text:()=>new Promise(()=>{})}));
    const pending=readEvidenceText('/atlas/season.json',new AbortController().signal);
    const rejected=expect(pending).rejects.toMatchObject({name:'TimeoutError'});
    await vi.advanceTimersByTimeAsync(EVIDENCE_DOWNLOAD_TIMEOUT_MS);
    await rejected;expect(vi.getTimerCount()).toBe(0);
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,text:async()=>'{"data":1}\n'}));
    expect(await readEvidenceText('/atlas/season.json',new AbortController().signal)).toBe('{"data":1}\n');
  });
  it('allows a slow JSON body beyond the former 15-second cutoff',async()=>{
    vi.useFakeTimers();
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:()=>new Promise(resolve=>setTimeout(()=>resolve({observed:true}),90_000))}));
    const pending=readEvidenceJson('/atlas/test.json',new AbortController().signal);
    await vi.advanceTimersByTimeAsync(90_000);
    expect(await pending).toEqual({observed:true});
    expect(vi.getTimerCount()).toBe(0);
  });
  it('times out a stalled body and releases timers',async()=>{
    vi.useFakeTimers();
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:()=>new Promise(()=>{})}));
    const pending=readEvidenceJson('/atlas/test.json',new AbortController().signal);
    const rejected=expect(pending).rejects.toMatchObject({name:'TimeoutError'});
    await vi.advanceTimersByTimeAsync(EVIDENCE_DOWNLOAD_TIMEOUT_MS);
    await rejected;expect(vi.getTimerCount()).toBe(0);
  });
  it('cancels immediately on retry/unmount even when fetch ignores abort',async()=>{
    vi.useFakeTimers();
    vi.stubGlobal('fetch',vi.fn(()=>new Promise(()=>{})));
    const controller=new AbortController();
    const pending=readEvidenceJson('/atlas/test.json',controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({name:'AbortError'});
    expect(vi.getTimerCount()).toBe(0);
  });
});
