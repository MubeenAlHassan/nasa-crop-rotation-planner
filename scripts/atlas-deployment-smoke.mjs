// Read-only production checks. Two requests at a time; no acquisition or writes.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=new URL(process.argv[2]||'http://127.0.0.1:4173').origin;
const out=path.resolve(process.argv[3]||'artifacts/live-audit/http');
await mkdir(out,{recursive:true});
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const checks=[],failures=[];
async function request(url,options={}) {
  const start=performance.now();
  const response=await fetch(base+url,{...options,signal:AbortSignal.timeout(45_000)});
  const bytes=Buffer.from(await response.arrayBuffer());
  return {response,bytes,ms:Math.round(performance.now()-start)};
}
async function check(name,run) {
  try {checks.push({name,status:'passed',...await run()});}
  catch(error){failures.push({name,error:error.message});console.error(name+': '+error.message);}
}
for(const route of ['/','/atlas','/atlas/'])await check('page '+route,async()=>{
  const {response,bytes,ms}=await request(route);
  assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/html/);
  assert.match(bytes.toString(),/rotationatlas|rotation.*atlas/i);
  const resourcePaths=[...bytes.toString().matchAll(/(?:src|href)="([^"?#]+)(?:\?[^"#]*)?"/g)]
    .map(m=>m[1]).filter(p=>p.startsWith('/_next/'));
  for(const asset of new Set(resourcePaths)){
    const r=await request(asset);assert.equal(r.response.status,200,asset);
    assert(r.bytes.length>0,asset+' empty');
  }
  return {ms,bytes:bytes.length,resources:new Set(resourcePaths).size,hsts:response.headers.get('strict-transport-security')};
});
for(const route of ['/planner','/weather','/api/atlas/evidence?field=unacquired-audit-field','/api/atlas/history?region=unacquired-audit-region','/api/atlas/nasa-season?month=2024-12','/api/atlas/grace?field=unacquired-audit-field','/api/atlas/ecostress?field=unacquired-audit-field'])await check('unavailable '+route,async()=>{
  const {response}=await request(route);assert.equal(response.status,404);
});
await check('server persistence disabled',async()=>{
  const {response,bytes}=await request('/api/atlas/decisions');assert.equal(response.status,501);
  assert.equal(JSON.parse(bytes).code,'SERVER_SYNC_DISABLED');assert.equal(response.headers.get('cache-control'),'no-store');
});
await check('compare method restriction',async()=>assert.equal((await request('/api/atlas/compare')).response.status,405));

const seasons=JSON.parse(await readFile(path.join(root,'frontend/public/atlas/nasa-season-index.json'),'utf8'));
const grace=JSON.parse(await readFile(path.join(root,'frontend/public/atlas/grace-index.json'),'utf8'));
const eco=JSON.parse(await readFile(path.join(root,'frontend/public/atlas/ecostress-index.json'),'utf8'));
const endpoints=[['/api/atlas/evidence',null],['/api/atlas/history',null],['/api/atlas/grace',grace.sha256],['/api/atlas/ecostress',eco.sha256],...seasons.months.map(m=>['/api/atlas/nasa-season?month='+m.month,m.sha256])];
for(const [url,expected] of endpoints)await check('API replay '+url,async()=>{
  const {response,bytes,ms}=await request(url);assert.equal(response.status,200);
  const etag=response.headers.get('etag');assert(etag,'ETag missing');
  const data=JSON.parse(bytes);assert(data.schemaVersion,'Version missing');
  if(expected)assert.equal(digest(bytes),expected,'API differs from captured archive');
  const conditional=await request(url,{headers:{'If-None-Match':etag}});
  assert.equal(conditional.response.status,304);assert.equal(conditional.bytes.length,0);
  // Vercel can weaken the 200 validator when compressing the body and retain
  // the origin's strong form on 304. If-None-Match uses weak comparison.
  assert.equal(conditional.response.headers.get('etag')?.replace(/^W\//,''),etag.replace(/^W\//,''));
  return {ms,bytes:bytes.length,sha256:digest(bytes),conditionalStatus:304};
});
await check('season API index',async()=>{
  const {response,bytes}=await request('/api/atlas/nasa-season');assert.equal(response.status,200);
  assert.deepEqual(JSON.parse(bytes),seasons);
});

// Check every checked-in public scientific asset, not just currently visible maps.
// The generated offline shell and service worker are checked as well.
async function files(directory) {
  const result=[];
  for(const item of await readdir(directory,{withFileTypes:true})){
    const full=path.join(directory,item.name);
    if(item.isDirectory())result.push(...await files(full));else result.push(full);
  }
  return result;
}
const publicRoot=path.join(root,'frontend/public');
const all=process.argv.includes('--api-only')?[]:[...await files(path.join(publicRoot,'atlas')),path.join(publicRoot,'atlas-sw.js')];
let cursor=0,bytesTransferred=0;const assets=[];
await Promise.all(Array.from({length:2},async()=>{
  while(cursor<all.length){
    const file=all[cursor++],url='/'+path.relative(publicRoot,file).split(path.sep).join('/');
    try {
      const expected=await readFile(file),result=await request(url);
      assert.equal(result.response.status,200,'HTTP status');
      assert.equal(digest(result.bytes),digest(expected),'Deployed asset differs from local checkout');
      bytesTransferred+=result.bytes.length;assets.push({path:url,bytes:result.bytes.length,ms:result.ms,sha256:digest(result.bytes)});
    } catch(error){failures.push({name:'asset '+url,error:error.message});console.error(url+': '+error.message);}
    if(cursor%100===0)console.log(`Assets checked: ${cursor}/${all.length}`);
    await new Promise(resolve=>setTimeout(resolve,50));
  }
}));
const timings=assets.map(a=>a.ms).sort((a,b)=>a-b);
const summary={base,checkedAt:new Date().toISOString(),checks:checks.length,assets:assets.length,expectedAssets:all.length,bytesTransferred,assetMedianMs:timings[Math.floor(timings.length*.5)],assetP95Ms:timings[Math.floor(timings.length*.95)],failures};
await writeFile(path.join(out,'verification.json'),JSON.stringify({summary,checks,assets:assets.sort((a,b)=>a.path.localeCompare(b.path))},null,2));
console.log(JSON.stringify(summary,null,2));
if(failures.length)process.exitCode=1;
