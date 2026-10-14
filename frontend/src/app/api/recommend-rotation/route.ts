import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import schema from "../../../lib/generated/contracts.schema.json";

const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
ajv.addSchema(schema);
const requestSchema = ajv.getSchema("https://field-shift.local/contracts/1.0.0.json#/$defs/RecommendationRequest");
if (!requestSchema) throw new Error("Missing generated RecommendationRequest schema");

const LIMIT = 64 * 1024;
const DEFAULT_BACKEND = "http://127.0.0.1:8000";
const DEFAULT_ALLOWED = "http://127.0.0.1:8000,http://localhost:8000";

function error(status: number, code: string, message: string, requestId = crypto.randomUUID()): Response {
  return Response.json({ schema_version: "1.0.0", request_id: requestId,
    error: { code, message, retryable: status >= 500, details: [] } },
  { status, headers: { "X-Request-ID": requestId, "Cache-Control": "no-store" } });
}

function upstream(): URL | null {
  const configured = process.env.BACKEND_BASE_URL ?? DEFAULT_BACKEND;
  const allowed = new Set((process.env.BACKEND_ALLOWED_UPSTREAM_ORIGINS ?? DEFAULT_ALLOWED)
    .split(",").map((part) => part.trim()).filter(Boolean));
  try {
    const url = new URL(configured);
    if (!new Set(["http:", "https:"]).has(url.protocol) || !allowed.has(url.origin) ||
        url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return url;
  } catch {
    return null;
  }
}

async function forward(request: Request, path: string, body?: string): Promise<Response> {
  const base = upstream();
  if (!base) return error(500, "INTERNAL_ERROR", "Backend origin is not configured safely.");
  try {
    const response = await fetch(new URL(path, base), {
      method: request.method,
      headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body,
      signal: request.signal,
      cache: "no-store",
      redirect: "manual",
    });
    if (response.status >= 300 && response.status < 400) {
      return error(502, "INTERNAL_ERROR", "Backend redirect was rejected.");
    }
    const raw = await response.text();
    let payload: unknown;
    try { payload = JSON.parse(raw); } catch { return error(502, "INTERNAL_ERROR", "Backend returned invalid JSON."); }
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
      return error(502, "INTERNAL_ERROR", "Backend returned invalid JSON.");
    }
    const requestId = response.headers.get("x-request-id") ?? crypto.randomUUID();
    return Response.json(payload, { status: response.status,
      headers: { "X-Request-ID": requestId, "Cache-Control": "no-store" } });
  } catch (caught) {
    if (request.signal.aborted || (caught instanceof Error && caught.name === "AbortError")) {
      return error(499, "INTERNAL_ERROR", "Request canceled.");
    }
    return error(502, "INTERNAL_ERROR", "Backend is unavailable.");
  }
}

const SUPPORTED_REGIONS = new Set([
  "punjab_pk_demo_v1",
  "maryland_usa_demo_v1",
  "uk_england_demo_v1",
]);

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const regionId = url.searchParams.get("region_id");
  if (url.searchParams.size !== 1 || regionId === null || !SUPPORTED_REGIONS.has(regionId)) {
    return error(422, "VALIDATION_ERROR", "Only supported region_id values are accepted.");
  }
  return forward(request, `/api/v1/crops?region_id=${encodeURIComponent(regionId)}`);
}

export async function POST(request: Request): Promise<Response> {
  if (new URL(request.url).search) return error(422, "VALIDATION_ERROR", "Unexpected query parameters.");
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    return error(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json.");
  }
  const length = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isSafeInteger(length) || length < 0) return error(422, "VALIDATION_ERROR", "Invalid Content-Length.");
  if (length > LIMIT) return error(413, "PAYLOAD_TOO_LARGE", "JSON body exceeds 64 KiB.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = request.body?.getReader();
  try {
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > LIMIT) {
          await reader.cancel();
          return error(413, "PAYLOAD_TOO_LARGE", "JSON body exceeds 64 KiB.");
        }
        chunks.push(value);
      }
    }
  } catch {
    return error(request.signal.aborted ? 499 : 422, "VALIDATION_ERROR", "Request body could not be read.");
  } finally {
    reader?.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let body: string;
  try { body = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { return error(422, "VALIDATION_ERROR", "Request body must be UTF-8 JSON."); }
  let payload: unknown;
  try { payload = JSON.parse(body); } catch { return error(422, "VALIDATION_ERROR", "Invalid JSON body."); }
  if (!requestSchema!(payload)) return error(422, "VALIDATION_ERROR", "Request does not match the contract.");
  return forward(request, "/api/v1/recommend-rotation", body);
}
