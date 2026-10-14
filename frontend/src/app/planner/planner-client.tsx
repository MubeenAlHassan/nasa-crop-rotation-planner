"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import { useSearchParams } from "next/navigation";
import { CropTraits } from "../../components/crop-traits";
import { FieldMap } from "../../components/field-map";
import { PlannerResultsPanel } from "../../components/planner-results-panel";
import { PlannerStepNav, type PlannerStep } from "../../components/planner-step-nav";
import { RecommendationForm } from "../../components/recommendation-form";
import { SiteHeader } from "../../components/site-header";
import { Reveal } from "../../components/reveal";
import { fetchCropCatalog, recommendRotation } from "../../lib/api/client";
import {
  DEFAULT_POINT, DEFAULT_PRESET_ID, DEMO_POINT, FIELD_PRESETS, findPreset, formatCoords, getPreset,
  regionForLocation, samePoint, type FieldPresetId,
} from "../../lib/field-presets";
import type { CropCatalogResponse, Location, RecommendationRequest, RecommendationResponse } from "../../lib/generated/contracts";

const DEMO_REQUEST: RecommendationRequest = {
  region_id: "punjab_pk_demo_v1",
  location: DEMO_POINT,
  assessment_end: "2025-10-15",
  slots: [{ slot_id: "rabi_2025", start_date: "2025-11-01", end_date: "2026-03-31" }],
  crop_history: [{
    crop_id: "maize", start_date: "2025-05-01", end_date: "2025-09-30", residue_management: "retained",
  }],
  irrigation: "rainfed",
  allowed_crop_ids: [],
  excluded_crop_ids: [],
  soil_override: null,
  data_mode: "fixture",
  farmer_objective: "balanced",
  top_k: 3,
};

function isoTodayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function addUtcDays(iso: string, days: number): string {
  const time = Date.parse(`${iso}T00:00:00.000Z`);
  return new Date(time + days * 86_400_000).toISOString().slice(0, 10);
}

function defaultSlotsForLocation(location: Location, assessment: string): RecommendationRequest["slots"] {
  const preset = findPreset(location);
  const year = Number(assessment.slice(0, 4));
  const month = Number(assessment.slice(5, 7));
  if (preset?.slotKind === "winter_cereal") {
    const startYear = month >= 9 ? year : year;
    const start = `${startYear}-09-20`;
    const end = `${startYear + 1}-07-15`;
    const slotStart = start <= assessment ? addUtcDays(assessment, 14) : start;
    const slotEnd = end <= slotStart ? addUtcDays(slotStart, 240) : end;
    return [{ slot_id: "winter_slot", start_date: slotStart, end_date: slotEnd }];
  }
  const startYear = month >= 11 ? year + 1 : year;
  const start = `${startYear}-11-01`;
  const end = `${startYear + 1}-03-31`;
  const slotStart = start <= assessment ? addUtcDays(assessment, 14) : start;
  const slotEnd = end <= slotStart ? addUtcDays(slotStart, 120) : end;
  return [{ slot_id: "rabi_slot", start_date: slotStart, end_date: slotEnd }];
}

/** Live irrigated request for a custom map / search point. */
function customIrrigatedRequest(location: Location): RecommendationRequest {
  const assessment = isoTodayUtc();
  return {
    region_id: regionForLocation(location),
    location,
    assessment_end: assessment,
    slots: defaultSlotsForLocation(location, assessment),
    crop_history: [],
    irrigation: "available",
    allowed_crop_ids: [],
    excluded_crop_ids: [],
    soil_override: null,
    data_mode: "auto",
    farmer_objective: "climate_adaptation",
    top_k: 3,
  };
}

