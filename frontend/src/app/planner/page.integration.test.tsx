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

type RequestLike = {
  location: { latitude: number; longitude: number };
  slots: Array<{ slot_id: string; start_date: string; end_date: string }>;
};

/** Mirror the backend contract: a response must echo the requested location and slots. */
function echo(template: Record<string, unknown>, request: RequestLike) {
  const response = structuredClone(template) as {
    location: RequestLike["location"];
    features: { slot_scenarios: Array<{ slot_id: string }> };
    recommendations: Array<{ slots: Array<{ slot_id: string; start_date: string; end_date: string }> }>;
  };
  response.location = request.location;
  response.features.slot_scenarios = response.features.slot_scenarios.map((scenario, index) => ({
    ...scenario, slot_id: request.slots[index]?.slot_id ?? scenario.slot_id,
  }));
  response.recommendations = response.recommendations.map((recommendation) => ({
    ...recommendation,
    slots: recommendation.slots.map((slot, index) => ({
      ...slot,
      slot_id: request.slots[index]?.slot_id ?? slot.slot_id,
      start_date: request.slots[index]?.start_date ?? slot.start_date,
      end_date: request.slots[index]?.end_date ?? slot.end_date,
    })),
  }));
  return response;
}

function endpoint(template: Record<string, unknown> = samples[1]) {
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("?region_id=")) return Response.json(catalog);
    if (url === "/api/recommend-rotation" && init?.method === "POST") {
      return Response.json(echo(template, JSON.parse(init.body as string) as RequestLike));
    }
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

const SAHIWAL = { latitude: 30.6612, longitude: 73.1086 };
const FAISALABAD = { latitude: 31.4504, longitude: 73.135 };
const RESULTS_HEADING = { name: "Best next crops" };

/** Navigate from results to the field step and arm the pinned Faisalabad rainfed fixture demo. */
function startPinnedRainfedDemo(): void {
  fireEvent.click(screen.getByRole("button", { name: "Change field" }));
  // Preset chips render as list items inside the "Saved fields" list, so match by text.
  fireEvent.click(screen.getByText(/^Faisalabad/, { selector: "button" }));
  fireEvent.click(screen.getByRole("button", { name: "Rainfed demo" }));
}

