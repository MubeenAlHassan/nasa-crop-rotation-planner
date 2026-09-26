export interface Location {
  latitude: number;
  longitude: number;
}

export interface Slot {
  slot_id: string;
  start_date: string;
  end_date: string;
}

export interface History {
  crop_id: string;
  start_date: string;
  end_date: string;
  residue_management: 'retained' | 'removed' | 'unknown';
}

export interface SoilOverride {
  sampled_on: string;
  depth_top_cm: 0;
  depth_bottom_cm: 30;
  ph?: number | null;
  soc_g_kg?: number | null;
  total_n_g_kg?: number | null;
  sand_pct?: number | null;
  silt_pct?: number | null;
  clay_pct?: number | null;
}

export interface RecommendationRequest {
  location: Location;
  region_id: string;
  assessment_end: string;
  slots: Slot[];
  crop_history?: History[];
  irrigation: 'rainfed' | 'available';
  allowed_crop_ids?: string[];
  excluded_crop_ids?: string[];
  soil_override?: SoilOverride | null;
  data_mode?: 'auto' | 'fixture';
  top_k?: number;
}

export interface ClimateSummary {
  window_start: string;
  window_end: string;
  baseline_start_year: 1991;
  baseline_end_year: 2020;
  rainfall_observed_mm: number | null;
  rainfall_baseline_mm: number | null;
  rainfall_anomaly_pct: number | null;
  temperature_observed_c: number | null;
  temperature_baseline_c: number | null;
  temperature_anomaly_c: number | null;
  rainfall_band: 'severe_dry' | 'dry' | 'normal' | 'wet' | 'severe_wet' | 'unknown';
  heat_band: 'normal' | 'elevated' | 'high' | 'unknown';
  rainfall_coverage: number;
  temperature_coverage: number;
  rainfall_baseline_years: number;
  temperature_baseline_years: number;
}

export interface SoilFieldSources {
  ph: 'soilgrids' | 'farmer_input' | 'unavailable';
  soc_g_kg: 'soilgrids' | 'farmer_input' | 'unavailable';
  total_n_g_kg: 'soilgrids' | 'farmer_input' | 'unavailable';
  sand_pct: 'soilgrids' | 'farmer_input' | 'unavailable';
  silt_pct: 'soilgrids' | 'farmer_input' | 'unavailable';
  clay_pct: 'soilgrids' | 'farmer_input' | 'unavailable';
}

export interface Soil {
  depth_top_cm: 0;
  depth_bottom_cm: 30;
  ph: number | null;
  soc_g_kg: number | null;
  total_n_g_kg: number | null;
  sand_pct: number | null;
  silt_pct: number | null;
  clay_pct: number | null;
  field_sources: SoilFieldSources;
}

export interface Moisture {
  surface_m3_m3: number | null;
  percentile: number | null;
  accepted_overpasses: number;
  latest_observation: string | null;
  depth_cm: 5;
}

export interface SlotScenario {
  slot_id: string;
  kind: 'historical_stress_scenario';
  rainfall_mm: number | null;
  temperature_c: number | null;
  rainfall_baseline_years: number;
  temperature_baseline_years: number;
  smap_adjustment_applied: boolean;
}

export interface Features {
  climate: ClimateSummary;
  soil: Soil;
  moisture: Moisture;
  slot_scenarios: SlotScenario[];
}

export interface Source {
  provider: 'power' | 'soilgrids' | 'smap' | 'farmer_input';
  mode: 'live' | 'cache' | 'stale_cache' | 'snapshot' | 'fixture' | 'farmer_input' | 'unavailable';
  product: string | null;
  observed_start: string | null;
  observed_end: string | null;
  retrieved_at: string | null;
  grid_resolution_km: number | null;
  spatial_support: string | null;
  fixture_id: string | null;
  used_for: string[];
}

export interface Components {
  nitrogen: number | null;
  roots: number | null;
  water: number | null;
  temperature: number | null;
  soil: number | null;
}

export interface Weights {
  nitrogen: number;
  roots: number;
  water: number;
  temperature: number;
  soil: number;
}

export interface PlannedCrop {
  slot_id: string;
  crop_id: string;
  crop_name: string;
  start_date: string;
  end_date: string;
}

export interface Message {
  code: string;
  message: string;
}

export interface RotationPath {
  rank: number;
  rotation_id: string;
  score: number;
  components: Components;
  effective_weights: Weights;
  slots: PlannedCrop[];
  reasons: Message[];
}

export interface Exclusion {
  slot_id: string;
  crop_id: string;
  code: string;
  message: string;
}

export interface RecommendationResponse {
  schema_version: '1.0.0';
  request_id: string;
  generated_at: string;
  status: 'ok' | 'degraded' | 'no_feasible_rotation';
  rules_version: string;
  catalog_version: string;
  location: Location;
  data_quality: 'complete' | 'limited';
  features: Features;
  sources: Source[];
  recommendations: RotationPath[];
  feasible_rotation_count: number;
  exclusions: Exclusion[];
  warnings: Message[];
}
