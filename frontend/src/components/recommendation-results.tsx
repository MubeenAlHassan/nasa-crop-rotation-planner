"use client";

import { BarChart3, Table2 } from "lucide-react";
import { useState, type ReactElement } from "react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { Exclusion, Message, Recommendation, Source } from "@/lib/generated/contracts";

export interface RecommendationResultsProps {
  recommendations: ReadonlyArray<Recommendation>;
  feasibleRotationCount: number;
  dataQuality: "complete" | "limited";
  status: "ok" | "degraded" | "no_feasible_rotation";
  rulesVersion?: string;
  catalogVersion?: string;
  sources: ReadonlyArray<Source>;
  warnings: ReadonlyArray<Message>;
  exclusions: ReadonlyArray<Exclusion>;
  onRetryWithIrrigation?: () => void;
  retrying?: boolean;
  /** Hide sources/warnings (shown in a separate planner tab). */
  hideProvenance?: boolean;
  /** Hide ranking header and recommendation list (notes-only mode). */
  hideChoices?: boolean;
}

const components = ["nitrogen", "roots", "water", "temperature", "soil"] as const;
const label = (value: string): string => value.replaceAll("_", " ");

/** Display numeric planner values with at least two decimal places. */
export function formatPlannerNumber(value: number): string {
  return value.toFixed(2);
}

function formatComponentScore(value: number | null): string {
  return value === null ? "Unavailable" : formatPlannerNumber(value);
}

