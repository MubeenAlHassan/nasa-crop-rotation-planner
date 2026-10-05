"use client";

import { useState, type FormEvent, type ReactElement } from "react";
import type { CropCatalogResponse, History, Location, RecommendationRequest, Slot, SoilOverride } from "@/lib/generated/contracts";

export interface RecommendationFormProps {
  catalog: CropCatalogResponse;
  initialLocation: Location | null;
  submitting: boolean;
  onSubmit: (request: RecommendationRequest) => void;
  /** Increment to apply the pinned Faisalabad demo defaults into the form. */
  demoApplyKey?: number;
}

const DEMO_ASSESSMENT = "2025-10-15";
const DEMO_SLOTS: Slot[] = [{ slot_id: "rabi_2025", start_date: "2025-11-01", end_date: "2026-03-31" }];
const DEMO_HISTORY: History[] = [{
  crop_id: "maize", start_date: "2025-05-01", end_date: "2025-09-30", residue_management: "retained",
}];

type Errors = Record<string, string>;
type SoilKey = "ph" | "soc_g_kg" | "total_n_g_kg" | "sand_pct" | "silt_pct" | "clay_pct";
const soilFields: ReadonlyArray<{ key: SoilKey; label: string; max: number }> = [
  { key: "ph", label: "pH", max: 14 },
  { key: "soc_g_kg", label: "Soil organic carbon (g/kg)", max: 1000 },
  { key: "total_n_g_kg", label: "Total nitrogen (g/kg)", max: 1000 },
  { key: "sand_pct", label: "Sand (%)", max: 100 },
  { key: "silt_pct", label: "Silt (%)", max: 100 },
  { key: "clay_pct", label: "Clay (%)", max: 100 },
];
const dayMs = 86_400_000;

function isoDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time / dayMs : null;
}

