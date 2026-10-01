// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CropCatalogResponse } from "@/lib/generated/contracts";
import { RecommendationForm } from "./recommendation-form";

const catalog = JSON.parse(readFileSync(resolve(process.cwd(), "../backend/data/punjab_crops.json"), "utf8")) as CropCatalogResponse;
afterEach(cleanup);
function setup() {
  const onSubmit = vi.fn();
  render(<RecommendationForm catalog={catalog} initialLocation={{ latitude: 31.4504, longitude: 73.135 }} submitting={false} onSubmit={onSubmit} />);
  return onSubmit;
}
function base() {
  fireEvent.change(screen.getByLabelText("Assessment date"), { target: { value: "2025-10-15" } });
  fireEvent.change(screen.getByLabelText("Slot 1 start"), { target: { value: "2025-11-01" } });
  fireEvent.change(screen.getByLabelText("Slot 1 end"), { target: { value: "2026-03-31" } });
}
function submit() { fireEvent.click(screen.getByRole("button", { name: "Get recommendations" })); }

describe("RecommendationForm", () => {
  it("emits a contract-shaped request and preserves numeric zero in a partial soil override", () => {
    const onSubmit = setup(); base();
    fireEvent.click(screen.getByLabelText("Add farmer soil observations"));
    fireEvent.change(screen.getByLabelText("Soil sample date"), { target: { value: "2025-10-01" } });
    fireEvent.change(screen.getByLabelText("pH"), { target: { value: "0" } });
    submit();
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      region_id: "punjab_pk_demo_v1", location: { latitude: 31.4504, longitude: 73.135 },
      assessment_end: "2025-10-15", slots: [{ slot_id: "slot_1", start_date: "2025-11-01", end_date: "2026-03-31" }],
      soil_override: { ph: 0, depth_top_cm: 0, depth_bottom_cm: 30 }, irrigation: "rainfed",
    });
    expect(onSubmit.mock.calls[0][0].soil_override.soc_g_kg).toBeUndefined();
  });

  it("requires location and valid ordered dates, with a hard four-slot cap", () => {
    const onSubmit = setup();
    fireEvent.change(screen.getByLabelText("Latitude"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Assessment date"), { target: { value: "2025-10-15" } });
    fireEvent.change(screen.getByLabelText("Slot 1 start"), { target: { value: "2025-11-01" } });
    fireEvent.change(screen.getByLabelText("Slot 1 end"), { target: { value: "2025-11-15" } });
    submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Add slot" }));
    fireEvent.click(screen.getByRole("button", { name: "Add slot" }));
    fireEvent.click(screen.getByRole("button", { name: "Add slot" }));
    expect(screen.getByRole("button", { name: "Add slot" })).toBeDisabled();
  });

  it("rejects unknown or unfinished history and incomplete texture", () => {
    const onSubmit = setup(); base();
    fireEvent.click(screen.getByRole("button", { name: "Add completed crop" }));
    fireEvent.change(screen.getByLabelText("History 1 start"), { target: { value: "2025-05-01" } });
    fireEvent.change(screen.getByLabelText("History 1 end"), { target: { value: "2025-09-30" } });
    submit();
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("History 1 crop"), { target: { value: "maize" } });
    fireEvent.click(screen.getByLabelText("Add farmer soil observations"));
    fireEvent.change(screen.getByLabelText("Soil sample date"), { target: { value: "2025-10-01" } });
    fireEvent.change(screen.getByLabelText("Sand (%)"), { target: { value: "50" } });
    submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/Sand, silt and clay must all/)).toBeInTheDocument();
  });

  it("disables the form while submitting", () => {
    render(<RecommendationForm catalog={catalog} initialLocation={null} submitting={true} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Submitting…" })).toBeDisabled();
  });
});
