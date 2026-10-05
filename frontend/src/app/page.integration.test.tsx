// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HomePage from "./page";

const leaf = vi.hoisted(() => {
  const map = { setView: vi.fn(), on: vi.fn(), remove: vi.fn() };
  map.setView.mockReturnValue(map);
  const tile = { on: vi.fn(), addTo: vi.fn() };
  tile.on.mockReturnValue(tile);
  return { map, tile, mapFactory: vi.fn(() => map), tileFactory: vi.fn(() => tile) };
});
vi.mock("leaflet", () => ({ default: { map: leaf.mapFactory, tileLayer: leaf.tileFactory },
  map: leaf.mapFactory, tileLayer: leaf.tileFactory }));

const catalog = JSON.parse(readFileSync(resolve(process.cwd(), "../backend/data/punjab_crops.json"), "utf8"));
const samples = [...readFileSync(resolve(process.cwd(), "../agent_docs/DATA_SCHEMA.md"), "utf8")
  .matchAll(/```json\n([\s\S]*?)\n```/g)].map((match) => JSON.parse(match[1]));

function endpoint(response = structuredClone(samples[1])) {
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("?region_id=")) return Response.json(catalog);
    if (url === "/api/recommend-rotation" && init?.method === "POST") return Response.json(response);
    throw new Error(`Unexpected same-origin path: ${url}`);
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

function expectPinnedFormFilled(): void {
  expect(screen.getByLabelText("Assessment date")).toHaveValue("2025-10-15");
  expect(screen.getByLabelText("Slot 1 ID")).toHaveValue("rabi_2025");
  expect(screen.getByLabelText("Slot 1 start")).toHaveValue("2025-11-01");
  expect(screen.getByLabelText("Slot 1 end")).toHaveValue("2026-03-31");
  expect(screen.getByLabelText("Data mode")).toHaveValue("fixture");
  expect(screen.getByLabelText("History 1 crop")).toHaveValue("maize");
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("farmer dashboard integration", () => {
  it("runs the pinned demo on button click, sends exact contract JSON, and renders every returned panel and warning", async () => {
    const fetcher = endpoint();
    render(<HomePage />);
    await screen.findByLabelText("Rotation request");
    fireEvent.click(screen.getByRole("button", { name: "Use pinned Faisalabad demo" }));
    expectPinnedFormFilled();
    await screen.findByRole("heading", { name: "Ranked alternatives" });
    const post = fetcher.mock.calls.find(([url]) => url === "/api/recommend-rotation");
    expect(post).toBeDefined();
    expect(JSON.parse(post![1]!.body as string)).toEqual({
      region_id: "punjab_pk_demo_v1", location: { latitude: 31.4504, longitude: 73.135 },
      assessment_end: "2025-10-15",
      slots: [{ slot_id: "rabi_2025", start_date: "2025-11-01", end_date: "2026-03-31" }],
      crop_history: [{ crop_id: "maize", start_date: "2025-05-01", end_date: "2025-09-30", residue_management: "retained" }],
      irrigation: "rainfed", allowed_crop_ids: [], excluded_crop_ids: [],
      soil_override: null, data_mode: "fixture", top_k: 3,
    });
    expect(screen.getByLabelText("Recommendation results")).toBeInTheDocument();
    expect(screen.getByText(/Rotation timeline, rank 1/)).toBeInTheDocument();
    expect(screen.getByLabelText("Climate observations and historical stress scenarios")).toBeInTheDocument();
    expect(screen.getByLabelText("Soil properties")).toBeInTheDocument();
    expect(screen.getByText(/Surface soil moisture is unavailable/)).toBeInTheDocument();
  });

  it("renders zero-result state without a timeline", async () => {
    const response = structuredClone(samples[1]);
    response.status = "no_feasible_rotation";
    response.feasible_rotation_count = 0;
    response.recommendations = [];
    response.warnings.push({ code: "NO_FEASIBLE_ROTATION", message: "No feasible rotation." });
    endpoint(response);
    render(<HomePage />);
    await screen.findByLabelText("Rotation request");
    fireEvent.click(screen.getByRole("button", { name: "Use pinned Faisalabad demo" }));
    expectPinnedFormFilled();
    expect(await screen.findByText(/No feasible rotation was returned/)).toBeInTheDocument();
    expect(screen.queryByText(/Rotation timeline, rank/)).not.toBeInTheDocument();
  });

  it("cancels a pending request on coordinate change and denies fixture data to nearby points", async () => {
    let resolvePost: ((response: Response) => void) | undefined;
    const fetcher = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes("?region_id=")) return Promise.resolve(Response.json(catalog));
      if (init?.method === "POST") return new Promise<Response>((resolve) => { resolvePost = resolve; });
      return Promise.reject(new Error("Unexpected path"));
    });
    vi.stubGlobal("fetch", fetcher);
    render(<HomePage />);
    await screen.findByLabelText("Rotation request");
    fireEvent.click(screen.getByRole("button", { name: "Use pinned Faisalabad demo" }));
    expectPinnedFormFilled();
    await waitFor(() => expect(resolvePost).toBeDefined());
    const first = fetcher.mock.calls.find(([, init]) => init?.method === "POST");
    fireEvent.change(screen.getAllByLabelText("Latitude")[0], { target: { value: "31.4505" } });
    expect(first?.[1]?.signal?.aborted).toBe(true);
    resolvePost!(Response.json(samples[1]));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Ranked alternatives" })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Get recommendations" }));
    expect(await screen.findByText(/Use the pinned Faisalabad demo action/)).toBeInTheDocument();
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  });
});
