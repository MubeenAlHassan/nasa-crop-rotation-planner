import type { Location, RecommendationRequest } from "@/lib/generated/contracts";

export type FieldPresetId = "faisalabad" | "sahiwal" | "beltsville_usa" | "rothamsted_uk";
export type RegionId = NonNullable<RecommendationRequest["region_id"]>;

export interface FieldPreset {
  id: FieldPresetId;
  name: string;
  region: string;
  regionId: RegionId;
  location: Location;
  kind: "fixture" | "custom";
  summary: string;
  /** Default planting slot template relative to assessment (UTC ISO dates filled by planner). */
  slotKind: "rabi_pk" | "winter_cereal" | "summer_row";
}

/** Documented agricultural / research field presets (WGS84). Sahiwal is the default live field. */
export const FIELD_PRESETS: ReadonlyArray<FieldPreset> = [
  {
    id: "sahiwal",
    name: "Sahiwal",
    region: "Punjab, Pakistan",
    regionId: "punjab_pk_demo_v1",
    location: { latitude: 30.6612, longitude: 73.1086 },
    kind: "custom",
    summary: "Default live field — irrigated cotton–wheat belt, Punjab. Uses current NASA POWER climate.",
    slotKind: "rabi_pk",
  },
  {
    id: "faisalabad",
    name: "Faisalabad",
    region: "Punjab, Pakistan",
    regionId: "punjab_pk_demo_v1",
    location: { latitude: 31.4504, longitude: 73.135 },
    kind: "fixture",
    summary: "Pinned offline fixture farm for the NASA Space Apps demo.",
    slotKind: "rabi_pk",
  },
  {
    id: "beltsville_usa",
    name: "Beltsville research fields",
    region: "Maryland, USA (near NASA HQ / Goddard)",
    regionId: "maryland_usa_demo_v1",
    location: { latitude: 39.0319, longitude: -76.8844 },
    kind: "custom",
    summary: "USDA Beltsville Agricultural Research Center — uses Maryland demo crop catalog.",
    slotKind: "winter_cereal",
  },
  {
    id: "rothamsted_uk",
    name: "Rothamsted Broadbalk fields",
    region: "Harpenden, United Kingdom",
    regionId: "uk_england_demo_v1",
    location: { latitude: 51.8092, longitude: -0.3553 },
    kind: "custom",
    summary: "Historic arable research farm — uses England demo crop catalog.",
    slotKind: "winter_cereal",
  },
];

/** Default live field shown when the planner opens without an explicit location. */
export const DEFAULT_PRESET_ID: FieldPresetId = "sahiwal";
export const DEFAULT_POINT: Location = FIELD_PRESETS.find((preset) => preset.id === DEFAULT_PRESET_ID)!.location;

/** The only pinned offline fixture farm (Faisalabad). Fixture mode never applies anywhere else. */
export const DEMO_POINT: Location = FIELD_PRESETS.find((preset) => preset.kind === "fixture")!.location;

export function formatCoords(location: Location): string {
  const latHemisphere = location.latitude >= 0 ? "N" : "S";
  const lonHemisphere = location.longitude >= 0 ? "E" : "W";
  return `${Math.abs(location.latitude).toFixed(4)}° ${latHemisphere}, ${Math.abs(location.longitude).toFixed(4)}° ${lonHemisphere}`;
}

export function samePoint(first: Location, second: Location): boolean {
  return first.latitude === second.latitude && first.longitude === second.longitude;
}

export function findPreset(location: Location | null): FieldPreset | null {
  if (!location) return null;
  return FIELD_PRESETS.find((preset) => samePoint(preset.location, location)) ?? null;
}

export function getPreset(id: FieldPresetId): FieldPreset {
  const preset = FIELD_PRESETS.find((item) => item.id === id);
  if (!preset) throw new Error(`Unknown field preset: ${id}`);
  return preset;
}

export function regionForLocation(location: Location | null): RegionId {
  return findPreset(location)?.regionId ?? "punjab_pk_demo_v1";
}
