import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseHistoricalWeather} from '../../../../lib/atlas/history-evidence';
export const runtime='nodejs';
/** Fixed regional historical archive. Never returns a field-specific weather measurement. */
export async function GET(request:Request) {
 if((new URL(request.url).searchParams.get('region')??'iowa-pilot')!=='iowa-pilot')return Response.json({status:'not-acquired'},{status:404});
 try{const raw=await readFile(path.join(process.cwd(),'public/atlas/power-history.json'),'utf8');const data=parseHistoricalWeather(JSON.parse(raw));const etag=`"${createHash('sha256').update(raw).digest('hex')}"`;if(request.headers.get('if-none-match')===etag)return new Response(null,{status:304,headers:{ETag:etag}});return Response.json(data,{headers:{ETag:etag,'Cache-Control':'public, max-age=0, must-revalidate'}});}catch{return Response.json({status:'unavailable',reason:'Extended historical context unavailable. Original model forcing is separate.'},{status:503});}
}
