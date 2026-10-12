"use client";

import type { ReactElement } from "react";
import type { Moisture, SlotScenario } from "@/lib/generated/contracts";

export interface MoistureContextProps {
  moisture: Moisture;
  scenarios: ReadonlyArray<SlotScenario>;
}

function value(number: number | null, unit: string): string {
  return number === null ? "Unavailable" : `${number.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${unit}`;
}

/** Surface SMAP moisture context — never presented as root-zone or farm sensor data. */
export function MoistureContext({ moisture, scenarios }: MoistureContextProps): ReactElement {
  const smapAdjusted = scenarios.some((scenario) => scenario.smap_adjustment_applied);
  return (
    <section aria-label="Surface moisture context" className="space-y-3 border-t border-[var(--panel-border)] pt-6">
      <h2 className="text-xl font-semibold text-[var(--brand-strong)]">Surface moisture (SMAP context)</h2>
      <p className="text-sm text-[var(--muted)]">
        Values are coarse surface volumetric water content when an authorized SMAP archive is present.
        They are not root-zone measurements and do not replace on-farm sensing.
      </p>
      <div className="overflow-x-auto rounded-xl border border-[var(--panel-border)]">
        <table>
          <caption>SMAP-derived moisture features</caption>
          <thead>
            <tr className="bg-[var(--brand-soft)]/50">
              <th scope="col">Measure</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Surface moisture</th>
              <td>{value(moisture.surface_m3_m3, "m³/m³")}</td>
            </tr>
            <tr>
              <th scope="row">Dryness percentile</th>
              <td>{moisture.percentile === null ? "Unavailable" : `${moisture.percentile.toFixed(1)}`}</td>
            </tr>
            <tr>
              <th scope="row">Accepted overpasses</th>
              <td>{moisture.accepted_overpasses}</td>
            </tr>
            <tr>
              <th scope="row">Latest observation</th>
              <td>{moisture.latest_observation ?? "Unavailable"}</td>
            </tr>
            <tr>
              <th scope="row">Nominal depth</th>
              <td>{moisture.depth_cm} cm</td>
            </tr>
            <tr>
              <th scope="row">Applied to near-term slot stress</th>
              <td>{smapAdjusted ? "Yes (drought-sensitive crops only)" : "No"}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
