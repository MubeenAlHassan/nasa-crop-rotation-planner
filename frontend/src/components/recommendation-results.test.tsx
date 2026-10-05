// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Recommendation, Source } from "@/lib/generated/contracts";
import { formatPlannerNumber, RecommendationResults } from "./recommendation-results";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Bar: () => null,
}));

afterEach(cleanup);

const recommendation = {
  rotation_id: "rotation-1", rank: 1, score: 83.2,
  components: { nitrogen: 90, roots: 80, water: 75.12345, temperature: null, soil: 60 },
  effective_weights: { nitrogen: 0.3, roots: 0.2, water: 1 / 3, temperature: 0, soil: 0.2 },
  slots: [{ slot_id: "rabi_2025", crop_id: "wheat", crop_name: "Wheat", start_date: "2025-11-01", end_date: "2026-03-31" }],
  reasons: [{ code: "ROTATION_DIVERSITY", message: "Breaks the prior crop family." }],
} as Recommendation;

const sources = [
  { provider: "power", mode: "fixture", product: "POWER", fixture_id: "faisalabad_2025", retrieved_at: "2025-10-16T00:00:00Z" },
  { provider: "soilgrids", mode: "cache", product: "SoilGrids", fixture_id: null, retrieved_at: "2025-10-16T00:00:00Z" },
  { provider: "smap", mode: "unavailable", product: null, fixture_id: null, retrieved_at: null },
  { provider: "farmer_input", mode: "farmer_input", product: null, fixture_id: null, retrieved_at: null },
] as Source[];

describe("formatPlannerNumber", () => {
  it("keeps at least two decimal places", () => {
    expect(formatPlannerNumber(0.2777777777777778)).toBe("0.28");
    expect(formatPlannerNumber(90.00355518340896)).toBe("90.00");
    expect(formatPlannerNumber(43.5)).toBe("43.50");
  });
});

describe("RecommendationResults", () => {
  it("defaults to chart view and shows rounded table values after switching", () => {
    render(<RecommendationResults recommendations={[recommendation]} feasibleRotationCount={4} dataQuality="limited" sources={sources}
      warnings={[{ code: "SMAP_UNAVAILABLE", message: "SMAP is unavailable." }]}
      exclusions={[{ slot_id: "rabi_2025", crop_id: "maize", code: "CALENDAR_INCOMPATIBLE", message: "Outside planting window." }]} />);

    expect(screen.getByText("Rank 1: score 83.20")).toBeInTheDocument();
    expect(screen.getByText(/Feasible rotations: 4/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /component score chart for rank 1/i })).toBeInTheDocument();
    expect(screen.getByText("Component scores (0–100)")).toBeInTheDocument();
    expect(screen.getByText("Effective weights (%)")).toBeInTheDocument();
    expect(screen.getByText(/Unavailable components \(temperature\)/)).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: /rank 1/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^table$/i }));
    const table = screen.getByRole("table", { name: /rank 1/ });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(6);
    expect(within(rows[1]).getByText("90.00")).toBeInTheDocument();
    expect(within(rows[1]).getByText("0.30")).toBeInTheDocument();
    expect(within(rows[3]).getByText("75.12")).toBeInTheDocument();
    expect(within(rows[3]).getByText("0.33")).toBeInTheDocument();
    expect(within(rows[4]).getByText("Unavailable")).toBeInTheDocument();
    expect(within(rows[4]).getByText("0.00")).toBeInTheDocument();
    expect(screen.getByText("Breaks the prior crop family.")).toBeInTheDocument();
    expect(screen.getByText("SMAP is unavailable.")).toBeInTheDocument();
    expect(screen.getByText(/Outside planting window/)).toBeInTheDocument();
    expect(screen.getByText(/demo fixture faisalabad_2025/)).toBeInTheDocument();
    expect(screen.getByText("cache")).toHaveClass("rounded");
    expect(screen.getByText("unavailable")).toBeInTheDocument();
  });

  it("shows live provider mode as a provenance badge", () => {
    const live = [{ ...sources[0], mode: "live" as const, fixture_id: null }, ...sources.slice(1)];
    render(<RecommendationResults recommendations={[]} feasibleRotationCount={0} dataQuality="limited" sources={live} warnings={[]} exclusions={[]} />);
    expect(screen.getByText("live")).toHaveClass("rounded");
  });

  it("shows an explicit empty state without fabricating a recommendation", () => {
    render(<RecommendationResults recommendations={[]} feasibleRotationCount={0} dataQuality="limited" sources={sources} warnings={[]} exclusions={[]} />);
    expect(screen.getByRole("status")).toHaveTextContent("No feasible rotation was returned");
    expect(screen.queryByText(/Rank 1:/)).not.toBeInTheDocument();
  });
});
