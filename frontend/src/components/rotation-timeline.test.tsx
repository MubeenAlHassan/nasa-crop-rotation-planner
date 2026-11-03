// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Recommendation } from "@/lib/generated/contracts";
import { RotationTimeline } from "./rotation-timeline";

afterEach(cleanup);
const first = { slot_id: "rabi_2025", crop_id: "wheat", crop_name: "Wheat", start_date: "2025-11-01", end_date: "2026-03-31" };
function recommendation(slots: Recommendation["slots"]): Recommendation {
  return { rotation_id: "rotation-1", rank: 1, slots } as Recommendation;
}

describe("RotationTimeline", () => {
  it("renders a one-slot rotation with the exact returned dates", () => {
    render(<RotationTimeline recommendation={recommendation([first])} />);
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(2);
    expect(within(rows[1]).getByText("2025-11-01")).toBeInTheDocument();
    expect(within(rows[1]).getByText("2026-03-31")).toBeInTheDocument();
    expect(screen.getByText("rabi 2025")).toBeInTheDocument();
  });

  it("keeps four slots in the API's order without recalculating their dates", () => {
    const slots: Recommendation["slots"] = [
      first,
      { slot_id: "kharif_2026", crop_id: "maize", crop_name: "Maize", start_date: "2026-05-01", end_date: "2026-09-30" },
      { slot_id: "rabi_2026", crop_id: "chickpea", crop_name: "Chickpea", start_date: "2026-11-05", end_date: "2027-03-15" },
      { slot_id: "kharif_2027", crop_id: "maize", crop_name: "Maize", start_date: "2027-05-02", end_date: "2027-09-29" },
    ];
    render(<RotationTimeline recommendation={recommendation(slots)} />);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(4);
    expect(rows.map((row) => within(row).getAllByRole("cell")[0].textContent)).toEqual(["Wheat", "Maize", "Chickpea", "Maize"]);
    expect(rows.map((row) => within(row).getAllByRole("cell")[1].textContent)).toEqual(slots.map((slot) => slot.start_date));
  });
});