describe("farmer dashboard integration", () => {
  it("opens on the Sahiwal live field by default and renders tabbed results", async () => {
    const fetcher = endpoint();
    render(<PlannerPage />);
    await screen.findByRole("heading", RESULTS_HEADING);
    expect(posts(fetcher)).toHaveLength(1);
    const body = posts(fetcher)[0];
    expect(body.region_id).toBe("punjab_pk_demo_v1");
    expect(body.location).toEqual(SAHIWAL);
    expect(body.irrigation).toBe("available");
    expect(body.data_mode).toBe("auto");
    expect(body.farmer_objective).toBe("climate_adaptation");
    expect(body.slots).toHaveLength(1);
    expect(screen.getByLabelText("Recommendation results")).toBeInTheDocument();
    expect(screen.getByText(/Rotation timeline, rank 1/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Weather & climate" }));
    expect(screen.getByLabelText("Climate observations and historical stress scenarios")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Soil & water" }));
    expect(screen.getByLabelText("Soil properties")).toBeInTheDocument();
    expect(screen.getByLabelText("Surface moisture context")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Data notes" }));
    expect(screen.getByLabelText("Data provenance")).toBeInTheDocument();
    // The plan form mirrors the default field even though it is on another step.
    expect(screen.getAllByLabelText("Latitude")[1]).toHaveValue(SAHIWAL.latitude);
    expect(screen.getAllByLabelText("Longitude")[1]).toHaveValue(SAHIWAL.longitude);
    expect(screen.getByLabelText("Data mode")).toHaveValue("auto");
  });

  it("runs the pinned Faisalabad fixture only through the explicit demo action and sends exact contract JSON", async () => {
    const fetcher = endpoint();
    render(<PlannerPage />);
    await screen.findByRole("heading", RESULTS_HEADING);
    startPinnedRainfedDemo();
    expectPinnedFormFilled();
    await waitFor(() => expect(posts(fetcher)).toHaveLength(2));
    expect(posts(fetcher)[1]).toEqual({
      region_id: "punjab_pk_demo_v1", location: FAISALABAD,
      assessment_end: "2025-10-15",
      slots: [{ slot_id: "rabi_2025", start_date: "2025-11-01", end_date: "2026-03-31" }],
      crop_history: [{ crop_id: "maize", start_date: "2025-05-01", end_date: "2025-09-30", residue_management: "retained" }],
      irrigation: "rainfed", allowed_crop_ids: [], excluded_crop_ids: [],
      soil_override: null, data_mode: "fixture", farmer_objective: "balanced", top_k: 3,
    });
    await screen.findByRole("heading", RESULTS_HEADING);
    expect(screen.getByText(/Rotation timeline, rank 1/)).toBeInTheDocument();
  });

  it("renders zero-result state without a timeline and can retry with irrigation", async () => {
    const response = structuredClone(samples[1]);
    response.status = "no_feasible_rotation";
    response.feasible_rotation_count = 0;
    response.recommendations = [];
    response.warnings.push({ code: "NO_FEASIBLE_ROTATION", message: "No feasible rotation." });
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("?region_id=")) return Response.json(catalog);
      if (url === "/api/recommend-rotation" && init?.method === "POST") {
        const body = JSON.parse(init.body as string) as RequestLike & { irrigation: string };
        return Response.json(echo(body.irrigation === "available" ? samples[1] : response, body));
      }
      throw new Error(`Unexpected same-origin path: ${url}`);
    });
    vi.stubGlobal("fetch", fetcher);
    render(<PlannerPage />);
    await screen.findByRole("heading", RESULTS_HEADING);
    startPinnedRainfedDemo();
    expectPinnedFormFilled();
    expect(await screen.findByText("No crop works with these settings")).toBeInTheDocument();
    expect(screen.queryByText(/Rotation timeline, rank/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try with irrigation available" }));
    await screen.findByRole("heading", RESULTS_HEADING);
    expect(screen.getByText(/Rotation timeline, rank 1/)).toBeInTheDocument();
    expect(screen.getByLabelText("Irrigation")).toHaveValue("available");
  });

  it("cancels a pending request on map coordinate change and keeps custom points on current data", async () => {
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
    // Default Sahiwal live request is in flight.
    await waitFor(() => expect(resolvers.length).toBe(1));
    const first = fetcher.mock.calls.find(([, init]) => init?.method === "POST");
    const bodyOf = (index: number) => posts(fetcher)[index] as RequestLike;
    fireEvent.click(screen.getByRole("button", { name: "Change field" }));
    // Field map latitude change tries live irrigated climate for the new point.
    fireEvent.change(screen.getAllByLabelText("Latitude")[0], { target: { value: "31.4505" } });
    expect(first?.[1]?.signal?.aborted).toBe(true);
    await waitFor(() => expect(resolvers.length).toBe(2));
    const secondBody = posts(fetcher).at(-1);
    expect(secondBody.irrigation).toBe("available");
    expect(secondBody.data_mode).toBe("auto");
    expect(secondBody.location).toEqual({ latitude: 31.4505, longitude: SAHIWAL.longitude });
    resolvers[0]!(Response.json(echo(samples[1], bodyOf(0))));
    resolvers[1]!(unavailable());
    await screen.findByText(/Your farm inputs are unchanged/);
    expect(resolvers).toHaveLength(2);
    expect(screen.getByLabelText("Data mode")).toHaveValue("auto");
    expect(screen.getAllByLabelText("Latitude")[0]).toHaveValue(31.4505);
    expect(screen.queryByText(/Rotation timeline, rank/)).not.toBeInTheDocument();
    // Only an explicit action may switch the farm and submit a fixture request.
    fireEvent.click(screen.getByRole("button", { name: "Run Faisalabad demo instead" }));
    await waitFor(() => expect(resolvers).toHaveLength(3));
    const demoBody = posts(fetcher).at(-1);
    expect(demoBody.data_mode).toBe("fixture");
    expect(demoBody.location).toEqual(FAISALABAD);
    expectPinnedFormFilled();
    expect(screen.getAllByLabelText("Latitude")[0]).toHaveValue(FAISALABAD.latitude);
    resolvers[2]!(Response.json(echo(samples[1], bodyOf(2))));
    await screen.findByRole("heading", RESULTS_HEADING);
    expect(screen.getByLabelText("Data mode")).toHaveValue("fixture");
  });

  it("keeps all farmer inputs across steps after a failed form request and resends the same request on retry", async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("?region_id=")) return Response.json(catalog);
      if (url === "/api/recommend-rotation" && init?.method === "POST") return unavailable();
      throw new Error(`Unexpected path: ${url}`);
    });
    vi.stubGlobal("fetch", fetcher);
    render(<PlannerPage />);
    // The default Sahiwal live run fails honestly and offers a retry.
    await screen.findByText(/Your farm inputs are unchanged/);
    expect(posts(fetcher)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Adjust plan" }));
    fillFarmInputs();
    fireEvent.click(screen.getByRole("button", { name: "Get recommendations" }));
    await screen.findByRole("button", { name: "Retry same request" });
    const original = posts(fetcher)[1];
    expect(original).toEqual(expectedFarmRequest);
    expectFarmInputs();
    expect(posts(fetcher)).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Retry same request" }));
    await waitFor(() => expect(posts(fetcher)).toHaveLength(3));
    expect(posts(fetcher).slice(1)).toEqual([original, original]);
    // Switching steps must not reset any farmer input.
    fireEvent.click(screen.getByRole("button", { name: "Adjust plan" }));
    expectFarmInputs();
    fireEvent.click(screen.getByRole("button", { name: "Get recommendations" }));
    await waitFor(() => expect(posts(fetcher)).toHaveLength(4));
    expect(posts(fetcher).slice(1)).toEqual([original, original, original]);
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
    await screen.findByText(/Your farm inputs are unchanged/);
    expect(posts(fetcher)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Adjust plan" }));
    fireEvent.change(screen.getAllByLabelText("Longitude")[1], { target: { value: "73.135" } });
    fireEvent.change(screen.getAllByLabelText("Latitude")[1], { target: { value: "31.4504" } });
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
    await screen.findByText("No crop works with these settings");
    // The default Sahiwal run is already irrigated, so no irrigation retry is offered.
    expect(screen.queryByRole("button", { name: "Try with irrigation available" })).not.toBeInTheDocument();
    startPinnedRainfedDemo();
    await screen.findByRole("button", { name: "Try with irrigation available" });
    fireEvent.click(screen.getByRole("button", { name: "Adjust plan" }));
    fireEvent.change(screen.getByLabelText("Farmer priority"), { target: { value: "soil_health" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Add farmer soil observations (local soil)" }));
    fireEvent.change(screen.getByLabelText("Soil sample date"), { target: { value: "2025-10-01" } });
    fireEvent.change(screen.getByLabelText("pH"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Get recommendations" }));
    await screen.findByRole("button", { name: "Try with irrigation available" });
    const edited = posts(fetcher).at(-1);
    const before = posts(fetcher).length;
    fireEvent.click(screen.getByRole("button", { name: "Try with irrigation available" }));
    await waitFor(() => expect(posts(fetcher)).toHaveLength(before + 1));
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
