import type { ReactElement } from "react";
import type { Exclusion, Message, Recommendation, Source } from "@/lib/generated/contracts";

export interface RecommendationResultsProps {
  recommendations: ReadonlyArray<Recommendation>;
  feasibleRotationCount: number;
  dataQuality: "complete" | "limited";
  sources: ReadonlyArray<Source>;
  warnings: ReadonlyArray<Message>;
  exclusions: ReadonlyArray<Exclusion>;
  onRetryWithIrrigation?: () => void;
  retrying?: boolean;
}

const components = ["nitrogen", "roots", "water", "temperature", "soil"] as const;
const label = (value: string): string => value.replaceAll("_", " ");

function modeTone(mode: Source["mode"]): string {
  if (mode === "fixture" || mode === "live" || mode === "cache" || mode === "farmer_input") {
    return "bg-[var(--brand-soft)] text-[var(--brand-strong)] ring-[var(--panel-border)]";
  }
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

export function RecommendationResults({
  recommendations, feasibleRotationCount, dataQuality, sources, warnings, exclusions,
  onRetryWithIrrigation, retrying = false,
}: RecommendationResultsProps): ReactElement {
  return (
    <section aria-label="Recommendation results" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--brand-strong)]">Ranked alternatives</h2>
          <p className="mt-1 text-[var(--muted)]">
            Feasible rotations: {feasibleRotationCount}. Data quality: {dataQuality}.
          </p>
        </div>
        <div className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-sm font-semibold text-[var(--brand-strong)]">
          {feasibleRotationCount} feasible
        </div>
      </div>

      {recommendations.length === 0 ? (
        <div
          role="status"
          className="rounded-xl border border-[var(--warning-border)] bg-[var(--warning-bg)] p-4 text-[var(--warning-ink)]"
        >
          <p className="font-semibold">No feasible rotation was returned.</p>
          <p className="mt-1 text-sm">
            Under rainfed constraints, wheat is excluded because it requires irrigation, and other catalog crops miss this Rabi planting window.
            Try irrigation available to unlock the documented wheat alternative.
          </p>
          {onRetryWithIrrigation && (
            <button
              type="button"
              className="btn-primary mt-4"
              disabled={retrying}
              onClick={onRetryWithIrrigation}
            >
              {retrying ? "Running irrigated demo…" : "Retry with irrigation available"}
            </button>
          )}
        </div>
      ) : (
        <ol className="space-y-4">
          {recommendations.map((recommendation) => (
            <li key={recommendation.rotation_id} className="rounded-xl border border-[var(--panel-border)] bg-white p-4 shadow-sm">
              <h3 className="text-lg font-semibold text-[var(--brand-strong)]">
                Rank {recommendation.rank}: score {recommendation.score}
              </h3>
              <p className="mt-1 text-base font-medium">{recommendation.slots.map((slot) => slot.crop_name).join(" → ")}</p>
              <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--panel-border)]">
                <table>
                  <caption>Returned component scores and effective weights for rank {recommendation.rank}</caption>
                  <thead>
                    <tr className="bg-[var(--brand-soft)]/50">
                      <th scope="col">Component</th>
                      <th scope="col">Score</th>
                      <th scope="col">Effective weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {components.map((name) => (
                      <tr key={name}>
                        <th scope="row">{label(name)}</th>
                        <td>{recommendation.components[name] === null ? "Unavailable" : recommendation.components[name]}</td>
                        <td>{recommendation.effective_weights[name]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h4 className="mt-4 font-semibold text-[var(--brand-strong)]">Reasons</h4>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--foreground)]">
                {recommendation.reasons.map((reason, index) => (
                  <li key={`${reason.code}-${index}`}>{reason.message}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}

      <section aria-label="Data provenance" className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--brand-strong)]">Sources</h3>
        <ul className="space-y-2">
          {sources.map((source) => (
            <li
              key={source.provider}
              className="grid gap-2 rounded-xl border border-[var(--panel-border)] bg-[#fbfffc] px-3 py-3 sm:grid-cols-[8rem_1fr] sm:items-start"
            >
              <strong className="capitalize text-[var(--foreground)]">{label(source.provider)}</strong>
              <div className="min-w-0 space-y-1 text-sm text-[var(--muted)]">
                <div>
                  <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ${modeTone(source.mode)}`}>
                    {label(source.mode)}
                  </span>
                </div>
                <p className="leading-relaxed break-words">
                  {source.product && <>{source.product}</>}
                  {source.retrieved_at && <> · retrieved {source.retrieved_at}</>}
                  {source.fixture_id && <> · demo fixture {source.fixture_id}</>}
                  {!source.product && !source.retrieved_at && !source.fixture_id && <>No observational metadata for this source.</>}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {warnings.length > 0 && (
        <section aria-label="Data quality warnings" className="space-y-2">
          <h3 className="text-lg font-semibold text-[var(--brand-strong)]">Warnings</h3>
          <ul className="space-y-2">
            {warnings.map((warning, index) => (
              <li
                key={`${warning.code}-${index}`}
                className="rounded-xl border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-sm text-[var(--warning-ink)]"
              >
                {warning.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      {exclusions.length > 0 && (
        <section aria-label="Excluded crops" className="space-y-2">
          <h3 className="text-lg font-semibold text-[var(--brand-strong)]">Exclusions</h3>
          <ul className="space-y-2">
            {exclusions.map((exclusion, index) => (
              <li
                key={`${exclusion.slot_id}-${exclusion.crop_id}-${exclusion.code}-${index}`}
                className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger-ink)]"
              >
                {exclusion.slot_id}: {exclusion.crop_id} — {exclusion.message}
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
