import type { Location } from "@/lib/generated/contracts";

export type FieldPresetId = "faisalabad" | "sahiwal" | "beltsville_usa" | "rothamsted_uk";

export interface FieldPreset {
  id: FieldPresetId;
  name: string;
  region: string;
  location: Location;
  kind: "fixture" | "custom";
  summary: string;
}

/** Documented agricultural / research field presets (WGS84). */
export const FIELD_PRESETS: ReadonlyArray<FieldPreset> = [
  {
    id: "faisalabad",
    name: "Faisalabad",
    region: "Punjab, Pakistan",
    location: { latitude: 31.4504, longitude: 73.135 },
    kind: "fixture",
    summary: "Pinned offline fixture farm for the NASA Space Apps demo.",
  },
  {
    id: "sahiwal",
    name: "Sahiwal",
    region: "Punjab, Pakistan",
    location: { latitude: 30.6612, longitude: 73.1086 },
    kind: "custom",
    summary: "Irrigated cotton–wheat belt city center, Punjab.",
  },
  {
    id: "beltsville_usa",
    name: "Beltsville research fields",
    region: "Maryland, USA (near NASA HQ / Goddard)",
    location: { latitude: 39.0319, longitude: -76.8844 },
    kind: "custom",
    summary: "USDA Beltsville Agricultural Research Center fields near Washington, D.C. and NASA Goddard.",
  },
  {
    id: "rothamsted_uk",
    name: "Rothamsted Broadbalk fields",
    region: "Harpenden, United Kingdom",
    location: { latitude: 51.8092, longitude: -0.3553 },
    kind: "custom",
    summary: "Historic arable research farm (winter wheat Broadbalk experiment since 1843).",
  },
];

export const DEMO_POINT: Location = FIELD_PRESETS[0].location;

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
