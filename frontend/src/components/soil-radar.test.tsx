// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Soil } from "@/lib/generated/contracts";
import { SoilRadar } from "./soil-radar";

const radarData = vi.hoisted(() => vi.fn());
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  RadarChart: ({ data, children }: { data: unknown; children: React.ReactNode }) => { radarData(data); return <div>{children}</div>; },
  PolarGrid: () => null, PolarAngleAxis: () => null, PolarRadiusAxis: () => null, Tooltip: () => null, Radar: () => null,
}));
afterEach(() => { cleanup(); radarData.mockClear(); });
const soil: Soil = {
  depth_top_cm: 0, depth_bottom_cm: 30, ph: 7, soc_g_kg: 25, total_n_g_kg: 2,
  sand_pct: 45, silt_pct: 35, clay_pct: 20,
  field_sources: { ph: "farmer_input", soc_g_kg: "soilgrids", total_n_g_kg: "soilgrids",
    sand_pct: "farmer_input", silt_pct: "farmer_input", clay_pct: "farmer_input" },
};

describe("SoilRadar", () => {
  it("uses fixed display scales and preserves each raw value, unit, and source", () => {
    render(<SoilRadar soil={soil} />);
    const axes = radarData.mock.calls[0][0];
    expect(axes.map((axis: { display: number }) => axis.display)).toEqual([50, 50, 20, 45, 35, 20]);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(6);
    expect(within(rows[0]).getByText("7")).toBeInTheDocument();
    expect(within(rows[0]).getByText("farmer input")).toBeInTheDocument();
    expect(within(rows[1]).getByText("g/kg")).toBeInTheDocument();
    expect(within(rows[3]).getByText("%")).toBeInTheDocument();
    expect(screen.getByText(/Values above a display limit are capped/)).toBeInTheDocument();
  });

  it("omits every null axis and never synthesizes missing texture values", () => {
    const incomplete: Soil = { ...soil, ph: null, soc_g_kg: null, total_n_g_kg: null, silt_pct: null, clay_pct: null,
      field_sources: { ...soil.field_sources, ph: "unavailable", soc_g_kg: "unavailable", total_n_g_kg: "unavailable",
        silt_pct: "unavailable", clay_pct: "unavailable" } };
    render(<SoilRadar soil={incomplete} />);
    expect(radarData).not.toHaveBeenCalled();
    expect(screen.getByText(/Too few measured/)).toBeInTheDocument();
    expect(screen.getAllByText("Unavailable")).toHaveLength(5);
    expect(screen.getAllByText("unavailable")).toHaveLength(5);
    expect(screen.getByText("45")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("caps only the radar display axis while keeping the original value", () => {
    render(<SoilRadar soil={{ ...soil, soc_g_kg: 80 }} />);
    expect(radarData.mock.calls[0][0][1]).toMatchObject({ display: 100, raw: 80 });
    expect(screen.getByText("80")).toBeInTheDocument();
  });
});
