import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const path = "http://localhost:3000/api/recommend-rotation";
const body = {
  location: { latitude: 31.4504, longitude: 73.135 },
  region_id: "punjab_pk_demo_v1", assessment_end: "2025-10-15",
  slots: [{ slot_id: "rabi_2025", start_date: "2025-11-01", end_date: "2026-03-31" }],
  crop_history: [], irrigation: "rainfed", data_mode: "auto", top_k: 3,
};

function post(value: unknown = body, signal?: AbortSignal): Request {
  return new Request(path, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value), signal });
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.BACKEND_BASE_URL;
  delete process.env.BACKEND_ALLOWED_UPSTREAM_ORIGINS;
});

describe("same-origin recommendation proxy", () => {
  it("maps only the supported GET region to the backend crops route", async () => {
    const fetcher = vi.fn(async (_url: URL, _init: RequestInit) => Response.json({ crops: [] }, { headers: { "X-Request-ID": "backend-id" } }));
    vi.stubGlobal("fetch", fetcher);
    const response = await GET(new Request(`${path}?region_id=punjab_pk_demo_v1`));
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Request-ID")).toBe("backend-id");
    expect(fetcher.mock.calls[0][0].toString()).toBe("http://127.0.0.1:8000/api/v1/crops?region_id=punjab_pk_demo_v1");
    expect((await GET(new Request(`${path}?region_id=other`))).status).toBe(422);
    expect((await GET(new Request(`${path}?region_id=punjab_pk_demo_v1&host=evil.example`))).status).toBe(422);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("validates and forwards POST JSON, status, and backend request ID", async () => {
    const fetcher = vi.fn(async (_url: URL, _init: RequestInit) => Response.json({ error: { code: "REQUIRED_DATA_UNAVAILABLE" } },
      { status: 503, headers: { "X-Request-ID": "upstream-id" } }));
    vi.stubGlobal("fetch", fetcher);
    const response = await POST(post());
    expect(response.status).toBe(503);
    expect(response.headers.get("X-Request-ID")).toBe("upstream-id");
    expect(fetcher.mock.calls[0][0].toString()).toBe("http://127.0.0.1:8000/api/v1/recommend-rotation");
    expect(fetcher.mock.calls[0][1]?.body).toBe(JSON.stringify(body));
    expect((await response.json()).error.code).toBe("REQUIRED_DATA_UNAVAILABLE");
  });

  it("rejects malformed, oversized, and schema-invalid requests before fetch", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect((await POST(post({ ...body, location: { latitude: 999, longitude: 0 } }))).status).toBe(422);
    expect((await POST(new Request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" }))).status).toBe(422);
    expect((await POST(new Request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: "x".repeat(65537) }))).status).toBe(413);
    expect((await POST(new Request(path, { method: "POST", body: "{}" }))).status).toBe(415);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("stops reading a chunked request at the body limit", async () => {
    let pulls = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new Uint8Array(8192));
        if (pulls === 100) controller.close();
      },
    });
    const request = new Request(path, { method: "POST", headers: { "Content-Type": "application/json" },
      body: stream, duplex: "half" } as RequestInit & { duplex: "half" });
    expect((await POST(request)).status).toBe(413);
    expect(pulls).toBeLessThan(100);
  });

  it("denies unapproved upstream origins and client host parameters", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    process.env.BACKEND_BASE_URL = "https://evil.example";
    expect((await POST(post())).status).toBe(500);
    process.env.BACKEND_BASE_URL = "http://127.0.0.1:8000";
    expect((await POST(new Request(`${path}?host=evil.example`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }))).status).toBe(422);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("propagates abort and does not follow redirects", async () => {
    const controller = new AbortController();
    const request = post(body, controller.signal);
    const fetcher = vi.fn(async (_url: URL, init: RequestInit) => {
      expect(init.signal).toBe(request.signal);
      expect(init.redirect).toBe("manual");
      controller.abort();
      throw new DOMException("Aborted", "AbortError");
    });
    vi.stubGlobal("fetch", fetcher);
    expect((await POST(request)).status).toBe(499);
  });
});
