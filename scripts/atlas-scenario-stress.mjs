// Deterministic supported-input stress checks, not agronomic validation.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(path.join(root,'frontend/package.json'));
const temporary=await mkdtemp(path.join(tmpdir(),'atlas-scenario-stress-'));
try{
  const entry=path.join(temporary,'audit.mjs');
  await require('esbuild').build({stdin:{contents:"export {compare} from './frontend/src/lib/atlas/engine'; export {DEFAULT_REQUEST} from './frontend/src/lib/atlas/catalog';",resolveDir:root},bundle:true,platform:'node',format:'esm',outfile:entry});
  const {compare,DEFAULT_REQUEST}=await import(pathToFileURL(entry));
  const data=JSON.parse(await readFile(path.join(root,'frontend/public/atlas/iowa.json'),'utf8'));
  const summary={scenarios:0,members:0,waterResidualMax:0,finiteOutcomes:true,preferenceGating:true,productionApiCases:0};
  const start=performance.now(),base=process.argv[2];
  for(let i=0;i<96;i++){
    const request=structuredClone(DEFAULT_REQUEST);
    Object.assign(request.field,{boundaryConfirmed:true,baselineConfirmed:true,laborAvailable:true,coverEquipment:true,smallGrainBuyer:true,smallGrainEquipment:true,smallGrainSuitable:true,forageSuitable:true,forageBuyer:true,forageEquipment:true,budget:10000,
      soilCapacity:[60,160,260][i%3],baseline:i%2?'soybean-maize':'maize-soybean',irrigation:!!(i%2),irrigationLimit:[0,200,400][i%3],irrigationEfficiency:[.1,.6,1][i%3]});
    request.rainfall=[40,100,140][Math.floor(i/3)%3];
    request.warming=[0,2,4][Math.floor(i/9)%3];
    request.price=[50,100,160][Math.floor(i/27)%3];
    request.terminationDay=[90,105,135][i%3];
    Object.assign(request.initialState,{storageFraction:i%2,snowMm:i%4===0?500:0,residueCover:i%2});
    if(i%5===0)request.field.coverEquipment=null;
    if(i%7===0)request.field.forageBuyer=false;
    const result=compare(data,request,false);
    assert.equal(result.status,'ready',`Supported scenario ${i} withheld`);
    for(const strategy of result.strategies){
      for(const key of ['demand','deficit','irrigation','withdrawal','et','coverDays','margin','transition'])assert(Number.isFinite(strategy[key]),`${i}: ${key} not finite`);
      if(strategy.match!==null){assert(strategy.match>=0&&strategy.match<=100);assert.equal(strategy.feasibility,'pass');}
      for(const member of strategy.members){
        summary.members++;
        summary.waterResidualMax=Math.max(summary.waterResidualMax,member.maxWaterResidual);
        assert(member.maxWaterResidual<1e-8,`${i}: water balance residual`);
      }
    }
    if(result.strategies.some(s=>s.feasibility==='unknown'))assert.equal(result.preferred,null);
    if(result.preferred)assert(result.strategies.some(s=>s.id===result.preferred&&s.feasibility==='pass'));
    if(base&&[0,31,95].includes(i)){
      const response=await fetch(base+'/api/atlas/compare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});
      assert.equal(response.status,200);assert.deepEqual(await response.json(),result);summary.productionApiCases++;
    }
    summary.scenarios++;
  }
  if(base){
    for(const [body,status] of [['null',422],['{',422],['x'.repeat(33000),413]]){
      const response=await fetch(base+'/api/atlas/compare',{method:'POST',headers:{'Content-Type':'application/json'},body});
      assert.equal(response.status,status);summary.productionApiCases++;
    }
  }
  summary.elapsedSeconds=+((performance.now()-start)/1000).toFixed(2);
  await mkdir(path.join(root,'artifacts/release'),{recursive:true});
  await writeFile(path.join(root,'artifacts/release/scenario-stress.json'),JSON.stringify(summary,null,2));
  console.log(JSON.stringify(summary,null,2));
}finally{await rm(temporary,{recursive:true,force:true});}
