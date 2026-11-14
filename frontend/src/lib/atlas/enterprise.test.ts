import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {DEFAULT_ENTERPRISE,DEFAULT_REQUEST} from './catalog';
import {compare,resolveCropEconomics,validateRequest} from './engine';
import type {EvidenceSeries,ScenarioRequest} from './types';

const data=JSON.parse(readFileSync(new URL('../../../public/atlas/iowa.json',import.meta.url),'utf8')) as EvidenceSeries;
function confirmed():ScenarioRequest {
  const r=structuredClone(DEFAULT_REQUEST);
  Object.assign(r.field,{boundaryConfirmed:true,baselineConfirmed:true,laborAvailable:true,coverEquipment:true,smallGrainBuyer:true,smallGrainEquipment:true,smallGrainSuitable:true,forageSuitable:true,forageBuyer:true,forageEquipment:true,budget:4000});
  return r;
}

describe('Reviewed local enterprise inputs',()=>{
  it('defaults to catalog economics and keeps demo defaults unlabeled as measured',()=>{
    const r=confirmed();
    expect(r.enterprise).toEqual(DEFAULT_ENTERPRISE);
    expect(resolveCropEconomics('maize',r)).toEqual({price:165,cost:1577,source:'catalog-default'});
    expect(r.enterprise.reviewed).toBe(false);
  });

  it('applies farmer price/cost and clover credit overrides without inventing quotes',()=>{
    const r=confirmed();
    r.enterprise={...r.enterprise,source:'farmer-entry',crops:{maize:{price:200,cost:1500},rye:{price:null,cost:100}},cloverCreditKgN:[50,80],nitrogenCreditUsdPerKg:1.5};
    expect(resolveCropEconomics('maize',r)).toEqual({price:200,cost:1500,source:'farmer-entry'});
    expect(resolveCropEconomics('rye',r).cost).toBe(100);
    expect(resolveCropEconomics('soybean',r).price).toBe(385);
    const diverse=compare(data,r).strategies.find(s=>s.id==='diverse')!;
    const withDefault=confirmed();
    const baseDiverse=compare(data,withDefault).strategies.find(s=>s.id==='diverse')!;
    // creditLow/High are year totals; years after wheat carry the entered clover credit range.
    expect(diverse.members[0].years.some(y=>y.creditLow===50&&y.creditHigh===80)).toBe(true);
    expect(diverse.objectives.deficit.mean).toBeCloseTo(baseDiverse.objectives.deficit.mean,8);
    expect(diverse.objectives.coverDays.mean).toBeCloseTo(baseDiverse.objectives.coverDays.mean,8);
    expect(diverse.margin).not.toBeCloseTo(baseDiverse.margin,2);
  });

  it('rejects out-of-range enterprise overrides',()=>{
    const r=confirmed();
    r.enterprise.crops={maize:{price:5000,cost:null}};
    expect(()=>validateRequest(r)).toThrow(/price\/cost/i);
    r.enterprise.crops={maize:{price:180,cost:1600}};
    r.enterprise.cloverCreditKgN=[90,40];
    expect(()=>validateRequest(r)).toThrow(/enterprise budget/i);
  });
});
