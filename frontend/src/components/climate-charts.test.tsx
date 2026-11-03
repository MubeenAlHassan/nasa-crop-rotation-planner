// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Climate, SlotScenario } from "@/lib/generated/contracts";
import { ClimateCharts } from "./climate-charts";

const charts = vi.hoisted(() => vi.fn());
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ data, children }: { data: unknown; children: React.ReactNode }) => { charts(data); return <div>{children}</div>; },
  CartesianGrid: () => null, XAxis: () => null, YAxis: () => null, Tooltip: () => null, Legend: () => null, Bar: () => null,
}));
afterEach(() => { cleanup(); charts.mockClear(); });
const climate: Climate = {
  window_start: "2025-07-18", window_end: "2025-10-15", baseline_start_year: 1991, baseline_end_year: 2020,
  rainfall_observed_mm: 120, rainfall_baseline_mm: 100, rainfall_anomaly_pct: 20, rainfall_band: "wet",
  rainfall_coverage: 1, rainfall_baseline_years: 30, temperature_observed_c: 24.5, temperature_baseline_c: 26,
  temperature_anomaly_c: -1.5, heat_band: "normal", temperature_coverage: 1, temperature_baseline_years: 30,
};
const scenario: SlotScenario = { slot_id: "rabi_2025", kind: "historical_stress_scenario", rainfall_mm: 180,
  temperature_c: 19, rainfall_baseline_years: 30, temperature_baseline_years: 30, smap_adjustment_applied: false };

describe("ClimateCharts", () => {
  it("shows units, signed anomalies, bands, dated observation context and a raw data table", () => {
    render(<ClimateCharts climate={climate} scenarios={[scenario]} />);
    expect(screen.getAllByText(/2025-07-18 to 2025-10-15/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("+20 %").length).toBeGreaterThan(0);
    expect(screen.getAllByText("-1.5 °C").length).toBeGreaterThan(0);
    expect(screen.getByText(/band: wet/)).toBeInTheDocument();
    expect(screen.getByText("historical stress scenario")).toBeInTheDocument();
    const table = screen.getByRole("table", { name: /Accessible observed/ });
    expect(within(table).getByText("120 mm")).toBeInTheDocument();
    expect(within(table).getByText("24.5 °C")).toBeInTheDocument();
    expect(charts).toHaveBeenCalledTimes(2);
    expect(charts.mock.calls[0][0]).toEqual([{ period: "Previous 90 days", observed: 120, baseline: 100 }]);
  });

  it("keeps missing values null in chart data and labels them unavailable", () => {
    render(<ClimateCharts climate={{ ...climate, rainfall_observed_mm: null, rainfall_anomaly_pct: null, rainfall_band: "unknown" }}
      scenarios={[{ ...scenario, rainfall_mm: null }]} />);
    expect(charts.mock.calls[0][0][0].observed).toBeNull();
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText(/forecast/i)).not.toBeInTheDocument();
  });
});
