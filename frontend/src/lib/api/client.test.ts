import { readFileSync } from "node:fs";
import { describe, expect, it, vi, afterEach } from "vitest";

import {
  ApiError,
  fetchCropCatalog,
  recommendRotation,
  validateCropCatalogResponse,
  validateRecommendationResponse,
} from "./client";

const markdown = readFileSync(new URL("../../../../agent_docs/DATA_SCHEMA.md", import.meta.url), "utf8");
const samples = [...markdown.matchAll(/```json\n([\s\S]*?)\n```/g)].map((match) => JSON.parse(match[1]));
const catalog = JSON.parse(readFileSync(
  new URL("../../../../backend/data/punjab_crops.json", import.meta.url), "utf8",
));

function requestPayload() {
  return structuredClone(samples[0]);
}

function responsePayload() {
  return structuredClone(samples[1]);
}

afterEach(() => vi.unstubAllGlobals());

describe("generated schema validators", () => {
  it("accepts documented success and the verified crop catalog", () => {
    const response = validateRecommendationResponse(responsePayload());
    expect(response.features.moisture.surface_m3_m3).toBeNull();
    expect(response.sources).toHaveLength(4);
    const crops = validateCropCatalogResponse(catalog);
    expect(crops.catalog_version).toBe("1.0.1");
    expect(crops.crops.map((crop) => crop.crop_id)).toEqual(["wheat", "chickpea", "maize"]);
  });

  it("rejects missing, extra, nonfinite, and inconsistent response fields", () => {
    const missing = responsePayload();
    delete missing.features.moisture.surface_m3_m3;
    expect(() => validateRecommendationResponse(missing)).toThrow(ApiError);
    const extra = responsePayload();
    extra.extra = true;
    expect(() => validateRecommendationResponse(extra)).toThrow(ApiError);
    const badNumber = responsePayload();
    badNumber.features.climate.rainfall_coverage = Number.POSITIVE_INFINITY;
    expect(() => validateRecommendationResponse(badNumber)).toThrow(ApiError);
    const badSource = responsePayload();
    badSource.sources[1].provider = "power";
    expect(() => validateRecommendationResponse(badSource)).toThrow(ApiError);
    const badWeight = responsePayload();
    badWeight.recommendations[0].effective_weights.water = 0.6;
    expect(() => validateRecommendationResponse(badWeight)).toThrow(ApiError);
    const badEnum = responsePayload();
    badEnum.warnings[0].code = "UNRECOGNIZED";
    expect(() => validateRecommendationResponse(badEnum)).toThrow(ApiError);
    const misplacedCode = responsePayload();
    misplacedCode.warnings[0].code = "ROTATION_DIVERSITY";
    expect(() => validateRecommendationResponse(misplacedCode)).toThrow(ApiError);
  });

  it("distinguishes required null from missing and rejects inconsistent catalog traits", () => {
    const value = responsePayload();
    value.features.soil.ph = null;
    value.features.soil.field_sources.ph = "unavailable";
    expect(validateRecommendationResponse(value).features.soil.ph).toBeNull();
    delete value.features.soil.ph;
    expect(() => validateRecommendationResponse(value)).toThrow(ApiError);
    const repeated = structuredClone(catalog);
    repeated.crops[1].crop_id = repeated.crops[0].crop_id;
    expect(() => validateCropCatalogResponse(repeated)).toThrow(ApiError);
    const invalidWindow = structuredClone(catalog);
    invalidWindow.crops[0].planting_windows[0].start_mmdd = "0229";
    expect(() => validateCropCatalogResponse(invalidWindow)).toThrow(ApiError);
  });
});

describe("same-origin client", () => {
  it("posts a validated request and validates the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(responsePayload()), {
      status: 200, headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const signal = new AbortController().signal;
    const result = await recommendRotation(requestPayload(), signal);
    expect(result.status).toBe("degraded");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe("/api/recommend-rotation");
    expect(init.method).toBe("POST");
    expect(init.signal).toBe(signal);
    expect(JSON.parse(init.body)).toEqual(requestPayload());
    expect(path).not.toContain("localhost");
  });

  it("gets the catalog through the same-origin proxy", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(catalog), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchCropCatalog("punjab_pk_demo_v1");
    expect(result.crops).toHaveLength(3);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/recommend-rotation?region_id=punjab_pk_demo_v1");
  });

  it("rejects a validly shaped response for the wrong requested point", async () => {
    const wrongPoint = responsePayload();
    wrongPoint.location.latitude = 30.0;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(wrongPoint), { status: 200 })));
    await expect(recommendRotation(requestPayload())).rejects.toMatchObject({ status: 200, envelope: null });
  });

  it("rejects invalid requests before fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const value = requestPayload();
    value.extra = "unexpected";
    await expect(recommendRotation(value)).rejects.toMatchObject({ status: 0, envelope: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves a strict typed error envelope and HTTP status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(samples[2]), {
      status: 422,
    })));
    await expect(recommendRotation(requestPayload())).rejects.toMatchObject({
      status: 422,
      envelope: { error: { code: "VALIDATION_ERROR", retryable: false } },
    });
  });

  it("handles malformed error/success JSON and invalid success schemas", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{", { status: 200 })));
    await expect(recommendRotation(requestPayload())).rejects.toMatchObject({ status: 200, envelope: null });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 503 })));
    await expect(recommendRotation(requestPayload())).rejects.toMatchObject({ status: 503, envelope: null });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
    await expect(recommendRotation(requestPayload())).rejects.toMatchObject({ status: 200, envelope: null });
  });

  it("propagates cancellation and types transport failures", async () => {
    const abort = new DOMException("aborted", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abort));
    await expect(recommendRotation(requestPayload(), new AbortController().signal)).rejects.toBe(abort);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(fetchCropCatalog("punjab_pk_demo_v1")).rejects.toMatchObject({
      status: 0, envelope: null,
    });
  });
});
