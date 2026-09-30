/** Browser-only, same-origin API boundary for the generated 1.0.0 contract. */

import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import type { ValidateFunction } from "ajv";

import documentSchema from "../generated/contracts.schema.json";
import type {
  CropCatalogResponse,
  ErrorEnvelope,
  RecommendationRequest,
  RecommendationResponse,
} from "../generated/contracts";

const SCHEMA_ID = "https://field-shift.local/contracts/1.0.0.json";
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
ajv.addSchema(documentSchema);

function validator<T>(name: string): ValidateFunction<T> {
  const compiled = ajv.getSchema<T>(`${SCHEMA_ID}#/$defs/${name}`);
  if (!compiled) {
    throw new Error(`Missing generated schema definition: ${name}`);
  }
  return compiled;
}

const isRecommendationResponse = validator<RecommendationResponse>("RecommendationResponse");
const isCropCatalogResponse = validator<CropCatalogResponse>("CropCatalogResponse");
const isRecommendationRequest = validator<RecommendationRequest>("RecommendationRequest");
const isErrorEnvelope = validator<ErrorEnvelope>("ErrorEnvelope");
const reasonCodes = new Set([
  "LEGUME_AFTER_HIGH_DEMAND", "LEGUME_BEFORE_HIGH_DEMAND", "ROOT_DEPTH_ALTERNATION",
  "WATER_STRESS_TOLERANCE", "SEASONAL_CLIMATE_FIT", "SOIL_PH_FIT",
  "LIMITED_RESIDUE_BENEFIT", "ROTATION_DIVERSITY",
]);
const warningCodes = new Set([
  "DEMO_FIXTURE", "SOURCE_STALE", "SOILGRIDS_UNAVAILABLE", "SMAP_UNAVAILABLE",
  "SMAP_PERCENTILE_UNAVAILABLE", "CLIMATE_COVERAGE_LOW", "BASELINE_TOO_DRY",
  "HISTORY_UNKNOWN", "SOIL_SCREEN_INCOMPLETE", "PARTIAL_COMPONENT_COVERAGE",
  "SOIL_TEXTURE_INCONSISTENT", "NO_FEASIBLE_ROTATION",
]);

export class ApiError extends Error {
  readonly status: number;
  readonly envelope: ErrorEnvelope | null;

  constructor(message: string, status: number, envelope: ErrorEnvelope | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.envelope = envelope;
  }
}

function invalid(message: string): never {
  throw new ApiError(message, 0, null);
}

function validateRecommendationInvariants(value: RecommendationResponse): void {
  const providers = value.sources.map((source) => source.provider);
  if (
    providers.length !== 4 ||
    new Set(providers).size !== 4 ||
    !["power", "soilgrids", "smap", "farmer_input"].every((name) =>
      providers.some((provider) => provider === name))
  ) {
    invalid("Recommendation response has invalid source cardinality");
  }
  for (const source of value.sources) {
    if ((source.mode === "fixture") !== (source.fixture_id !== null)) {
      invalid("Recommendation response has inconsistent fixture provenance");
    }
    if (source.provider === "farmer_input" && !["farmer_input", "unavailable"].includes(source.mode)) {
      invalid("Recommendation response has invalid farmer source mode");
    }
    if (source.provider !== "farmer_input" && source.mode === "farmer_input") {
      invalid("Recommendation response has invalid provider source mode");
    }
    if (source.mode === "unavailable" && (
      source.product !== null || source.observed_start !== null || source.observed_end !== null ||
      source.retrieved_at !== null || source.grid_resolution_km !== null ||
      source.spatial_support !== null || source.fixture_id !== null || source.used_for.length !== 0
    )) {
      invalid("Unavailable source contains observational metadata");
    }
    if (source.observed_start !== null && source.observed_end !== null &&
        source.observed_end < source.observed_start) {
      invalid("Source observation dates are reversed");
    }
  }
  const soil = value.features.soil;
  const soilKeys = ["ph", "soc_g_kg", "total_n_g_kg", "sand_pct", "silt_pct", "clay_pct"] as const;
  for (const key of soilKeys) {
    if ((soil[key] === null) !== (soil.field_sources[key] === "unavailable")) {
      invalid(`Soil source disagrees with ${key}`);
    }
  }
  const scenarioIds = value.features.slot_scenarios.map((item) => item.slot_id);
  if (new Set(scenarioIds).size !== scenarioIds.length) {
    invalid("Duplicate scenario slot IDs");
  }
  if (value.feasible_rotation_count < value.recommendations.length ||
      value.recommendations.some((item, index) => item.rank !== index + 1)) {
    invalid("Recommendation ranks or feasible count are inconsistent");
  }
  if (value.feasible_rotation_count === 0) {
    if (value.status !== "no_feasible_rotation" || value.recommendations.length !== 0 ||
        !value.warnings.some((item) => item.code === "NO_FEASIBLE_ROTATION")) {
      invalid("Empty recommendation status is inconsistent");
    }
  } else if (value.status !== (value.data_quality === "complete" ? "ok" : "degraded")) {
    invalid("Recommendation status disagrees with data quality");
  }
  if (value.warnings.some((item) => !warningCodes.has(item.code))) {
    invalid("Response warnings contain a reason code");
  }
  const componentKeys = ["nitrogen", "roots", "water", "temperature", "soil"] as const;
  for (const recommendation of value.recommendations) {
    if (recommendation.slots.length !== scenarioIds.length ||
        recommendation.slots.some((slot, index) => slot.slot_id !== scenarioIds[index])) {
      invalid("Recommendation slots disagree with scenarios");
    }
    const total = componentKeys.reduce((sum, key) => sum + recommendation.effective_weights[key], 0);
    if (Math.abs(total - 1) > 1e-6 || componentKeys.some((key) =>
      recommendation.components[key] === null && recommendation.effective_weights[key] !== 0)) {
      invalid("Recommendation component weights are inconsistent");
    }
    if (recommendation.reasons.some((item) => !reasonCodes.has(item.code))) {
      invalid("Recommendation reasons contain a warning code");
    }
  }
}

