"use client";

import type { ReactElement } from "react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import type { Soil, SoilFieldSources } from "@/lib/generated/contracts";

export interface SoilRadarProps { soil: Soil; }

type Field = keyof SoilFieldSources;
const fields: ReadonlyArray<{ key: Field; label: string; unit: string; scale: number }> = [
  { key: "ph", label: "pH", unit: "pH", scale: 14 },
  { key: "soc_g_kg", label: "Soil organic carbon", unit: "g/kg", scale: 50 },
  { key: "total_n_g_kg", label: "Total nitrogen", unit: "g/kg", scale: 10 },
  { key: "sand_pct", label: "Sand", unit: "%", scale: 100 },
  { key: "silt_pct", label: "Silt", unit: "%", scale: 100 },
  { key: "clay_pct", label: "Clay", unit: "%", scale: 100 },
];

export function SoilRadar({ soil }: SoilRadarProps): ReactElement {
  const axes = fields.flatMap((field) => {
    const raw = soil[field.key];
    return raw === null ? [] : [{
      axis: field.label,
      display: Math.min(100, raw / field.scale * 100),
      raw,
      unit: field.unit,
      source: soil.field_sources[field.key],
    }];
  });
  return (
    <section aria-label="Soil properties" className="space-y-3 border-t border-[var(--panel-border)] pt-6">
      <h2 className="text-xl font-semibold text-[var(--brand-strong)]">Soil properties, 0–30 cm</h2>
      <p className="text-sm text-[var(--muted)]">
        Radar axes are display-only: pH 0–14, soil organic carbon 0–50 g/kg, total nitrogen 0–10 g/kg, and texture 0–100%.
        Values above a display limit are capped on the radar; the table retains raw values. In v1 scoring, only known pH
        enters the soil suitability component; SOC, total N, and texture remain soil-health context (total N is not plant-available N).
      </p>
      {axes.length >= 3 ? <figure>
        <figcaption>Available soil properties on fixed display scales</figcaption>
        <div className="h-72"><ResponsiveContainer width="100%" height="100%">
          <RadarChart data={axes}><PolarGrid /><PolarAngleAxis dataKey="axis" /><PolarRadiusAxis domain={[0, 100]} />
            <Tooltip formatter={(_value, _name, item) => {
              const entry = item.payload as { raw: number; unit: string; source: string };
              return `${entry.raw} ${entry.unit} (${entry.source})`;
            }} />
            <Radar dataKey="display" name="Display scale (0–100)" fill="#059669" stroke="#047857" fillOpacity={0.4} />
          </RadarChart>
        </ResponsiveContainer></div>
      </figure> : <p>Too few measured properties for a radar; raw values remain below.</p>}
      <div className="overflow-x-auto rounded-xl border border-[var(--panel-border)]">
        <table>
          <caption>Exact soil values, units, and field sources</caption>
          <thead><tr className="bg-[var(--brand-soft)]/50"><th scope="col">Property</th><th scope="col">Value</th><th scope="col">Unit</th><th scope="col">Source</th></tr></thead>
          <tbody>{fields.map((field) => <tr key={field.key}>
            <th scope="row">{field.label}</th><td>{soil[field.key] === null ? "Unavailable" : String(soil[field.key])}</td>
            <td>{field.unit}</td><td>{soil.field_sources[field.key].replaceAll("_", " ")}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
