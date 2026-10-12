"use client";

import type { ReactElement } from "react";
import type { Climate } from "@/lib/generated/contracts";

export interface ClimateStressAlertProps {
  climate: Climate;
}

function bandLabel(value: string): string {
  return value.replaceAll("_", " ");
}

/** Highlights extreme observed anomalies vs 1991–2020 — not a climate-change forecast. */
export function ClimateStressAlert({ climate }: ClimateStressAlertProps): ReactElement | null {
  const extremeRain = climate.rainfall_band === "severe_dry" || climate.rainfall_band === "severe_wet";
  const extremeHeat = climate.heat_band === "high";
  if (!extremeRain && !extremeHeat) return null;
  return (
    <aside
      role="status"
      className="rounded-xl border border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-3 text-sm text-[var(--warning-ink)]"
      aria-label="Extreme climate anomaly alert"
    >
      <p className="font-semibold">Extreme observed climate stress</p>
      <p className="mt-1">
        Versus the 1991–2020 baseline, this assessment window shows
        {extremeRain ? <> rainfall band <strong>{bandLabel(climate.rainfall_band)}</strong></> : null}
        {extremeRain && extremeHeat ? " and" : null}
        {extremeHeat ? <> heat band <strong>{bandLabel(climate.heat_band)}</strong></> : null}
        . This is a historical stress signal used in ranking — not a daily forecast or climate-change projection.
      </p>
    </aside>
  );
}
