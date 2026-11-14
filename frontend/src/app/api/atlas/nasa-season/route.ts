import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseSeason,parseSeasonIndex} from '../../../../lib/atlas/nasa-season';
export const runtime='nodejs';
export async function GET(request:Request){
 try{const index=parseSeasonIndex(JSON.parse(await readFile(path.join(process.cwd(),'public/atlas/nasa-season-index.json'),'utf8')));const month=new URL(request.url).searchParams.get('month');if(!month)return Response.json({schemaVersion:'nasa-season-index-v1',months:index});const entry=index.find(e=>e.month===month);if(!entry)return Response.json({status:'not-acquired'},{status:404});const raw=await readFile(path.join(process.cwd(),'public',entry.path),'utf8');if(createHash('sha256').update(raw).digest('hex')!==entry.sha256)throw Error('Checksum mismatch');parseSeason(JSON.parse(raw));const etag=`"${entry.sha256}"`;return request.headers.get('if-none-match')===etag?new Response(null,{status:304,headers:{ETag:etag}}):new Response(raw,{headers:{'Content-Type':'application/json',ETag:etag,'Cache-Control':'no-cache'}});}catch{return Response.json({status:'unavailable',reason:'Seasonal evidence withheld; original forcing is unchanged.'},{status:503});}
}
