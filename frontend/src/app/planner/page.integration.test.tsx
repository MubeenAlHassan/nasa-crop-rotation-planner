// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PlannerPage from "./page";

const leaf = vi.hoisted(() => {
  const map = { setView: vi.fn(), on: vi.fn(), remove: vi.fn() };
  map.setView.mockReturnValue(map);
  const tile = { on: vi.fn(), addTo: vi.fn() };
  tile.on.mockReturnValue(tile);
  return { map, tile, mapFactory: vi.fn(() => map), tileFactory: vi.fn(() => tile) };
});
vi.mock("leaflet", () => ({ default: { map: leaf.mapFactory, tileLayer: leaf.tileFactory },
  map: leaf.mapFactory, tileLayer: leaf.tileFactory }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

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
    render(<PlannerPage />);
    await screen.findByLabelText("Rotation request");
    fireEvent.click(screen.getByRole("button", { name: "Rainfed demo" }));
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
      soil_override: null, data_mode: "fixture", farmer_objective: "balanced", top_k: 3,
    });
    expect(screen.getByLabelText("Recommendation results")).toBeInTheDocument();
    expect(screen.getByText(/Rotation timeline, rank 1/)).toBeInTheDocument();
    expect(screen.getByLabelText("Climate observations and historical stress scenarios")).toBeInTheDocument();
    expect(screen.getByLabelText("Soil properties")).toBeInTheDocument();
    expect(screen.getByText(/Surface soil moisture is unavailable/)).toBeInTheDocument();
  });

  it("renders zero-result state without a timeline and can retry with irrigation", async () => {
    const response = structuredClone(samples[1]);
    response.status = "no_feasible_rotation";
    response.feasible_rotation_count = 0;
    response.recommendations = [];
    response.warnings.push({ code: "NO_FEASIBLE_ROTATION", message: "No feasible rotation." });
    const irrigated = structuredClone(samples[1]);
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("?region_id=")) return Response.json(catalog);
      if (url === "/api/recommend-rotation" && init?.method === "POST") {
        const body = JSON.parse(init.body as string) as { irrigation: string };
        return Response.json(body.irrigation === "available" ? irrigated : response);
      }
      throw new Error(`Unexpected same-origin path: ${url}`);
    });
    vi.stubGlobal("fetch", fetcher);
    render(<PlannerPage />);
    await screen.findByLabelText("Rotation request");
    fireEvent.click(screen.getByRole("button", { name: "Rainfed demo" }));
    expectPinnedFormFilled();
    expect(await screen.findByText(/No feasible rotation was returned/)).toBeInTheDocument();
    expect(screen.queryByText(/Rotation timeline, rank/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry with irrigation available" }));
    await screen.findByRole("heading", { name: "Ranked alternatives" });
    expect(screen.getByText(/Rotation timeline, rank 1/)).toBeInTheDocument();
    expect(screen.getByLabelText("Irrigation")).toHaveValue("available");
  });

  it("cancels a pending request on coordinate change and switches custom points to current data", async () => {
    const resolvers: Array<(response: Response) => void> = [];
    const fetcher = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes("?region_id=")) return Promise.resolve(Response.json(catalog));
      if (init?.method === "POST") {
        return new Promise<Response>((resolve) => { resolvers.push(resolve); });
      }
      return Promise.reject(new Error("Unexpected path"));
    });
    vi.stubGlobal("fetch", fetcher);
    render(<PlannerPage />);
    await screen.findByLabelText("Rotation request");
    fireEvent.click(screen.getByRole("button", { name: "Rainfed demo" }));
    expectPinnedFormFilled();
    await waitFor(() => expect(resolvers.length).toBe(1));
    const first = fetcher.mock.calls.find(([, init]) => init?.method === "POST");
    // Field map latitude change tries live irrigated climate first.
    fireEvent.change(screen.getAllByLabelText("Latitude")[0], { target: { value: "31.4505" } });
    expect(first?.[1]?.signal?.aborted).toBe(true);
    await waitFor(() => expect(resolvers.length).toBe(2));
    const secondBody = JSON.parse(
      fetcher.mock.calls.filter(([, init]) => init?.method === "POST").at(-1)![1]!.body as string,
    );
    expect(secondBody.irrigation).toBe("available");
    expect(secondBody.data_mode).toBe("auto");
    expect(secondBody.location).toEqual({ latitude: 31.4505, longitude: 73.135 });
    resolvers[0]!(Response.json(samples[1]));
    resolvers[1]!(Response.json({
      schema_version: "1.0.0",
      request_id: "00000000-0000-4000-8000-000000000099",
      error: {
        code: "REQUIRED_DATA_UNAVAILABLE",
        message: "Live providers are not configured.",
        retryable: true,
        details: [],
      },
    }, { status: 503 }));
    await screen.findByText(/Your farm inputs are unchanged/);
    expect(resolvers).toHaveLength(2);
    expect(screen.getByLabelText("Data mode")).toHaveValue("auto");
    expect(screen.getAllByLabelText("Latitude")[0]).toHaveValue(31.4505);
    expect(screen.queryByText(/Rotation timeline, rank/)).not.toBeInTheDocument();
    // Only an explicit action may switch the farm and submit a fixture request.
    fireEvent.click(screen.getByRole("button", { name: "Run Faisalabad demo instead" }));
    await waitFor(() => expect(resolvers).toHaveLength(3));
    const demoBody = JSON.parse(
      fetcher.mock.calls.filter(([, init]) => init?.method === "POST").at(-1)![1]!.body as string,
    );
    expect(demoBody.data_mode).toBe("fixture");
    expect(demoBody.location).toEqual({ latitude: 31.4504, longitude: 73.135 });
    expectPinnedFormFilled();
    expect(screen.getAllByLabelText("Latitude")[0]).toHaveValue(31.4504);
    resolvers[2]!(Response.json(samples[1]));
    await screen.findByRole("heading", { name: "Ranked alternatives" });
    expect(screen.getByLabelText("Data mode")).toHaveValue("fixture");
  });

  it("auto-runs irrigated recommendations when a custom place is chosen on the map form path", async () => {
    const fetcher = endpoint();
    render(<PlannerPage />);
    await screen.findByLabelText("Rotation request");
    fireEvent.click(screen.getByRole("button", { name: /Sahiwal/i }));
    await waitFor(() => {
      const posts = fetcher.mock.calls.filter(([url, init]) => url === "/api/recommend-rotation" && init?.method === "POST");
      expect(posts.length).toBeGreaterThanOrEqual(1);
      const body = JSON.parse(posts[posts.length - 1]![1]!.body as string);
      expect(body.irrigation).toBe("available");
      expect(body.data_mode).toBe("auto");
      expect(body.location).toEqual({ latitude: 30.6612, longitude: 73.1086 });
    });
  });

  it("keeps all farmer inputs after a failed form request and resends the same request on retry", async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("?region_id=")) return Response.json(catalog);
      if (url === "/api/recommend-rotation" && init?.method === "POST") return unavailable();
      throw new Error(`Unexpected path: ${url}`);
    });
    vi.stubGlobal("fetch", fetcher);
    render(<PlannerPage />);
    await screen.findByLabelText("Rotation request");
    expect(posts(fetcher)).toHaveLength(0);
    fillFarmInputs();
    fireEvent.click(screen.getByRole("button", { name: "Get recommendations" }));
    await screen.findByRole("button", { name: "Retry same request" });
    const original = posts(fetcher)[0];
    expect(original).toEqual(expectedFarmRequest);
    expectFarmInputs();
    expect(posts(fetcher)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Retry same request" }));
    await screen.findByRole("button", { name: "Retry same request" });
    expect(posts(fetcher)).toEqual([original, original]);
    expectFarmInputs();
    fireEvent.click(screen.getByRole("button", { name: "Get recommendations" }));
    await screen.findByRole("button", { name: "Retry same request" });
    expect(posts(fetcher)).toEqual([original, original, original]);
    expectFarmInputs();
  });

  it("does not authorize fixture mode just because the selected coordinates are Faisalabad", async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("?region_id=")) return Response.json(catalog);
      if (init?.method === "POST") return unavailable();
      throw new Error(`Unexpected path: ${url}`);
    });
    vi.stubGlobal("fetch", fetcher);
    render(<PlannerPage />);
    await screen.findByLabelText("Rotation request");
    fireEvent.change(screen.getAllByLabelText("Longitude")[0], { target: { value: "73.135" } });
    fireEvent.change(screen.getAllByLabelText("Latitude")[0], { target: { value: "31.4504" } });
    await screen.findByRole("button", { name: "Retry same request" });
    expect(posts(fetcher)).toHaveLength(1);
    expect(posts(fetcher)[0].data_mode).toBe("auto");
    fireEvent.change(screen.getByLabelText("Assessment date"), { target: { value: "2025-10-15" } });
    fireEvent.change(screen.getByLabelText("Slot 1 ID"), { target: { value: "rabi_2025" } });
    fireEvent.change(screen.getByLabelText("Slot 1 start"), { target: { value: "2025-11-01" } });
    fireEvent.change(screen.getByLabelText("Slot 1 end"), { target: { value: "2026-03-31" } });
    fireEvent.change(screen.getByLabelText("Data mode"), { target: { value: "fixture" } });
    fireEvent.click(screen.getByRole("button", { name: "Get recommendations" }));
    await screen.findByText(/Use the pinned Faisalabad demo action/);
    expect(posts(fetcher)).toHaveLength(1);
  });

  it("changes only irrigation for the pinned no-feasible retry, preserving edited soil and priorities", async () => {
    const empty = structuredClone(samples[1]);
    empty.status = "no_feasible_rotation";
    empty.feasible_rotation_count = 0;
    empty.recommendations = [];
    empty.warnings.push({ code: "NO_FEASIBLE_ROTATION", message: "No feasible rotation." });
    const fetcher = endpoint(empty);
    render(<PlannerPage />);
    await screen.findByLabelText("Rotation request");
    fireEvent.click(screen.getByRole("button", { name: "Rainfed demo" }));
    await screen.findByRole("button", { name: "Retry with irrigation available" });
    fireEvent.change(screen.getByLabelText("Farmer priority"), { target: { value: "soil_health" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Add farmer soil observations (local soil)" }));
    fireEvent.change(screen.getByLabelText("Soil sample date"), { target: { value: "2025-10-01" } });
    fireEvent.change(screen.getByLabelText("pH"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Get recommendations" }));
    await screen.findByRole("button", { name: "Retry with irrigation available" });
    const edited = posts(fetcher).at(-1);
    fireEvent.click(screen.getByRole("button", { name: "Retry with irrigation available" }));
    await screen.findByRole("button", { name: "Get recommendations" });
    expect(posts(fetcher).at(-1)).toEqual({ ...edited, irrigation: "available" });
    expect(screen.getByLabelText("Irrigation")).toHaveValue("available");
    expect(screen.getByLabelText("Farmer priority")).toHaveValue("soil_health");
    expect(screen.getByLabelText("pH")).toHaveValue(7);
    expect(screen.getByLabelText("Soil sample date")).toHaveValue("2025-10-01");
  });
});

function unavailable(): Response {
  return Response.json({
    schema_version: "1.0.0", request_id: "00000000-0000-4000-8000-000000000099",
    error: { code: "REQUIRED_DATA_UNAVAILABLE", message: "Live providers are not configured.", retryable: true, details: [] },
  }, { status: 503 });
}

function posts(fetcher: ReturnType<typeof endpoint>) {
  return fetcher.mock.calls.filter(([url, init]) => url === "/api/recommend-rotation" && init?.method === "POST")
    .map(([, init]) => JSON.parse(init!.body as string));
}

const expectedFarmRequest = {
  region_id: "punjab_pk_demo_v1", location: { latitude: 31.5, longitude: 73.2 },
  assessment_end: "2025-10-15", slots: [{ slot_id: "my_rabi", start_date: "2025-11-01", end_date: "2026-03-31" }],
  crop_history: [{ crop_id: "maize", start_date: "2025-05-01", end_date: "2025-09-30", residue_management: "removed" }],
  irrigation: "rainfed", farmer_objective: "soil_health", top_k: 2,
  allowed_crop_ids: ["wheat"], excluded_crop_ids: ["chickpea"], data_mode: "auto",
  soil_override: { sampled_on: "2025-10-01", depth_top_cm: 0, depth_bottom_cm: 30,
    ph: 7, soc_g_kg: 8, total_n_g_kg: 0.8, sand_pct: 40, silt_pct: 35, clay_pct: 25 },
};

function fillFarmInputs(): void {
  const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
  change("Assessment date", "2025-10-15");
  change("Slot 1 ID", "my_rabi"); change("Slot 1 start", "2025-11-01"); change("Slot 1 end", "2026-03-31");
  fireEvent.click(screen.getByRole("button", { name: "Add completed crop" }));
  change("History 1 crop", "maize"); change("History 1 start", "2025-05-01"); change("History 1 end", "2025-09-30");
  change("History 1 residues", "removed"); change("Irrigation", "rainfed"); change("Farmer priority", "soil_health");
  change("Alternatives", "2"); change("Allowed crops", "wheat"); change("Excluded crops", "chickpea");
  fireEvent.click(screen.getByRole("checkbox", { name: "Add farmer soil observations (local soil)" }));
  change("Soil sample date", "2025-10-01"); change("pH", "7"); change("Soil organic carbon (g/kg)", "8");
  change("Total nitrogen (g/kg)", "0.8"); change("Sand (%)", "40"); change("Silt (%)", "35"); change("Clay (%)", "25");
  // Coordinate edits after all other inputs must not reset those inputs.
  fireEvent.change(screen.getAllByLabelText("Latitude")[1], { target: { value: "31.5" } });
  fireEvent.change(screen.getAllByLabelText("Longitude")[1], { target: { value: "73.2" } });
}

function expectFarmInputs(): void {
  expect(screen.getAllByLabelText("Latitude")[1]).toHaveValue(31.5);
  expect(screen.getAllByLabelText("Longitude")[1]).toHaveValue(73.2);
  expect(screen.getByLabelText("Assessment date")).toHaveValue("2025-10-15");
  expect(screen.getByLabelText("Slot 1 ID")).toHaveValue("my_rabi");
  expect(screen.getByLabelText("Slot 1 start")).toHaveValue("2025-11-01");
  expect(screen.getByLabelText("Slot 1 end")).toHaveValue("2026-03-31");
  expect(screen.getByLabelText("History 1 crop")).toHaveValue("maize");
  expect(screen.getByLabelText("History 1 start")).toHaveValue("2025-05-01");
  expect(screen.getByLabelText("History 1 end")).toHaveValue("2025-09-30");
  expect(screen.getByLabelText("History 1 residues")).toHaveValue("removed");
  expect(screen.getByLabelText("Irrigation")).toHaveValue("rainfed");
  expect(screen.getByLabelText("Farmer priority")).toHaveValue("soil_health");
  expect(screen.getByLabelText("Alternatives")).toHaveValue("2");
  expect(screen.getByLabelText("Allowed crops")).toHaveValue(["wheat"]);
  expect(screen.getByLabelText("Excluded crops")).toHaveValue(["chickpea"]);
  expect(screen.getByLabelText("Data mode")).toHaveValue("auto");
  expect(screen.getByLabelText("Soil sample date")).toHaveValue("2025-10-01");
  for (const [label, value] of [["pH", 7], ["Soil organic carbon (g/kg)", 8], ["Total nitrogen (g/kg)", 0.8], ["Sand (%)", 40], ["Silt (%)", 35], ["Clay (%)", 25]] as const) {
    expect(screen.getByLabelText(label)).toHaveValue(value);
  }
}
