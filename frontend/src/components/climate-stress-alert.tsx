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
      <p className="font-semibold">Unusual weather in this window</p>
      <p className="mt-1">
        Compared with a typical 1991–2020 season, this period looks
        {extremeRain ? <> <strong>{bandLabel(climate.rainfall_band)}</strong> for rain</> : null}
        {extremeRain && extremeHeat ? " and" : null}
        {extremeHeat ? <> <strong>{bandLabel(climate.heat_band)}</strong> for heat</> : null}
        . This helps rank crops — it is not tomorrow&apos;s forecast.
      </p>
    </aside>
  );
}
