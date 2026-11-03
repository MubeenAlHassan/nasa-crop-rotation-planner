import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { compare, validateRequest } from '../../../../lib/atlas/engine';
import type { EvidenceSeries } from '../../../../lib/atlas/types';
export const runtime='nodejs';
let evidence:Promise<EvidenceSeries>|undefined;
export async function POST(request:Request) {
  if(Number(request.headers.get('content-length'))>32768) return Response.json({error:'Request exceeds 32 KiB.'},{status:413});
  let input:unknown;
  try {
    const raw=await request.text(); if(new TextEncoder().encode(raw).length>32768) return Response.json({error:'Request exceeds 32 KiB.'},{status:413});
    input=JSON.parse(raw);validateRequest(input);
  } catch(error) { return Response.json({error:error instanceof Error?error.message:'Invalid request.'},{status:422}); }
  try {
    evidence??=readFile(path.join(process.cwd(),'public/atlas/iowa.json'),'utf8').then(s=>JSON.parse(s) as EvidenceSeries).catch(error=>{evidence=undefined;throw error;});
    const result=compare(await evidence,input,false);
    return Response.json(result,{headers:{'Cache-Control':'no-store'}});
  } catch { return Response.json({error:'Evidence package unavailable. Retry or use your saved local package.'},{status:503}); }
}
