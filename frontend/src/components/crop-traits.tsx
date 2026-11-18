"use client";

import type { ReactElement } from "react";
import type { CropCatalogResponse } from "@/lib/generated/contracts";

export interface CropTraitsProps {
  catalog: CropCatalogResponse;
}

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

/** Read-only regional catalog traits that drive constraints and scoring. */
export function CropTraits({ catalog }: CropTraitsProps): ReactElement {
  return (
    <section aria-label="Regional crop characteristics" className="space-y-3">
      <h2 className="text-xl font-semibold text-[var(--brand-strong)]">Crop characteristics</h2>
      <p className="text-sm text-[var(--muted)]">
        Catalog {catalog.catalog_version} · region {catalog.region_id}. Traits feed calendar, irrigation,
        disease-break, and suitability rules — not yield forecasts.
      </p>
      <div className="overflow-x-auto rounded-xl border border-[var(--panel-border)]">
        <table>
          <caption>Regional crop traits used by Field Shift</caption>
          <thead>
            <tr className="bg-[var(--brand-soft)]/50">
              <th scope="col">Crop</th>
              <th scope="col">Family</th>
              <th scope="col">N demand</th>
              <th scope="col">Legume</th>
              <th scope="col">Root class</th>
              <th scope="col">Rainfall (mm)</th>
              <th scope="col">Temp (°C)</th>
              <th scope="col">pH</th>
              <th scope="col">Drought tol.</th>
              <th scope="col">Waterlog tol.</th>
            </tr>
          </thead>
          <tbody>
            {catalog.crops.map((crop) => (
              <tr key={crop.crop_id}>
                <th scope="row">{crop.crop_name}</th>
                <td>{crop.family}</td>
                <td>{crop.nitrogen_demand}</td>
                <td>{yesNo(crop.legume)}</td>
                <td>{crop.root_class}</td>
                <td>{crop.rainfall_min_mm}–{crop.rainfall_max_mm}</td>
                <td>{crop.temperature_min_c}–{crop.temperature_max_c}</td>
                <td>{crop.ph_min}–{crop.ph_max}</td>
                <td>{yesNo(crop.drought_tolerant)}</td>
                <td>{yesNo(crop.waterlogging_tolerant)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
