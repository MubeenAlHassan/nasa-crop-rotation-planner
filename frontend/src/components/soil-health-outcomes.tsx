"use client";

import type { ReactElement } from "react";
import type { Recommendation, Soil } from "@/lib/generated/contracts";
import { formatPlannerNumber } from "./recommendation-results";

export interface SoilHealthOutcomesProps {
  recommendation: Recommendation | null;
  soil: Soil;
}

/** Heuristic soil-resilience readout from scored components — not a soil-health certification. */
export function SoilHealthOutcomes({ recommendation, soil }: SoilHealthOutcomesProps): ReactElement {
  const nitrogen = recommendation?.components.nitrogen ?? null;
  const roots = recommendation?.components.roots ?? null;
  const soilScore = recommendation?.components.soil ?? null;
  const parts = [nitrogen, roots, soilScore].filter((value): value is number => value !== null);
  const composite = parts.length > 0 ? parts.reduce((sum, value) => sum + value, 0) / parts.length : null;
  return (
    <section aria-label="Soil health resilience signals" className="space-y-3 border-t border-[var(--panel-border)] pt-6">
      <h2 className="text-xl font-semibold text-[var(--brand-strong)]">Soil-health resilience signals</h2>
      <p className="text-sm text-[var(--muted)]">
        These values summarize nitrogen transitions, root-class diversity, and pH/SOC context for the top feasible
        rotation. They are suitability heuristics for comparing alternatives — not measured soil improvement or yield gains.
      </p>
      <div className="overflow-x-auto rounded-xl border border-[var(--panel-border)]">
        <table>
          <caption>Soil-resilience component summary</caption>
          <thead>
            <tr className="bg-[var(--brand-soft)]/50">
              <th scope="col">Signal</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Nitrogen transition score</th>
              <td>{nitrogen === null ? "Unavailable" : formatPlannerNumber(nitrogen)}</td>
            </tr>
            <tr>
              <th scope="row">Root diversification score</th>
              <td>{roots === null ? "Unavailable" : formatPlannerNumber(roots)}</td>
            </tr>
            <tr>
              <th scope="row">Soil pH / SOC context score</th>
              <td>{soilScore === null ? "Unavailable" : formatPlannerNumber(soilScore)}</td>
            </tr>
            <tr>
              <th scope="row">Mean soil-resilience signal</th>
              <td>{composite === null ? "Unavailable" : formatPlannerNumber(composite)}</td>
            </tr>
            <tr>
              <th scope="row">Observed SOC (g/kg)</th>
              <td>{soil.soc_g_kg === null ? "Unavailable" : String(soil.soc_g_kg)}</td>
            </tr>
            <tr>
              <th scope="row">Observed pH</th>
              <td>{soil.ph === null ? "Unavailable — add a farmer soil sample or enable SoilGrids" : String(soil.ph)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
