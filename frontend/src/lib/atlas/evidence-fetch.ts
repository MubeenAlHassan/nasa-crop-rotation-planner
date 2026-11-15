/** Cacheable scientific archives may take longer than a small API request. */
export const EVIDENCE_DOWNLOAD_TIMEOUT_MS = 120_000;

/** Bound the entire transfer, including JSON decoding; always respect unmount/retry. */
export async function readEvidenceJson(url:string, parent:AbortSignal):Promise<unknown> {
  return readEvidence(url,parent,response=>response.json());
}

/** Keep original bytes for checksum verification, bounding headers and body together. */
export async function readEvidenceText(url:string, parent:AbortSignal):Promise<string> {
  return readEvidence(url,parent,response=>response.text());
}

async function readEvidence<T>(url:string,parent:AbortSignal,read:(response:Response)=>Promise<T>):Promise<T> {
  parent.throwIfAborted();
  const timeout=new AbortController();
  const signal=AbortSignal.any([parent,timeout.signal]);
  const timer=setTimeout(()=>timeout.abort(new DOMException('Evidence download timed out. Please retry.','TimeoutError')),EVIDENCE_DOWNLOAD_TIMEOUT_MS);
  let onAbort:()=>void=()=>{};
  const aborted=new Promise<never>((_,reject)=>{
    onAbort=()=>reject(signal.reason);
    signal.addEventListener('abort',onAbort,{once:true});
    if(signal.aborted)onAbort();
  });
  try {
    return await Promise.race([
      (async()=>{
        const response=await fetch(url,{signal,cache:'no-store'});
        if(!response.ok)throw new Error(`Evidence unavailable (HTTP ${response.status}).`);
        const value=await read(response);
        signal.throwIfAborted();
        return value;
      })(),
      aborted,
    ]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort',onAbort);
  }
}