function modeTone(mode: Source["mode"]): string {
  if (mode === "fixture" || mode === "live" || mode === "cache" || mode === "farmer_input") {
    return "bg-[var(--brand-soft)] text-[var(--brand-strong)] ring-[var(--panel-border)]";
  }
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

type DetailView = "chart" | "table";

const SCORE_FILL = "#00652c";
const WEIGHT_FILL = "#006398";

function ComponentBreakdown({ recommendation }: { recommendation: Recommendation }): ReactElement {
  const [view, setView] = useState<DetailView>("chart");
  const scoreData = components.map((name) => {
    const score = recommendation.components[name];
    return {
      component: label(name),
      score: score === null ? null : Number(score.toFixed(2)),
    };
  });
  const weightData = components.map((name) => ({
    component: label(name),
    weight: Number((recommendation.effective_weights[name] * 100).toFixed(2)),
  }));
  const unavailable = components.filter((name) => recommendation.components[name] === null);

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-[var(--muted)]">Component breakdown</p>
        <div
          role="group"
          aria-label={`Detail view for rank ${recommendation.rank}`}
          className="inline-flex rounded-lg border border-[var(--panel-border)] bg-[var(--brand-soft)]/40 p-0.5"
        >
          <button
            type="button"
            aria-pressed={view === "chart"}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
              view === "chart"
                ? "bg-white text-[var(--brand-strong)] shadow-sm"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
            onClick={() => setView("chart")}
          >
            <BarChart3 className="h-3.5 w-3.5" aria-hidden />
            Chart
          </button>
          <button
            type="button"
            aria-pressed={view === "table"}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
              view === "table"
                ? "bg-white text-[var(--brand-strong)] shadow-sm"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
            onClick={() => setView("table")}
          >
            <Table2 className="h-3.5 w-3.5" aria-hidden />
            Table
          </button>
        </div>
      </div>

      {view === "chart" ? (
        <div
          className="space-y-3"
          role="img"
          aria-label={`Component score chart for rank ${recommendation.rank}`}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <figure className="rounded-lg border border-[var(--panel-border)] bg-[#fbfffc] p-3">
              <figcaption className="mb-2 text-sm font-medium text-[var(--foreground)]">
                Component scores (0–100)
              </figcaption>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scoreData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(20,31,18,0.08)" />
                    <XAxis dataKey="component" tick={{ fontSize: 11 }} interval={0} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value) => {
                        if (value === null || value === undefined) return ["Unavailable", "Score"];
                        const numeric = typeof value === "number" ? value : Number(value);
                        return [formatPlannerNumber(numeric), "Score"];
                      }}
                    />
                    <Bar dataKey="score" name="Score" fill={SCORE_FILL} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </figure>
            <figure className="rounded-lg border border-[var(--panel-border)] bg-[#fbfffc] p-3">
              <figcaption className="mb-2 text-sm font-medium text-[var(--foreground)]">
                Effective weights (%)
              </figcaption>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weightData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(20,31,18,0.08)" />
                    <XAxis dataKey="component" tick={{ fontSize: 11 }} interval={0} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                    <Tooltip
                      formatter={(value) => {
                        const numeric = typeof value === "number" ? value : Number(value);
                        return [`${formatPlannerNumber(numeric)}%`, "Effective weight"];
                      }}
                    />
                    <Bar dataKey="weight" name="Effective weight" fill={WEIGHT_FILL} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </figure>
          </div>
          {unavailable.length > 0 && (
            <p className="text-xs text-[var(--muted)]">
              Unavailable components ({unavailable.map(label).join(", ")}) show no score bar and carry
              zero effective weight after renormalization.
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--panel-border)]">
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
                  <td>{formatComponentScore(recommendation.components[name])}</td>
                  <td>{formatPlannerNumber(recommendation.effective_weights[name])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function RecommendationResults({
  recommendations, feasibleRotationCount, dataQuality, status, rulesVersion, catalogVersion,
  sources, warnings, exclusions, onRetryWithIrrigation, retrying = false,
  hideProvenance = false, hideChoices = false,
}: RecommendationResultsProps): ReactElement {
  return (
    <section aria-label="Recommendation results" className="space-y-5">
      {!hideChoices && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-[var(--brand-strong)]">Best next crops</h2>
              <p className="mt-1 text-[var(--muted)]">
                {feasibleRotationCount === 0
                  ? "No crop cleared the rules for this plan."
                  : `${feasibleRotationCount} crop option${feasibleRotationCount === 1 ? "" : "s"} fit your dates and water setting.`}
                {" "}
                Data: {dataQuality === "complete" ? "complete" : "limited (some sources missing)"}.
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
              <p className="font-semibold">No crop works with these settings</p>
              <p className="mt-1 text-sm">
                Calendar, irrigation, or other farm rules blocked every option. See why below.
                If you ran the rainfed Faisalabad demo, try irrigation available for wheat.
              </p>
              {onRetryWithIrrigation && (
                <button
                  type="button"
                  className="btn-primary mt-4"
                  disabled={retrying}
                  onClick={onRetryWithIrrigation}
                >
                  {retrying ? "Running irrigated demo…" : "Try with irrigation available"}
                </button>
              )}
            </div>
          ) : (
            <ol className="space-y-4">
              {recommendations.map((recommendation) => (
                <li key={recommendation.rotation_id} className="rounded-xl border border-[var(--panel-border)] bg-white p-4 shadow-sm">
                  <h3 className="text-lg font-semibold text-[var(--brand-strong)]">
                    #{recommendation.rank}: {recommendation.slots.map((slot) => slot.crop_name).join(" → ")}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Suitability score {formatPlannerNumber(recommendation.score)} / 100
                  </p>
                  <details className="mt-3" open={recommendation.rank === 1}>
                    <summary className="cursor-pointer text-sm font-semibold text-[var(--brand-strong)]">
                      Why this ranked here (scores & reasons)
                    </summary>
                    <ComponentBreakdown recommendation={recommendation} />
                    <h4 className="mt-4 font-semibold text-[var(--brand-strong)]">Reasons</h4>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--foreground)]">
                      {recommendation.reasons.map((reason, index) => (
                        <li key={`${reason.code}-${index}`}>{reason.message}</li>
                      ))}
                    </ul>
                  </details>
                </li>
              ))}
            </ol>
          )}
        </>
      )}

      {!hideProvenance && sources.length > 0 && (
        <section aria-label="Data provenance" className="space-y-3">
          <h3 className="text-lg font-semibold text-[var(--brand-strong)]">Where the data came from</h3>
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
                  {source.used_for && source.used_for.length > 0 && (
                    <p className="text-xs leading-relaxed">
                      Used for: {source.used_for.join(", ")}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!hideProvenance && warnings.length > 0 && (
        <section aria-label="Data quality warnings" className="space-y-2">
          <h3 className="text-lg font-semibold text-[var(--brand-strong)]">Things to know</h3>
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

      {!hideChoices && exclusions.length > 0 && (
        <section aria-label="Excluded crops" className="space-y-2">
          <h3 className="text-lg font-semibold text-[var(--brand-strong)]">Crops ruled out</h3>
          <ul className="space-y-2">
            {exclusions.map((exclusion, index) => (
              <li
                key={`${exclusion.slot_id}-${exclusion.crop_id}-${exclusion.code}-${index}`}
                className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger-ink)]"
              >
                {exclusion.crop_id}: {exclusion.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      {hideChoices && (
        <p className="text-xs text-[var(--muted)]">
          Status {label(status)}
          {rulesVersion ? ` · rules ${rulesVersion}` : ""}
          {catalogVersion ? ` · catalog ${catalogVersion}` : ""}
          {" · "}data {dataQuality}.
        </p>
      )}
    </section>
  );
}
