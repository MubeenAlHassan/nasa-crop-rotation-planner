import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseFieldEvidence} from '../../../../lib/atlas/field-evidence';
import {mergeSeasons,withNasaContext} from '../../../../lib/atlas/field-evidence';
export const runtime='nodejs';
/** Read-only captured evidence; no live extraction is implied by this endpoint. */
export async function GET(request:Request){
  const field=new URL(request.url).searchParams.get('field')??'iowa-demo';
  if(field!=='iowa-demo')return Response.json({status:'not-acquired',reason:'No captured evidence exists for this field. Acquire and QA a new package before using field summaries.'},{status:404});
  try{const raw=await readFile(path.join(process.cwd(),'public/atlas/field-evidence.json'),'utf8');let data=parseFieldEvidence(JSON.parse(raw));try{data=mergeSeasons(data,JSON.parse(await readFile(path.join(process.cwd(),'public/atlas/landsat-seasons.json'),'utf8')));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}try{data=withNasaContext(data,JSON.parse(await readFile(path.join(process.cwd(),'public/atlas/nasa-context.json'),'utf8')));}catch{/* Optional context is withheld if missing or invalid. */}const etag=`"${createHash('sha256').update(JSON.stringify(data)).digest('hex')}"`;if(request.headers.get('if-none-match')===etag)return new Response(null,{status:304,headers:{ETag:etag}});return Response.json(data,{headers:{ETag:etag,'Cache-Control':'public, max-age=0, must-revalidate'}});}catch{return Response.json({status:'unavailable',reason:'Captured field evidence is unavailable. Weather scenarios can continue independently.'},{status:503});}
}