export default function PlannerClient(): ReactElement {
  const searchParams = useSearchParams();
  const [catalog, setCatalog] = useState<CropCatalogResponse | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [location, setLocation] = useState<Location | null>(DEFAULT_POINT);
  const [demoApplyKey, setDemoApplyKey] = useState(0);
  const [demoIrrigation, setDemoIrrigation] = useState<RecommendationRequest["irrigation"]>("rainfed");
  const [customApplyKey, setCustomApplyKey] = useState(0);
  const [irrigationRetryKey, setIrrigationRetryKey] = useState(0);
  const [response, setResponse] = useState<RecommendationResponse | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const active = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const demoArmedRef = useRef(false);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const autoDemoStarted = useRef(false);
  const pendingCustomIrrigated = useRef<Location | null>(null);
  const [lastRequest, setLastRequest] = useState<RecommendationRequest | null>(null);
  const [step, setStep] = useState<PlannerStep>("field");
  const [showCropGuide, setShowCropGuide] = useState(false);

  const activeRegionId = regionForLocation(location);

  useEffect(() => {
    const controller = new AbortController();
    setCatalog(null);
    setCatalogError(null);
    void fetchCropCatalog(activeRegionId, controller.signal).then(setCatalog).catch((failure: unknown) => {
      if (!controller.signal.aborted) {
        setCatalogError(failure instanceof Error ? failure.message : "Crop catalog is unavailable.");
      }
    });
    return () => controller.abort();
  }, [catalogAttempt, activeRegionId]);

  useEffect(() => () => active.current?.abort(), []);

  useEffect(() => {
    if ((pending || response || requestError) && step === "results" && resultsRef.current?.scrollIntoView) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [pending, response, requestError, step]);

  function selectLocation(next: Location, options?: { skipCustomFormApply?: boolean }): void {
    if (location && samePoint(location, next)) return;
    active.current?.abort();
    active.current = null;
    generation.current += 1;
    setPending(false);
    setResponse(null);
    setRequestError(null);
    setLastRequest(null);
    demoArmedRef.current = false;
    if (!options?.skipCustomFormApply) {
      setCustomApplyKey((value) => value + 1);
    }
    setLocation(next);
  }

  function submit(request: RecommendationRequest): void {
    setStep("results");
    if (request.data_mode === "fixture" && (!demoArmedRef.current || !samePoint(request.location, DEMO_POINT) ||
        request.assessment_end !== "2025-10-15" || request.slots.length !== 1 ||
        request.slots[0].slot_id !== "rabi_2025" ||
        request.slots[0].start_date !== "2025-11-01" || request.slots[0].end_date !== "2026-03-31")) {
      setRequestError("Use the pinned Faisalabad demo action, assessment date 2025-10-15, and Rabi 2025 slot from 2025-11-01 to 2026-03-31.");
      setResponse(null);
      return;
    }
    active.current?.abort();
    setLastRequest(request);
    const controller = new AbortController();
    active.current = controller;
    const current = ++generation.current;
    setPending(true);
    setRequestError(null);
    setResponse(null);
    void recommendRotation(request, controller.signal).then((result) => {
      if (current === generation.current && !controller.signal.aborted) setResponse(result);
    }).catch((failure: unknown) => {
      if (current === generation.current && !controller.signal.aborted) {
        const message = failure instanceof Error ? failure.message : "Recommendation request failed.";
        const custom = !samePoint(request.location, DEMO_POINT);
        setRequestError(custom
          ? `${message} Custom locations need live POWER climate with prepared baselines. Your farm inputs are unchanged; retry or explicitly select the Faisalabad demo.`
          : message);
      }
    }).finally(() => {
      if (current === generation.current) {
        active.current = null;
        setPending(false);
      }
    });
  }

  function retryWithIrrigation(): void {
    if (!lastRequest) return;
    setIrrigationRetryKey((value) => value + 1);
    submit({ ...lastRequest, irrigation: "available" });
  }

  function armDemo(irrigation: RecommendationRequest["irrigation"] = "rainfed"): void {
    pendingCustomIrrigated.current = null;
    selectLocation(DEMO_POINT, { skipCustomFormApply: true });
    demoArmedRef.current = true;
    setDemoIrrigation(irrigation);
    setDemoApplyKey((value) => value + 1);
    setRequestError(null);
    if (!catalog) {
      setStep("results");
      setRequestError("Crop catalog is still loading. Wait a moment, then click the pinned demo again.");
      return;
    }
    submit({ ...DEMO_REQUEST, irrigation });
  }

  /** Map/search/preset → try live climate; fixture playback requires a demo action. */
  function runIrrigatedForLocation(next: Location): void {
    if (!(location && samePoint(location, next))) {
      selectLocation(next);
    } else {
      active.current?.abort();
      active.current = null;
      generation.current += 1;
      setPending(false);
      setResponse(null);
      setRequestError(null);
    }
    setRequestError(null);
    if (!catalog) {
      pendingCustomIrrigated.current = next;
      return;
    }
    pendingCustomIrrigated.current = null;
    submit(customIrrigatedRequest(next));
  }

  function selectPreset(id: FieldPresetId): void {
    const preset = getPreset(id);
    if (preset.kind === "fixture") {
      armDemo("available");
      return;
    }
    runIrrigatedForLocation(preset.location);
  }

  useEffect(() => {
    if (!catalog || !pendingCustomIrrigated.current) return;
    const next = pendingCustomIrrigated.current;
    pendingCustomIrrigated.current = null;
    runIrrigatedForLocation(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog]);

  useEffect(() => {
    if (autoDemoStarted.current || !catalog) return;
    if (searchParams.get("demo") === "1") {
      autoDemoStarted.current = true;
      armDemo(searchParams.get("irrigation") === "available" ? "available" : "rainfed");
      return;
    }
    const presetId = searchParams.get("location");
    autoDemoStarted.current = true;
    if (presetId && FIELD_PRESETS.some((preset) => preset.id === presetId)) {
      selectPreset(presetId as FieldPresetId);
      return;
    }
    // Default: show the Sahiwal live field with current NASA POWER climate.
    selectPreset(DEFAULT_PRESET_ID);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, searchParams]);

  // Offer an irrigated re-run whenever a rainfed plan found no feasible crop.
  const showIrrigationRetry = Boolean(
    response && response.feasible_rotation_count === 0 && lastRequest && lastRequest.irrigation !== "available",
  );
  const activePreset = findPreset(location);
  const defaultPreset = getPreset(DEFAULT_PRESET_ID);

  return (
    <div className="min-h-full bg-[var(--background)] text-[var(--on-surface)]">
      <SiteHeader active="planner" />
      <main className="mx-auto max-w-5xl space-y-5 px-4 pb-10 pt-28 sm:px-6 lg:px-8">
        <Reveal immediate as="header" className="soft-panel px-5 py-5 sm:px-7">
          <h1 className="font-display text-3xl font-bold text-[var(--primary)] sm:text-4xl">Rotation planner</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--on-surface-variant)] sm:text-base">
            Three simple steps: choose your field, set your plan, then read clear crop recommendations.
          </p>
        </Reveal>

        <PlannerStepNav
          step={step}
          onChange={setStep}
          resultsReady={Boolean(response || requestError || pending)}
        />

        {/* Step panels stay mounted so farmer inputs and the map survive step changes. */}
        <div hidden={step !== "field"}>
          <Reveal immediate className="space-y-4">
            <section className="panel space-y-4 p-4 sm:p-5" aria-label="Choose field">
              <div>
                <h2 className="font-display text-xl font-semibold text-[var(--primary)]">Where is your field?</h2>
                <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
                  {defaultPreset.name} ({defaultPreset.region}) is the default live field. Pick another saved place, or use the map.
                  Faisalabad also has a ready offline demo.
                </p>
              </div>

              <div className="flex flex-wrap gap-2" role="list">
                {FIELD_PRESETS.map((preset) => {
                  const selected = activePreset?.id === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      role="listitem"
                      disabled={pending}
                      onClick={() => {
                        if (preset.kind === "fixture") {
                          // Stay on this step so the offline demo actions are visible.
                          selectLocation(DEMO_POINT, { skipCustomFormApply: true });
                          return;
                        }
                        selectLocation(getPreset(preset.id).location);
                        setStep("plan");
                      }}
                      className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                        selected
                          ? "bg-[var(--primary)] text-white"
                          : "bg-[var(--surface-container-low)] text-[var(--on-surface)] ring-1 ring-[var(--outline-variant)]"
                      }`}
                    >
                      {preset.name}
                      <span className="ml-1 font-normal opacity-80">· {preset.region.split(",")[0]}</span>
                    </button>
                  );
                })}
              </div>

              {activePreset?.kind === "fixture" && (
                <div className="rounded-xl border border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-3 text-sm text-[var(--warning-ink)]">
                  <p className="font-semibold">Faisalabad offline demo</p>
                  <p className="mt-1">
                    Rainfed often finds no crop. Irrigated unlocks wheat. Soil and satellite moisture were unavailable in this capture.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className="btn-secondary" disabled={pending} onClick={() => armDemo("rainfed")}>
                      Rainfed demo
                    </button>
                    <button type="button" className="btn-primary" disabled={pending} onClick={() => armDemo("available")}>
                      Irrigated demo (wheat)
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => setStep("plan")}>
                      Edit plan first
                    </button>
                  </div>
                </div>
              )}

              {catalogError && (
                <section role="alert" className="space-y-2 rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] p-3 text-[var(--danger-ink)]">
                  <p>Crop list unavailable: {catalogError}</p>
                  <button
                    type="button"
                    className="rounded-lg border border-[var(--danger-ink)] px-3 py-1.5 text-sm font-semibold"
                    onClick={() => setCatalogAttempt((value) => value + 1)}
                  >
                    Retry
                  </button>
                </section>
              )}

              <div className="overflow-hidden rounded-xl border border-[var(--outline-variant)]">
                <FieldMap initialLocation={location} onChange={runIrrigatedForLocation} disabled={false} />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-[var(--on-surface-variant)]">
                  {location
                    ? <>Selected: {formatCoords(location)}{activePreset ? ` (${activePreset.name})` : ""}</>
                    : "No field selected yet — use a chip or the map."}
                </p>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!location}
                  onClick={() => setStep("plan")}
                >
                  Continue to plan
                </button>
              </div>
            </section>
          </Reveal>
        </div>

        <div hidden={step !== "plan"}>
          <Reveal immediate className="space-y-4">
            <section className="panel space-y-4 p-4 sm:p-5" aria-label="Plan rotation">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-semibold text-[var(--primary)]">Set your planting plan</h2>
                  <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
                    Choose dates, water access, and what matters most. Then get recommendations.
                  </p>
                </div>
                <button type="button" className="btn-secondary" onClick={() => setStep("field")}>
                  Back to field
                </button>
              </div>

              {!catalog && !catalogError && (
                <p role="status" className="text-sm text-[var(--on-surface-variant)]">Loading crop list…</p>
              )}
              {catalog && (
                <RecommendationForm
                  catalog={catalog}
                  initialLocation={location}
                  submitting={pending}
                  onSubmit={submit}
                  demoApplyKey={demoApplyKey}
                  demoIrrigation={demoIrrigation}
                  customApplyKey={customApplyKey}
                  irrigationRetryKey={irrigationRetryKey}
                  onLocationCommit={(next) => selectLocation(next, { skipCustomFormApply: true })}
                />
              )}

              {catalog && (
                <div>
                  <button
                    type="button"
                    className="text-sm font-semibold text-[var(--primary)]"
                    onClick={() => setShowCropGuide((value) => !value)}
                    aria-expanded={showCropGuide}
                  >
                    {showCropGuide ? "Hide crop guide" : "Show crop guide (optional)"}
                  </button>
                  {showCropGuide && (
                    <div className="mt-3 rounded-xl border border-[var(--outline-variant)] p-3">
                      <CropTraits catalog={catalog} />
                    </div>
                  )}
                </div>
              )}
            </section>
          </Reveal>
        </div>

        <div hidden={step !== "results"}>
          <Reveal immediate>
            <div ref={resultsRef} className="panel space-y-4 p-4 sm:p-6" aria-live="polite">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-xl font-semibold text-[var(--primary)]">Your results</h2>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary" onClick={() => setStep("plan")}>
                    Adjust plan
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => setStep("field")}>
                    Change field
                  </button>
                </div>
              </div>

              {pending && (
                <p role="status" className="rounded-xl bg-[var(--info-bg)] px-4 py-3 text-[var(--info-ink)]">
                  Working out recommendations…
                </p>
              )}

              {requestError && (
                <div role="alert" className="space-y-3 rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-[var(--danger-ink)]">
                  <p>{requestError}</p>
                  <div className="flex flex-wrap gap-2">
                    {lastRequest && (
                      <button type="button" className="btn-secondary" onClick={() => lastRequest && submit(lastRequest)}>
                        Retry same request
                      </button>
                    )}
                    <button type="button" className="btn-primary" onClick={() => armDemo("available")}>
                      Run Faisalabad demo instead
                    </button>
                  </div>
                </div>
              )}

              {!response && !pending && !requestError && (
                <div className="rounded-xl border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-8 text-center">
                  <p className="font-display text-lg text-[var(--primary)]">No results yet</p>
                  <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
                    Go back to Plan and submit, or run the {defaultPreset.name} live field.
                  </p>
                  <button type="button" className="btn-primary mt-4" onClick={() => selectPreset(DEFAULT_PRESET_ID)}>
                    Run {defaultPreset.name} live
                  </button>
                </div>
              )}

              {response && (
                <PlannerResultsPanel
                  response={response}
                  onRetryWithIrrigation={showIrrigationRetry ? retryWithIrrigation : undefined}
                  retrying={pending}
                />
              )}
            </div>
          </Reveal>
        </div>
      </main>
    </div>
  );
}
