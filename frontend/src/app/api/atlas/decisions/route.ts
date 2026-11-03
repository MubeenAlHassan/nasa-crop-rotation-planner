import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateRequest } from '../../../../lib/atlas/engine';
export const runtime='nodejs';
const root=()=>process.env.ATLAS_DECISIONS_DIR||path.join(process.cwd(),'.atlas-decisions');
function device(request:Request){const value=request.headers.get('x-atlas-device');return value&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)?value:null;}
export async function GET(request:Request){const key=device(request);if(!key)return Response.json({error:'A device key is required.'},{status:401});try{return Response.json(JSON.parse(await readFile(path.join(root(),key+'.json'),'utf8')),{headers:{'Cache-Control':'no-store'}});}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return Response.json({error:'No saved decision for this device.'},{status:404});return Response.json({error:'Decision storage unavailable.'},{status:503});}}
export async function POST(request:Request){
 const key=device(request);if(!key)return Response.json({error:'A device key is required.'},{status:401});
 let value;
 try{const body=await request.text();if(new TextEncoder().encode(body).length>32768)return Response.json({error:'Request exceeds 32 KiB.'},{status:413});value=JSON.parse(body);validateRequest(value.request);if(value.schema!==1||typeof value.updatedAt!=='string'||!Number.isFinite(Date.parse(value.updatedAt)))throw Error('Invalid saved decision.');}
 catch{return Response.json({error:'Invalid saved decision.'},{status:422});}
 try{
   await mkdir(root(),{recursive:true,mode:0o700});
   const file=path.join(root(),key+'.json'),temp=path.join(root(),key+'.'+randomUUID()+'.tmp');
   const record={schema:1,updatedAt:value.updatedAt,request:value.request,receivedAt:new Date().toISOString()};
   await writeFile(temp,JSON.stringify(record),{mode:0o600});await rename(temp,file);
   return Response.json({status:'saved',updatedAt:value.updatedAt},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Decision storage unavailable. Your device copy is retained.'},{status:503});}
}
