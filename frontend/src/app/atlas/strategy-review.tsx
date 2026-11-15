'use client';
import type {ScenarioRequest,StrategyResult} from '@/lib/atlas/types';

export function StrategyFeasibility({strategy,onReview}:{strategy:StrategyResult;onReview:()=>void}) {
  const unknown=strategy.constraints.filter(c=>c.status==='unknown');
  const failed=strategy.constraints.filter(c=>c.status==='fail');
  return <section className="ra-feasibility-review ra-prose" aria-label="Farm checks for this rotation">
    <h3>{failed.length?'Conditions not met':unknown.length?'Farm details need your review':'Farm checks complete'}</h3>
    <p className="ra-small">{failed.length?'This rotation has constraints that are not met and cannot receive a preference score. Review the conditions below before considering it.':unknown.length?'These are unanswered farm questions. Scenario estimates remain available, but this rotation cannot receive a preference score until its checks are resolved.':'All feasibility checks pass for the information you entered. This does not validate the modeled benefits.'}</p>
    {failed.length>0&&<><h4>Conditions to resolve</h4><ul className="ra-assumptions">{failed.map(c=><li key={c.id}><strong>{c.label}.</strong> {c.detail}</li>)}</ul></>}
    {unknown.length>0&&<><h4>Needs your input</h4><ul className="ra-assumptions">{unknown.map(c=><li key={c.id}><strong>{c.label}.</strong> {c.detail}</li>)}</ul><p className="ra-small">Choose Yes, No or Unknown in Farm assumptions using what you know about the field, crop history, labor and equipment. Keep Unknown when you cannot confirm an answer.</p></>}
    <button type="button" className="ra-button ra-button-outline" onClick={onReview}>Review farm inputs</button>
  </section>;
}

export function StrategyModelNotes({strategy,request,onReviewSoil}:{strategy:StrategyResult;request:ScenarioRequest;onReviewSoil:()=>void}) {
  return <section className="ra-model-notes ra-prose" aria-label="Model limitations and soil assumptions">
    <h3>Model limits and data assumptions</h3>
    <p className="ra-small">These notes describe the evidence behind the estimates. Confirming farm details does not remove model uncertainty.</p>
    <ul className="ra-assumptions">{strategy.reviewFlags.map(flag=><li key={flag}>{flag}</li>)}</ul>
    <p className="ra-small">The three historical weather blocks show how the scenarios vary across those periods. They do not give the probability of a future yield, water saving or income.</p>
    {request.field.soilSource==='demo-assumption'&&<><p className="ra-small">The model currently uses the demo soil-water capacity of {request.field.soilCapacity} mm/m. Enter an appropriate local value if you have one; entering a number does not establish that it was measured or calibrated.</p><button type="button" className="ra-button ra-button-outline" onClick={onReviewSoil}>Review soil and starting state</button></>}
  </section>;
}
