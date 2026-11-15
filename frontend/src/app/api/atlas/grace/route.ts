import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseGrace,parseGraceIndex} from '../../../../lib/atlas/grace';
export const runtime='nodejs';
export async function GET(request:Request){
 if((new URL(request.url).searchParams.get('field')??'iowa-demo')!=='iowa-demo')return Response.json({status:'not-acquired'},{status:404});
 try{const index=parseGraceIndex(JSON.parse(await readFile(path.join(process.cwd(),'public/atlas/grace-index.json'),'utf8')));const raw=await readFile(path.join(process.cwd(),'public',index.path),'utf8');if(createHash('sha256').update(raw).digest('hex')!==index.sha256)throw Error('Checksum mismatch');parseGrace(JSON.parse(raw));const etag=`"${index.sha256}"`;return request.headers.get('if-none-match')===etag?new Response(null,{status:304,headers:{ETag:etag}}):new Response(raw,{headers:{'Content-Type':'application/json',ETag:etag,'Cache-Control':'no-cache'}});}catch{return Response.json({status:'unavailable',reason:'GRACE evidence withheld; forcing and scoring unchanged.'},{status:503});}
}