function numeric(value: string, min: number, max: number): number | null {
  if (value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

export function RecommendationForm({
  catalog, initialLocation, submitting, onSubmit, demoApplyKey = 0,
}: RecommendationFormProps): ReactElement {
  const [latitude, setLatitude] = useState(initialLocation?.latitude.toString() ?? "");
  const [longitude, setLongitude] = useState(initialLocation?.longitude.toString() ?? "");
  const [assessment, setAssessment] = useState("");
  const [slots, setSlots] = useState<Slot[]>([{ slot_id: "slot_1", start_date: "", end_date: "" }]);
  const [history, setHistory] = useState<History[]>([]);
  const [irrigation, setIrrigation] = useState<RecommendationRequest["irrigation"]>("rainfed");
  const [allowed, setAllowed] = useState<string[]>([]);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [dataMode, setDataMode] = useState<"auto" | "fixture">("auto");
  const [topK, setTopK] = useState(3);
  const [useSoil, setUseSoil] = useState(false);
  const [sampledOn, setSampledOn] = useState("");
  const [soilValues, setSoilValues] = useState<Record<SoilKey, string>>({
    ph: "", soc_g_kg: "", total_n_g_kg: "", sand_pct: "", silt_pct: "", clay_pct: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [appliedDemoKey, setAppliedDemoKey] = useState(0);
  const cropIds = new Set(catalog.crops.map((crop) => crop.crop_id));

  const [external, setExternal] = useState({ latitude: initialLocation?.latitude, longitude: initialLocation?.longitude });
  if (external.latitude !== initialLocation?.latitude || external.longitude !== initialLocation?.longitude) {
    setExternal({ latitude: initialLocation?.latitude, longitude: initialLocation?.longitude });
    setLatitude(initialLocation?.latitude.toString() ?? "");
    setLongitude(initialLocation?.longitude.toString() ?? "");
  }
  if (demoApplyKey > 0 && demoApplyKey !== appliedDemoKey) {
    setAppliedDemoKey(demoApplyKey);
    setAssessment(DEMO_ASSESSMENT);
    setSlots(DEMO_SLOTS.map((slot) => ({ ...slot })));
    setHistory(DEMO_HISTORY.map((row) => ({ ...row })));
    setIrrigation("rainfed");
    setAllowed([]);
    setExcluded([]);
    setDataMode("fixture");
    setTopK(3);
    setUseSoil(false);
    setSampledOn("");
    setSoilValues({ ph: "", soc_g_kg: "", total_n_g_kg: "", sand_pct: "", silt_pct: "", clay_pct: "" });
    setErrors({});
  }

  function updateSlot(index: number, key: keyof Slot, value: string): void {
    setSlots((current) => current.map((slot, at) => at === index ? { ...slot, [key]: value } : slot));
  }
  function updateHistory(index: number, key: keyof History, value: string): void {
    setHistory((current) => current.map((row, at) => at === index ? { ...row, [key]: value } : row));
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const next: Errors = {};
    const lat = numeric(latitude, -90, 90);
    const lon = numeric(longitude, -180, 180);
    if (lat === null || lon === null) next.location = "Enter valid WGS84 latitude and longitude.";
    const assessmentDay = isoDay(assessment);
    const today = Math.floor(Date.now() / dayMs);
    if (assessmentDay === null || assessmentDay > today) next.assessment = "Enter a valid assessment date no later than today.";
    if (slots.length < 1 || slots.length > 4) next.slots = "Provide one to four slots.";
    const seenSlots = new Set<string>();
    let previousEnd = -Infinity;
    slots.forEach((slot, index) => {
      const start = isoDay(slot.start_date);
      const end = isoDay(slot.end_date);
      if (!/^[a-z0-9_-]{1,32}$/.test(slot.slot_id) || seenSlots.has(slot.slot_id)) next[`slot_${index}`] = "Use a unique lowercase slot ID.";
      seenSlots.add(slot.slot_id);
      if (start === null || end === null || assessmentDay === null || start <= assessmentDay || end < start ||
          end - start + 1 < 30 || end - start + 1 > 366 || end > assessmentDay + 730 || start <= previousEnd) {
        next[`slot_${index}`] = "Slots must be ordered, nonoverlapping, 30–366 days long, and within two years of assessment.";
      }
      if (end !== null) previousEnd = end;
    });
    if (history.length > 8) next.history = "At most eight completed crops are supported.";
    let previousHistoryEnd = -Infinity;
    history.forEach((row, index) => {
      const start = isoDay(row.start_date);
      const end = isoDay(row.end_date);
      if (!cropIds.has(row.crop_id) || start === null || end === null || assessmentDay === null ||
          start > end || end > assessmentDay || start <= previousHistoryEnd) {
        next[`history_${index}`] = "Select a known crop with ordered, completed, nonoverlapping dates.";
      }
      if (end !== null) previousHistoryEnd = end;
    });
    if (allowed.some((id) => !cropIds.has(id)) || excluded.some((id) => !cropIds.has(id)) ||
        allowed.some((id) => excluded.includes(id))) next.crops = "Allowed and excluded crop sets must be disjoint known IDs.";

    let soilOverride: SoilOverride | null = null;
    if (useSoil) {
      const sampleDay = isoDay(sampledOn);
      if (sampleDay === null || assessmentDay === null || sampleDay > assessmentDay) next.soil = "Enter a valid soil sample date no later than assessment.";
      const values: Partial<Record<SoilKey, number | null>> = {};
      let count = 0;
      for (const field of soilFields) {
        const raw = soilValues[field.key];
        if (raw.trim() === "") continue;
        const value = numeric(raw, 0, field.max);
        if (value === null) next.soil = `Check ${field.label}: expected 0–${field.max}.`;
        else { values[field.key] = value; count += 1; }
      }
      if (count === 0) next.soil = "Provide at least one soil property.";
      const texture = [values.sand_pct, values.silt_pct, values.clay_pct];
      if (texture.some((value) => value !== undefined) &&
          (texture.some((value) => value === undefined) || Math.abs((texture[0] ?? 0) + (texture[1] ?? 0) + (texture[2] ?? 0) - 100) > 2)) {
        next.soil = "Sand, silt and clay must all be supplied and total 100 ± 2%.";
      }
      if (!next.soil) soilOverride = { sampled_on: sampledOn, depth_top_cm: 0, depth_bottom_cm: 30, ...values };
    }
    setErrors(next);
    if (Object.keys(next).length > 0 || lat === null || lon === null) return;
    onSubmit({
      region_id: catalog.region_id,
      location: { latitude: lat, longitude: lon },
      assessment_end: assessment,
      slots: slots as RecommendationRequest["slots"],
      crop_history: history as RecommendationRequest["crop_history"],
      irrigation,
      allowed_crop_ids: allowed as RecommendationRequest["allowed_crop_ids"],
      excluded_crop_ids: excluded as RecommendationRequest["excluded_crop_ids"],
      soil_override: soilOverride,
      data_mode: dataMode,
      top_k: topK,
    });
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-5" aria-label="Rotation request">
      <fieldset disabled={submitting} className="space-y-4">
        <legend>Plan a crop rotation</legend>
        <p className="text-sm text-[var(--muted)]">Region: {catalog.region_id}</p>
        <div className="grid grid-cols-2 gap-3">
          <label>Latitude<input type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} /></label>
          <label>Longitude<input type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} /></label>
        </div>
        {errors.location && <p role="alert" className="text-sm text-[var(--danger-ink)]">{errors.location}</p>}
        <label>Assessment date<input type="date" value={assessment} onChange={(e) => setAssessment(e.target.value)} /></label>
        {errors.assessment && <p role="alert" className="text-sm text-[var(--danger-ink)]">{errors.assessment}</p>}
        <fieldset className="space-y-3">
          <legend>Planting slots</legend>
          {slots.map((slot, index) => <div key={index} className="space-y-2 rounded-xl border border-[var(--panel-border)] bg-[#fbfffc] p-3">
            <label>Slot {index + 1} ID<input value={slot.slot_id} onChange={(e) => updateSlot(index, "slot_id", e.target.value)} /></label>
            <label>Slot {index + 1} start<input type="date" value={slot.start_date} onChange={(e) => updateSlot(index, "start_date", e.target.value)} /></label>
            <label>Slot {index + 1} end<input type="date" value={slot.end_date} onChange={(e) => updateSlot(index, "end_date", e.target.value)} /></label>
            {slots.length > 1 && <button type="button" className="text-sm font-semibold text-[var(--brand)]" onClick={() => setSlots((current) => current.filter((_, at) => at !== index))}>Remove slot {index + 1}</button>}
            {errors[`slot_${index}`] && <p role="alert" className="text-sm text-[var(--danger-ink)]">{errors[`slot_${index}`]}</p>}
          </div>)}
          <button type="button" className="rounded-lg border border-[var(--panel-border)] px-3 py-2 text-sm font-semibold text-[var(--brand-strong)]" disabled={slots.length >= 4} onClick={() => setSlots((current) => [...current, { slot_id: `slot_${current.length + 1}`, start_date: "", end_date: "" }])}>Add slot</button>
          {errors.slots && <p role="alert" className="text-sm text-[var(--danger-ink)]">{errors.slots}</p>}
        </fieldset>
        <fieldset className="space-y-3">
          <legend>Completed crop history</legend>
          {history.map((row, index) => <div key={index} className="space-y-2 rounded-xl border border-[var(--panel-border)] bg-[#fbfffc] p-3">
            <label>History {index + 1} crop<select value={row.crop_id} onChange={(e) => updateHistory(index, "crop_id", e.target.value)}>
              <option value="">Select crop</option>{catalog.crops.map((crop) => <option key={crop.crop_id} value={crop.crop_id}>{crop.crop_name}</option>)}
            </select></label>
            <label>History {index + 1} start<input type="date" value={row.start_date} onChange={(e) => updateHistory(index, "start_date", e.target.value)} /></label>
            <label>History {index + 1} end<input type="date" value={row.end_date} onChange={(e) => updateHistory(index, "end_date", e.target.value)} /></label>
            <label>History {index + 1} residues<select value={row.residue_management} onChange={(e) => updateHistory(index, "residue_management", e.target.value)}>
              <option value="retained">Retained</option><option value="removed">Removed</option><option value="unknown">Unknown</option>
            </select></label>
            <button type="button" className="text-sm font-semibold text-[var(--brand)]" onClick={() => setHistory((current) => current.filter((_, at) => at !== index))}>Remove history {index + 1}</button>
            {errors[`history_${index}`] && <p role="alert" className="text-sm text-[var(--danger-ink)]">{errors[`history_${index}`]}</p>}
          </div>)}
          <button type="button" className="rounded-lg border border-[var(--panel-border)] px-3 py-2 text-sm font-semibold text-[var(--brand-strong)]" disabled={history.length >= 8} onClick={() => setHistory((current) => [...current, { crop_id: "", start_date: "", end_date: "", residue_management: "unknown" }])}>Add completed crop</button>
          {errors.history && <p role="alert" className="text-sm text-[var(--danger-ink)]">{errors.history}</p>}
        </fieldset>
        <label>Irrigation<select value={irrigation} onChange={(e) => setIrrigation(e.target.value as RecommendationRequest["irrigation"])}><option value="rainfed">Rainfed</option><option value="available">Available</option></select></label>
        <label>Allowed crops<select multiple value={allowed} onChange={(e) => setAllowed(Array.from(e.target.selectedOptions, (option) => option.value))}>
          {catalog.crops.map((crop) => <option key={crop.crop_id} value={crop.crop_id}>{crop.crop_name}</option>)}
        </select></label>
        <label>Excluded crops<select multiple value={excluded} onChange={(e) => setExcluded(Array.from(e.target.selectedOptions, (option) => option.value))}>
          {catalog.crops.map((crop) => <option key={crop.crop_id} value={crop.crop_id}>{crop.crop_name}</option>)}
        </select></label>
        {errors.crops && <p role="alert" className="text-sm text-[var(--danger-ink)]">{errors.crops}</p>}
        <label>Data mode<select value={dataMode} onChange={(e) => setDataMode(e.target.value as "auto" | "fixture")}><option value="auto">Current data</option><option value="fixture">Authorized demo fixture</option></select></label>
        <label>Alternatives<select value={topK} onChange={(e) => setTopK(Number(e.target.value))}><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option></select></label>
        <label className="!flex-row items-center gap-2 font-semibold"><input type="checkbox" checked={useSoil} onChange={(e) => setUseSoil(e.target.checked)} /> Add farmer soil observations</label>
        {useSoil && <fieldset className="space-y-2 rounded-xl border border-[var(--panel-border)] bg-[#fbfffc] p-3"><legend>Farmer soil sample, 0–30 cm</legend>
          <label>Soil sample date<input type="date" value={sampledOn} onChange={(e) => setSampledOn(e.target.value)} /></label>
          {soilFields.map((field) => <label key={field.key}>{field.label}<input type="number" step="any" min="0" max={field.max} value={soilValues[field.key]}
            onChange={(e) => setSoilValues((current) => ({ ...current, [field.key]: e.target.value }))} /></label>)}
          {errors.soil && <p role="alert" className="text-sm text-[var(--danger-ink)]">{errors.soil}</p>}
        </fieldset>}
        <button type="submit" className="btn-primary w-full">
          {submitting ? "Submitting…" : "Get recommendations"}
        </button>
      </fieldset>
    </form>
  );
}
