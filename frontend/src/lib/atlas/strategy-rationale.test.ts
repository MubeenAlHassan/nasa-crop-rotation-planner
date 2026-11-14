import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {DEFAULT_REQUEST} from './catalog';
import {compare} from './engine';
import {parseEco} from './ecostress';
import {parseSeason} from './nasa-season';
import {attachStrategyRationales,buildStrategyRationale,RATIONALE_METHOD} from './strategy-rationale';
import type {EvidenceSeries,ScenarioRequest} from './types';

const data=JSON.parse(readFileSync(new URL('../../../public/atlas/iowa.json',import.meta.url),'utf8')) as EvidenceSeries;
const season=parseSeason(JSON.parse(readFileSync('public/atlas/nasa-season/2024-06.json','utf8')));
const eco=parseEco(JSON.parse(readFileSync('public/atlas/ecostress/pilot.json','utf8')));

function confirmed():ScenarioRequest {
  const r=structuredClone(DEFAULT_REQUEST);
  Object.assign(r.field,{boundaryConfirmed:true,baselineConfirmed:true,laborAvailable:true,coverEquipment:true,smallGrainBuyer:true,smallGrainEquipment:true,smallGrainSuitable:true,forageSuitable:true,forageBuyer:true,forageEquipment:true,budget:4000});
  return r;
}

describe('Evidence-linked strategy rationale',()=>{
  it('attaches qualified rationale to every strategy without changing scores',()=>{
    const request=confirmed();
    const result=compare(data,request);
    expect(result.status).toBe('ready');
    expect(result.strategies).toHaveLength(4);
    for(const s of result.strategies){
      expect(s.rationale?.method).toBe(RATIONALE_METHOD);
      expect(s.rationale?.strategyId).toBe(s.id);
      expect(s.rationale?.scoringUnaffected).toBe(true);
      expect(s.rationale?.templateBasis).toMatch(/do not generate or rank/i);
      expect(s.rationale?.mechanisms.length).toBeGreaterThan(0);
      expect(s.rationale?.localReviewQuestions.length).toBeGreaterThan(0);
      expect(s.rationale?.projectedBenefitsNote).toMatch(/not measured farm benefits/i);
      expect(s.rationale?.observedContext.some(c=>c.source==='power-forcing')).toBe(true);
      expect(s.rationale?.contraryOrMissing.some(t=>/probability|unavailable|Fixed Atlas|fixed templates/i.test(t))).toBe(true);
    }
    const before=result.strategies.map(s=>s.match);
    const enriched=attachStrategyRationales(result,request,{weather:data,seasonalPackages:[season],ecostress:eco});
    expect(enriched.strategies.map(s=>s.match)).toEqual(before);
    expect(enriched.strategies.map(s=>s.objectives)).toEqual(result.strategies.map(s=>s.objectives));
  });

  it('cites matching farmer history and withholds mismatched boundary history',()=>{
    const request=confirmed();
    request.history.boundary=structuredClone(request.field.boundary);
    request.history.windows=[{id:'gap-1',start:'2024-04-01',end:'2024-04-15',status:'uncertain',cover:'unknown',note:'Review gap only.',observationIds:[],updatedAt:'2026-11-14T00:00:00Z'}];
    const matching=compare(data,request).strategies[1].rationale!;
    expect(matching.observedContext.some(c=>c.id==='window-gap-1'&&c.applicability==='matching')).toBe(true);

    request.history.boundary=[[-93.654,42.022],[-93.646,42.022],[-93.646,42.027],[-93.654,42.027],[-93.654,42.022]];
    const mismatched=buildStrategyRationale(compare(data,request).strategies[1],request,{weather:data});
    expect(mismatched.observedContext.some(c=>c.id==='window-gap-1')).toBe(false);
    expect(mismatched.contraryOrMissing.join()).toMatch(/not attributed to the current boundary/i);
  });

  it('withholds mismatched Landsat and ECOSTRESS from observed context',()=>{
    const request=confirmed();
    const strategy=compare(data,request).strategies[0];
    const mismatchedEco=structuredClone(eco);
    mismatchedEco.field.geometry.coordinates[0][0][0]+=0.001;
    const rationale=buildStrategyRationale(strategy,request,{
      weather:data,
      fieldEvidence:null,
      seasonalPackages:[season],
      ecostress:mismatchedEco,
    });
    expect(rationale.observedContext.some(c=>c.source==='ecostress')).toBe(false);
    expect(rationale.contraryOrMissing.join()).toMatch(/ECOSTRESS boundary differs/i);
    expect(rationale.contraryOrMissing.join()).toMatch(/Landsat field package not loaded/i);
    expect(rationale.observedContext.some(c=>c.source==='seasonal-regional'&&c.applicability==='regional-only')).toBe(true);
    expect(rationale.observedContext.find(c=>c.source==='seasonal-regional')?.summary).toMatch(/Nearest-pilot L3 accepted retrieval count/);
  });

  it('keeps satellite enrichment out of scoring and marks unsupported benefits unavailable',()=>{
    const request=confirmed();
    const base=compare(data,request);
    const enriched=attachStrategyRationales(base,request,{weather:data,seasonalPackages:[season],ecostress:eco});
    for(const s of enriched.strategies){
      expect(s.unavailable).toEqual({soilCarbonChange:null,soilLoss:null,pestReduction:null,probabilityBetter:null});
      expect(s.rationale?.contraryOrMissing.join()).toMatch(/Soil-carbon change is unavailable/i);
      expect(s.rationale?.mechanisms.every(m=>m.claimLimit.length>0)).toBe(true);
    }
    expect(enriched.preferred).toBe(base.preferred);
  });
});
