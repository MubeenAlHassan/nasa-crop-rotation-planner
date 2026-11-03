"use client";

import { useState, type ReactElement } from "react";
import { ClimateCharts } from "./climate-charts";
import { ClimateStressAlert } from "./climate-stress-alert";
import { MoistureContext } from "./moisture-context";
import { RecommendationResults } from "./recommendation-results";
import { RotationTimeline } from "./rotation-timeline";
import { SoilHealthOutcomes } from "./soil-health-outcomes";
import { SoilRadar } from "./soil-radar";
import type { RecommendationResponse } from "@/lib/generated/contracts";

export type ResultsTab = "choices" | "climate" | "soil" | "notes";

export interface PlannerResultsPanelProps {
  response: RecommendationResponse;
  onRetryWithIrrigation?: () => void;
  retrying?: boolean;
}

const TABS: ReadonlyArray<{ id: ResultsTab; label: string }> = [
  { id: "choices", label: "Recommended crops" },
  { id: "climate", label: "Weather & climate" },
  { id: "soil", label: "Soil & water" },
  { id: "notes", label: "Data notes" },
];

function plainStatus(response: RecommendationResponse): string {
  if (response.feasible_rotation_count === 0) {
    return "No crop fit these dates and water settings. Check exclusions or try irrigation available.";
  }
  if (response.status === "degraded" || response.data_quality === "limited") {
    return "We found options, but some soil or moisture data is missing — treat rankings as guidance, not a guarantee.";
  }
  return "Here are the best-fitting next crops for your plan, ranked by transparent suitability rules.";
}

export function PlannerResultsPanel({
  response, onRetryWithIrrigation, retrying = false,
}: PlannerResultsPanelProps): ReactElement {
  const [tab, setTab] = useState<ResultsTab>("choices");
  const top = response.recommendations[0] ?? null;

  return (
    <section aria-label="Planner results" className="space-y-4">
      <div className="rounded-xl border border-[var(--primary)]/20 bg-[var(--surface-container-low)] px-4 py-3">
        <p className="font-display text-lg font-semibold text-[var(--primary)]">What this means</p>
        <p className="mt-1 text-sm text-[var(--on-surface-variant)]">{plainStatus(response)}</p>
      </div>

      <div role="tablist" aria-label="Result sections" className="flex flex-wrap gap-2">
        {TABS.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(item.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                selected
                  ? "bg-[var(--primary)] text-white"
                  : "bg-white text-[var(--on-surface-variant)] ring-1 ring-[var(--outline-variant)] hover:text-[var(--on-surface)]"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="space-y-6">
        {tab === "choices" && (
          <>
            <RecommendationResults
              recommendations={response.recommendations}
              feasibleRotationCount={response.feasible_rotation_count}
              dataQuality={response.data_quality}
              status={response.status}
              rulesVersion={response.rules_version}
              catalogVersion={response.catalog_version}
              sources={[]}
              warnings={[]}
              exclusions={response.exclusions}
              onRetryWithIrrigation={onRetryWithIrrigation}
              retrying={retrying}
              hideProvenance
            />
            {top && <RotationTimeline recommendation={top} />}
          </>
        )}

        {tab === "climate" && (
          <>
            <ClimateStressAlert climate={response.features.climate} />
            <ClimateCharts climate={response.features.climate} scenarios={response.features.slot_scenarios} />
          </>
        )}

        {tab === "soil" && (
          <>
            <SoilHealthOutcomes recommendation={top} soil={response.features.soil} />
            <MoistureContext moisture={response.features.moisture} scenarios={response.features.slot_scenarios} />
            <SoilRadar soil={response.features.soil} />
          </>
        )}

        {tab === "notes" && (
          <RecommendationResults
            recommendations={[]}
            feasibleRotationCount={response.feasible_rotation_count}
            dataQuality={response.data_quality}
            status={response.status}
            rulesVersion={response.rules_version}
            catalogVersion={response.catalog_version}
            sources={response.sources}
            warnings={response.warnings}
            exclusions={[]}
            hideChoices
          />
        )}
      </div>
    </section>
  );
}