function validMmdd(value: string): boolean {
  if (!/^\d{4}$/.test(value)) return false;
  const month = Number(value.slice(0, 2));
  const day = Number(value.slice(2));
  const parsed = new Date(Date.UTC(2001, month - 1, day));
  return parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function validHttpsUrl(value: string): boolean {
  if (/\s/.test(value)) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function validateRecommendationResponse(payload: unknown): RecommendationResponse {
  if (!isRecommendationResponse(payload)) {
    return invalid("Response does not match RecommendationResponse schema");
  }
  validateRecommendationInvariants(payload);
  return payload;
}

export function validateCropCatalogResponse(payload: unknown): CropCatalogResponse {
  if (!isCropCatalogResponse(payload)) {
    return invalid("Response does not match CropCatalogResponse schema");
  }
  const ids = payload.crops.map((crop) => crop.crop_id);
  if (new Set(ids).size !== ids.length || payload.crops.some((crop) =>
    !crop.region_ids.includes(payload.region_id) ||
    crop.maturity_min_days > crop.maturity_max_days ||
    crop.rainfall_min_mm > crop.rainfall_max_mm ||
    crop.temperature_min_c > crop.temperature_max_c ||
    crop.ph_min > crop.ph_max ||
    crop.planting_windows.some((window) =>
      !validMmdd(window.start_mmdd) || !validMmdd(window.end_mmdd)) ||
    crop.references.some((reference) => !validHttpsUrl(reference))
  )) {
    return invalid("Crop catalog contains inconsistent traits or duplicate IDs");
  }
  return payload;
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    const payload: unknown = await response.json();
    return payload;
  } catch {
    throw new ApiError("Malformed JSON response", response.status);
  }
}

async function send(path: string, init: RequestInit): Promise<{ response: Response; payload: unknown }> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }
    throw new ApiError("Request failed before a response was received", 0);
  }
  const payload = await parseJson(response);
  if (!response.ok) {
    const envelope = isErrorEnvelope(payload) ? payload : null;
    throw new ApiError(envelope?.error.message ?? `HTTP ${response.status}`, response.status, envelope);
  }
  return { response, payload };
}

export async function recommendRotation(
  request: RecommendationRequest,
  signal?: AbortSignal,
): Promise<RecommendationResponse> {
  if (!isRecommendationRequest(request)) {
    return invalid("Request does not match RecommendationRequest schema");
  }
  const { response, payload } = await send("/api/recommend-rotation", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  try {
    const result = validateRecommendationResponse(payload);
    if (result.location.latitude !== request.location.latitude ||
        result.location.longitude !== request.location.longitude ||
        result.features.slot_scenarios.length !== request.slots.length ||
        result.features.slot_scenarios.some((slot, index) => slot.slot_id !== request.slots[index].slot_id) ||
        result.recommendations.some((recommendation) =>
          recommendation.slots.length !== request.slots.length ||
          recommendation.slots.some((slot, index) =>
            slot.slot_id !== request.slots[index].slot_id ||
            slot.start_date !== request.slots[index].start_date ||
            slot.end_date !== request.slots[index].end_date))) {
      throw new ApiError("Response does not echo the requested location and slots", response.status);
    }
    return result;
  } catch (error) {
    if (error instanceof ApiError) {
      throw new ApiError(error.message, response.status);
    }
    throw error;
  }
}

export async function fetchCropCatalog(
  regionId: "punjab_pk_demo_v1",
  signal?: AbortSignal,
): Promise<CropCatalogResponse> {
  const { response, payload } = await send(
    `/api/recommend-rotation?region_id=${encodeURIComponent(regionId)}`,
    { method: "GET", headers: { Accept: "application/json" }, signal },
  );
  try {
    return validateCropCatalogResponse(payload);
  } catch (error) {
    if (error instanceof ApiError) {
      throw new ApiError(error.message, response.status);
    }
    throw error;
  }
}
