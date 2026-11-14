import { NORMALIZATION } from './catalog';
import type { DistributionSummary, ObjectiveId, ScenarioRequest, StrategyResult } from './types';
export const OBJECTIVES: ObjectiveId[] = ['deficit', 'coverDays', 'margin'];
export const average = (xs:number[]) => xs.reduce((a,b)=>a+b,0)/xs.length;
export function quantile(xs:number[], q:number):number {
  if(!xs.length || q<0 || q>1) throw new Error('A nonempty distribution and a quantile in [0,1] are required.');
  const a=[...xs].sort((x,y)=>x-y), p=(a.length-1)*q;
  return a[Math.floor(p)]*(1-p%1)+a[Math.ceil(p)]*(p%1);
}
export function summarize(values:number[], objective:ObjectiveId):DistributionSummary {
  if(!values.length || values.some(v=>!Number.isFinite(v))) throw new Error('Missing or nonfinite simulated outcome.');
  const rule=NORMALIZATION[objective];
  return {unit:rule.unit,direction:rule.direction,mean:average(values),min:Math.min(...values),max:Math.max(...values),q10:quantile(values,.1),q90:quantile(values,.9),values};
}
export function utility(value:number, unit:string, direction:'min'|'max', rule:{unit:string;direction:'min'|'max';range:[number,number]}):number {
  const [lo,hi]=rule.range;
  if(unit!==rule.unit || direction!==rule.direction) throw new Error('Objective units or direction do not match the normalization contract.');
  if(!Number.isFinite(value)||!Number.isFinite(lo)||!Number.isFinite(hi)||hi<=lo) throw new Error('Invalid normalization value or reference range.');
  const scaled=Math.max(0,Math.min(1,(value-lo)/(hi-lo)));
  return direction==='max'?scaled:1-scaled;
}
/** The sole scoring authority. Consumes paired model distributions; generates no observations or probabilities. */
export function scoreStrategies(strategies:StrategyResult[], weights:ScenarioRequest['weights'], showScores=true):void {
  const total=weights.soil+weights.water+weights.economy;
  if(Object.values(weights).some(w=>!Number.isFinite(w)||w<0)||total<=0) throw new Error('Weights must be finite, nonnegative and have a positive sum.');
  const baseline=strategies.find(s=>s.id==='baseline');
  if(!baseline) throw new Error('The farmer baseline is required.');
  for(const s of strategies) {
    if(s.members.length!==baseline.members.length || s.members.some((m,i)=>m.id!==baseline.members[i].id)) throw new Error('Unpaired weather members.');
    s.eligible=s.feasibility==='pass'; s.match=null; s.scoreRange=null; s.pareto='not-assessed'; s.dominated=false;
    for(const k of OBJECTIVES) {
      s.objectives[k]=summarize(s.members.map(m=>m.totals[k]),k);
      s.pairedDifferences[k]=summarize(s.members.map((m,i)=>m.totals[k]-baseline.members[i].totals[k]),k);
      if(s.objectives[k].values.some(v=>v<NORMALIZATION[k].range[0]||v>NORMALIZATION[k].range[1])) s.reviewFlags.push(`${k}: outcomes exceed fixed normalization range; score clipped.`);
    }
    for(let i=0;i<s.members.length;i++) for(const k of OBJECTIVES) s.members[i].delta[k]=s.pairedDifferences[k].values[i];
    if(s.eligible && showScores) {
      const scores=s.members.map((_,i)=>100*OBJECTIVES.reduce((sum,k)=>sum+weights[NORMALIZATION[k].weight]*utility(s.objectives[k].values[i],s.objectives[k].unit,s.objectives[k].direction,NORMALIZATION[k]),0)/total);
      s.match=average(scores); s.scoreRange=[Math.min(...scores),Math.max(...scores)];
    }
  }
  const eligible=strategies.filter(s=>s.eligible);
  for(const s of eligible) {
    const better=(a:StrategyResult,b:StrategyResult,k:ObjectiveId)=>(NORMALIZATION[k].direction==='max'?1:-1)*(a.objectives[k].mean-b.objectives[k].mean);
    s.dominated=eligible.some(other=>other!==s&&OBJECTIVES.every(k=>better(other,s,k)>=-1e-7)&&OBJECTIVES.some(k=>better(other,s,k)>1e-7));
    s.pareto=s.dominated?'dominated':'nondominated';
  }
}
