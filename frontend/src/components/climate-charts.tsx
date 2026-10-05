"use client";

import type { ReactElement } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Climate, SlotScenario } from "@/lib/generated/contracts";

export interface ClimateChartsProps {
  climate: Climate;
  scenarios: ReadonlyArray<SlotScenario>;
}

function value(number: number | null, unit: string): string {
  return number === null ? "Unavailable" : `${number.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`;
}
function signed(number: number | null, unit: string): string {
  return number === null ? "Unavailable" : `${number >= 0 ? "+" : ""}${number.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`;
}
function band(name: string): string { return name.replaceAll("_", " "); }

export function ClimateCharts({ climate, scenarios }: ClimateChartsProps): ReactElement {
  const rainfall = [{ period: "Previous 90 days", observed: climate.rainfall_observed_mm, baseline: climate.rainfall_baseline_mm }];
  const temperature = [{ period: "Previous 90 days", observed: climate.temperature_observed_c, baseline: climate.temperature_baseline_c }];
  return (
    <section aria-label="Climate observations and historical stress scenarios" className="space-y-4 border-t border-[var(--panel-border)] pt-6">
      <h2 className="text-xl font-semibold text-[var(--brand-strong)]">Observed climate compared with 1991–2020</h2>
      <p className="text-sm text-[var(--muted)]">Observation window: {climate.window_start} to {climate.window_end}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <figure>
          <figcaption>Rainfall (mm): observed and matched historical baseline</figcaption>
          <div className="h-56"><ResponsiveContainer width="100%" height="100%">
            <BarChart data={rainfall}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="period" /><YAxis unit=" mm" /><Tooltip /><Legend />
              <Bar dataKey="observed" name="Observed rainfall (mm)" fill="#2563eb" />
              <Bar dataKey="baseline" name="Baseline rainfall (mm)" fill="#94a3b8" />
            </BarChart>
          </ResponsiveContainer></div>
        </figure>
        <figure>
          <figcaption>Mean temperature (°C): observed and matched historical baseline</figcaption>
          <div className="h-56"><ResponsiveContainer width="100%" height="100%">
            <BarChart data={temperature}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="period" /><YAxis unit=" °C" /><Tooltip /><Legend />
              <Bar dataKey="observed" name="Observed temperature (°C)" fill="#ea580c" />
              <Bar dataKey="baseline" name="Baseline temperature (°C)" fill="#94a3b8" />
            </BarChart>
          </ResponsiveContainer></div>
        </figure>
      </div>
      <p>Rainfall anomaly: <strong>{signed(climate.rainfall_anomaly_pct, "%")}</strong> · band: {band(climate.rainfall_band)}</p>
      <p>Temperature anomaly: <strong>{signed(climate.temperature_anomaly_c, "°C")}</strong> · heat band: {band(climate.heat_band)}</p>
      <div className="overflow-x-auto rounded-xl border border-[var(--panel-border)]">
        <table>
          <caption>Accessible observed and baseline climate data</caption>
          <thead><tr className="bg-[var(--brand-soft)]/50"><th scope="col">Measure</th><th scope="col">Observed</th><th scope="col">Baseline</th><th scope="col">Anomaly</th></tr></thead>
          <tbody>
            <tr><th scope="row">Rainfall (mm)</th><td>{value(climate.rainfall_observed_mm, "mm")}</td><td>{value(climate.rainfall_baseline_mm, "mm")}</td><td>{signed(climate.rainfall_anomaly_pct, "%")}</td></tr>
            <tr><th scope="row">Mean temperature (°C)</th><td>{value(climate.temperature_observed_c, "°C")}</td><td>{value(climate.temperature_baseline_c, "°C")}</td><td>{signed(climate.temperature_anomaly_c, "°C")}</td></tr>
          </tbody>
        </table>
      </div>
      <h3 className="text-lg font-semibold text-[var(--brand-strong)]">Historical stress scenarios for requested slots</h3>
      <p className="text-sm text-[var(--muted)]">These scenarios apply anomalies from the observed {climate.window_start} to {climate.window_end} window to each slot&apos;s seasonal baseline.</p>
      <div className="overflow-x-auto rounded-xl border border-[var(--panel-border)]">
      <table>
        <caption>Slot scenarios; future conditions remain uncertain</caption>
        <thead><tr><th scope="col">Slot</th><th scope="col">Scenario kind</th><th scope="col">Rainfall</th><th scope="col">Temperature</th></tr></thead>
        <tbody>{scenarios.map((scenario) => <tr key={scenario.slot_id}>
          <th scope="row">{scenario.slot_id}</th><td>{band(scenario.kind)}</td>
          <td>{value(scenario.rainfall_mm, "mm")}</td><td>{value(scenario.temperature_c, "°C")}</td>
        </tr>)}</tbody>
      </table>
      </div>
    </section>
  );
}
