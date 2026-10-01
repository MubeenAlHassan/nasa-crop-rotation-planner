import type { ReactElement } from "react";
import type { Exclusion, Message, Recommendation, Source } from "@/lib/generated/contracts";

export interface RecommendationResultsProps {
  recommendations: ReadonlyArray<Recommendation>;
  feasibleRotationCount: number;
  dataQuality: "complete" | "limited";
  sources: ReadonlyArray<Source>;
  warnings: ReadonlyArray<Message>;
  exclusions: ReadonlyArray<Exclusion>;
}

const components = ["nitrogen", "roots", "water", "temperature", "soil"] as const;
const label = (value: string): string => value.replaceAll("_", " ");

export function RecommendationResults({ recommendations, feasibleRotationCount, dataQuality, sources, warnings, exclusions }: RecommendationResultsProps): ReactElement {
  return (
    <section aria-label="Recommendation results" className="space-y-5">
      <h2>Ranked alternatives</h2>
      <p>Feasible rotations: {feasibleRotationCount}. Data quality: {dataQuality}.</p>
      {recommendations.length === 0 ? <p role="status">No feasible rotation was returned. Review the exclusions and input constraints below.</p> :
        <ol className="space-y-4">{recommendations.map((recommendation) => <li key={recommendation.rotation_id} className="rounded border p-4">
          <h3>Rank {recommendation.rank}: score {recommendation.score}</h3>
          <p>{recommendation.slots.map((slot) => slot.crop_name).join(" → ")}</p>
          <table>
            <caption>Returned component scores and effective weights for rank {recommendation.rank}</caption>
            <thead><tr><th scope="col">Component</th><th scope="col">Score</th><th scope="col">Effective weight</th></tr></thead>
            <tbody>{components.map((name) => <tr key={name}>
              <th scope="row">{label(name)}</th>
              <td>{recommendation.components[name] === null ? "Unavailable" : recommendation.components[name]}</td>
              <td>{recommendation.effective_weights[name]}</td>
            </tr>)}</tbody>
          </table>
          <h4>Reasons</h4>
          <ul>{recommendation.reasons.map((reason, index) => <li key={`${reason.code}-${index}`}>{reason.message}</li>)}</ul>
        </li>)}</ol>}
      <section aria-label="Data provenance">
        <h3>Sources</h3>
        <ul>{sources.map((source) => <li key={source.provider}>
          <strong>{label(source.provider)}</strong>: <span className="inline-flex rounded bg-slate-100 px-2 py-1 text-xs">{label(source.mode)}</span>
          {source.product && <> · {source.product}</>}
          {source.retrieved_at && <> · retrieved {source.retrieved_at}</>}
          {source.fixture_id && <> · demo fixture {source.fixture_id}</>}
        </li>)}</ul>
      </section>
      {warnings.length > 0 && <section aria-label="Data quality warnings"><h3>Warnings</h3><ul>
        {warnings.map((warning, index) => <li key={`${warning.code}-${index}`}>{warning.message}</li>)}
      </ul></section>}
      {exclusions.length > 0 && <section aria-label="Excluded crops"><h3>Exclusions</h3><ul>
        {exclusions.map((exclusion, index) => <li key={`${exclusion.slot_id}-${exclusion.crop_id}-${exclusion.code}-${index}`}>
          {exclusion.slot_id}: {exclusion.crop_id} — {exclusion.message}
        </li>)}
      </ul></section>}
    </section>
  );
}
