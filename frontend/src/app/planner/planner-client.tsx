"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import { useSearchParams } from "next/navigation";
import { ClimateCharts } from "../../components/climate-charts";
import { FieldMap } from "../../components/field-map";
import { RecommendationForm } from "../../components/recommendation-form";
import { RecommendationResults } from "../../components/recommendation-results";
import { RotationTimeline } from "../../components/rotation-timeline";
import { SoilRadar } from "../../components/soil-radar";
import { SiteHeader } from "../../components/site-header";
import { Reveal } from "../../components/reveal";
import { fetchCropCatalog, recommendRotation } from "../../lib/api/client";
import {
  DEMO_POINT, FIELD_PRESETS, findPreset, formatCoords, getPreset, samePoint, type FieldPresetId,
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
  top_k: 3,
};

function isoTodayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function addUtcDays(iso: string, days: number): string {
  const time = Date.parse(`${iso}T00:00:00.000Z`);
  return new Date(time + days * 86_400_000).toISOString().slice(0, 10);
}

/** Live-data irrigated request for a custom map / search point (not the pinned fixture). */
function customIrrigatedRequest(location: Location): RecommendationRequest {
  const assessment = isoTodayUtc();
  const year = Number(assessment.slice(0, 4));
  const month = Number(assessment.slice(5, 7));
  const startYear = month >= 11 ? year + 1 : year;
  const start = `${startYear}-11-01`;
  const end = `${startYear + 1}-03-31`;
  const slotStart = start <= assessment ? addUtcDays(assessment, 14) : start;
  const slotEnd = end <= slotStart ? addUtcDays(slotStart, 120) : end;
  return {
    region_id: "punjab_pk_demo_v1",
    location,
    assessment_end: assessment,
    slots: [{ slot_id: "rabi_slot", start_date: slotStart, end_date: slotEnd }],
    crop_history: [],
    irrigation: "available",
    allowed_crop_ids: [],
    excluded_crop_ids: [],
    soil_override: null,
    data_mode: "auto",
    top_k: 3,
  };
}

export default function PlannerClient(): ReactElement {
  const searchParams = useSearchParams();
  const [catalog, setCatalog] = useState<CropCatalogResponse | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [location, setLocation] = useState<Location | null>(null);
  const [demoArmed, setDemoArmed] = useState(false);
  const [demoApplyKey, setDemoApplyKey] = useState(0);
  const [demoIrrigation, setDemoIrrigation] = useState<RecommendationRequest["irrigation"]>("rainfed");
  const [customApplyKey, setCustomApplyKey] = useState(0);
  const [response, setResponse] = useState<RecommendationResponse | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const active = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const demoArmedRef = useRef(false);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const autoDemoStarted = useRef(false);
  const pendingIrrigatedLocation = useRef<Location | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setCatalog(null);
    setCatalogError(null);
    void fetchCropCatalog("punjab_pk_demo_v1", controller.signal).then(setCatalog).catch((failure: unknown) => {
      if (!controller.signal.aborted) {
        setCatalogError(failure instanceof Error ? failure.message : "Crop catalog is unavailable.");
      }
    });
    return () => controller.abort();
  }, [catalogAttempt]);

  useEffect(() => () => active.current?.abort(), []);

  useEffect(() => {
    if ((pending || response || requestError) && resultsRef.current?.scrollIntoView) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [pending, response, requestError]);

  function selectLocation(next: Location): void {
    if (location && samePoint(location, next)) return;
    active.current?.abort();
    active.current = null;
    generation.current += 1;
    setPending(false);
    setResponse(null);
    setRequestError(null);
    if (!samePoint(next, DEMO_POINT)) {
      demoArmedRef.current = false;
      setDemoArmed(false);
      setCustomApplyKey((value) => value + 1);
    }
    setLocation(next);
  }

  function submit(request: RecommendationRequest): void {
    if (request.data_mode === "fixture" && (!demoArmedRef.current || !samePoint(request.location, DEMO_POINT) ||
        request.assessment_end !== "2025-10-15" || request.slots.length !== 1 ||
        request.slots[0].slot_id !== "rabi_2025" ||
        request.slots[0].start_date !== "2025-11-01" || request.slots[0].end_date !== "2026-03-31")) {
      setRequestError("Use the pinned Faisalabad demo action, assessment date 2025-10-15, and Rabi 2025 slot from 2025-11-01 to 2026-03-31.");
      setResponse(null);
      return;
    }
    active.current?.abort();
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
          ? `${message} Custom locations need live POWER climate with prepared baselines. For this offline demo, use the pinned Faisalabad farm.`
          : message);
      }
    }).finally(() => {
      if (current === generation.current) {
        active.current = null;
        setPending(false);
      }
    });
  }

  function armDemo(irrigation: RecommendationRequest["irrigation"] = "rainfed"): void {
    pendingIrrigatedLocation.current = null;
    selectLocation(DEMO_POINT);
    demoArmedRef.current = true;
    setDemoArmed(true);
    setDemoIrrigation(irrigation);
    setDemoApplyKey((value) => value + 1);
    setRequestError(null);
    if (!catalog) {
      setRequestError("Crop catalog is still loading. Wait a moment, then click the pinned demo again.");
      return;
    }
    submit({ ...DEMO_REQUEST, irrigation });
  }

  /** Map/search/preset location → irrigated run (fixture for Faisalabad, live for custom points). */
  function runIrrigatedForLocation(next: Location): void {
    if (samePoint(next, DEMO_POINT)) {
      armDemo("available");
      return;
    }
    if (!(location && samePoint(location, next))) {
      selectLocation(next);
    }
    setRequestError(null);
    if (!catalog) {
      pendingIrrigatedLocation.current = next;
      return;
    }
    pendingIrrigatedLocation.current = null;
    submit(customIrrigatedRequest(next));
  }

  function usePreset(id: FieldPresetId): void {
    const preset = getPreset(id);
    if (preset.kind === "fixture") {
      armDemo("available");
      return;
    }
    runIrrigatedForLocation(preset.location);
  }

  useEffect(() => {
    if (!catalog || !pendingIrrigatedLocation.current) return;
    const next = pendingIrrigatedLocation.current;
    pendingIrrigatedLocation.current = null;
    submit(customIrrigatedRequest(next));
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
    if (presetId && FIELD_PRESETS.some((preset) => preset.id === presetId)) {
      autoDemoStarted.current = true;
      usePreset(presetId as FieldPresetId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, searchParams]);

  const showIrrigationRetry = Boolean(
    response && response.feasible_rotation_count === 0 && demoArmed && location && samePoint(location, DEMO_POINT),
  );
  const activePreset = findPreset(location);

  return (
    <div className="min-h-full bg-[var(--background)] text-[var(--on-surface)]">
      <SiteHeader active="planner" />
      <main className="mx-auto max-w-7xl space-y-8 px-4 pb-10 pt-28 sm:px-6 lg:px-8">
        <Reveal immediate as="header" className="soft-panel px-5 py-6 sm:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">NASA data · transparent rules</p>
          <h1 className="font-display mt-2 text-4xl font-bold text-[var(--primary)] sm:text-5xl">Rotation planner</h1>
          <p className="mt-3 max-w-2xl text-base text-[var(--on-surface-variant)] sm:text-lg">
            Explore crop rotation choices using observed climate, local soil context, and transparent agronomic rules.
            Pick an agricultural field preset below, or click the map for any WGS84 point.
          </p>
        </Reveal>

        <Reveal immediate delayMs={120} as="section" aria-label="Field presets" className="panel p-5 sm:p-6">
          <h2 className="font-display text-xl font-semibold text-[var(--primary)]">Quick agricultural locations</h2>
          <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
            Presets fill map coordinates for known farm / research fields. Only Faisalabad has authorized offline fixture data.
          </p>
          <div className="mt-4 grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {FIELD_PRESETS.map((preset, index) => {
              const selected = activePreset?.id === preset.id;
              return (
                <Reveal
                  key={preset.id}
                  immediate
                  delayMs={180 + index * 80}
                  variant="up"
                  className={`flex h-full min-h-[17.5rem] flex-col rounded-xl border p-4 ${selected
                    ? "border-[var(--primary)] bg-[var(--surface-container-low)]"
                    : "border-[var(--outline-variant)] bg-white"}`}
                >
                  <div className="flex min-h-0 flex-1 flex-col gap-1">
                    <p className="line-clamp-2 min-h-[2.5rem] text-xs font-semibold uppercase tracking-wide text-[var(--on-surface-variant)]">
                      {preset.region}
                    </p>
                    <p className="font-display line-clamp-2 min-h-[3rem] font-semibold leading-snug">{preset.name}</p>
                    <p className="text-sm text-[var(--on-surface-variant)]">{formatCoords(preset.location)}</p>
                    <p className="mt-1 line-clamp-3 text-xs text-[var(--muted)]">{preset.summary}</p>
                    {selected && preset.kind === "custom" && (
                      <p role="status" className="mt-2 text-sm text-[var(--info-ink)]">
                        {preset.name} selected. Irrigated recommendations run automatically with Current data.
                      </p>
                    )}
                  </div>
                  <div className="mt-auto flex min-h-[5.75rem] flex-col justify-end gap-2 pt-3">
                    {preset.kind === "fixture" ? (
                      <>
                        <button type="button" onClick={() => armDemo("rainfed")} disabled={pending} className="btn-secondary w-full">
                          Rainfed demo
                        </button>
                        <button type="button" onClick={() => armDemo("available")} disabled={pending} className="btn-primary w-full">
                          Irrigated demo (wheat)
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => usePreset(preset.id)} disabled={pending} className="btn-primary w-full">
                        Use {preset.name.split(" ")[0]} location
                      </button>
                    )}
                  </div>
                </Reveal>
              );
            })}
          </div>
        </Reveal>

        <Reveal delayMs={80} as="section" aria-label="Pinned demonstration" className="overflow-hidden rounded-2xl border border-[var(--warning-border)] bg-[var(--warning-bg)] p-5 shadow-sm sm:p-6">
          <div className="max-w-3xl space-y-2 text-[var(--warning-ink)]">
            <h2 className="font-display text-xl font-semibold">Pinned Faisalabad demonstration</h2>
            <p className="text-sm leading-relaxed sm:text-base">
              Only the documented farm at {formatCoords(DEMO_POINT)} has captured fixture data.
              Assessment: 2025-10-15; Rabi 2025: 2025-11-01 to 2026-03-31. SoilGrids and SMAP were unavailable in this capture.
              Rainfed returns zero feasible crops; irrigation available unlocks wheat. USA (Beltsville) and UK (Rothamsted) presets are custom points above.
            </p>
          </div>
          {demoArmed && !catalogError && !pending && !response && !requestError && (
            <p role="status" className="mt-3 text-sm text-[var(--warning-ink)]">
              Pinned demo selected. The form is filled with the authorized fixture dates.
            </p>
          )}
          {demoArmed && pending && (
            <p role="status" className="mt-3 text-sm font-medium text-[var(--warning-ink)]">
              Running the pinned Faisalabad demonstration…
            </p>
          )}
          {demoArmed && response && !pending && (
            <p role="status" className="mt-3 text-sm text-[var(--warning-ink)]">
              {response.feasible_rotation_count === 0
                ? "Rainfed demo complete with no feasible crops. Use Irrigated demo (wheat) for a ranked alternative."
                : "Pinned demo complete. Ranked alternatives are shown on the right."}
            </p>
          )}
          {catalogError && (
            <section role="alert" className="mt-4 space-y-2 rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] p-3 text-[var(--danger-ink)]">
              <p>Crop catalog unavailable: {catalogError}</p>
              <p>The recommendation form cannot load until the API backend is reachable.</p>
              <button
                type="button"
                className="rounded-lg border border-[var(--danger-ink)] px-3 py-1.5 text-sm font-semibold"
                onClick={() => setCatalogAttempt((value) => value + 1)}
              >
                Retry crop catalog
              </button>
            </section>
          )}
        </Reveal>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:items-start">
          <Reveal immediate delayMs={100} variant="left" className="space-y-6">
            <div className="panel p-4 sm:p-5">
              <FieldMap initialLocation={location} onChange={runIrrigatedForLocation} disabled={false} />
            </div>
            {!catalog && !catalogError && (
              <p role="status" className="panel px-4 py-3 text-sm text-[var(--on-surface-variant)]">Loading crop catalog…</p>
            )}
            {catalog && (
              <div className="panel p-4 sm:p-5">
                <RecommendationForm
                  catalog={catalog}
                  initialLocation={location}
                  submitting={pending}
                  onSubmit={submit}
                  demoApplyKey={demoApplyKey}
                  demoIrrigation={demoIrrigation}
                  customApplyKey={customApplyKey}
                  onLocationCommit={selectLocation}
                />
              </div>
            )}
          </Reveal>

          <Reveal delayMs={180} variant="right">
            <div ref={resultsRef} className="panel space-y-8 p-4 sm:p-6" aria-live="polite">
            {pending && (
              <p role="status" className="rounded-xl bg-[var(--info-bg)] px-4 py-3 text-[var(--info-ink)]">
                Building irrigated recommendations…
              </p>
            )}
            {requestError && (
              <p role="alert" className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-[var(--danger-ink)]">
                {requestError}
              </p>
            )}
            {catalogError && !requestError && (
              <p role="alert" className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-[var(--danger-ink)]">
                Crop catalog unavailable. Retry after the backend is running.
              </p>
            )}
            {!response && !pending && !requestError && !catalogError && (
              <div className="rounded-xl border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-10 text-center">
                <p className="font-display text-xl text-[var(--primary)]">Ready when you are</p>
                <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
                  Search a place, use your location, or click the map — irrigated recommendations run automatically.
                  Or start from the pinned Faisalabad irrigated demo.
                </p>
                <button type="button" className="btn-primary mt-4" onClick={() => armDemo("available")}>
                  Run irrigated demo (wheat)
                </button>
              </div>
            )}
            {response && <>
              <RecommendationResults recommendations={response.recommendations}
                feasibleRotationCount={response.feasible_rotation_count} dataQuality={response.data_quality}
                sources={response.sources} warnings={response.warnings} exclusions={response.exclusions}
                onRetryWithIrrigation={showIrrigationRetry ? () => armDemo("available") : undefined}
                retrying={pending} />
              {response.recommendations[0] && <RotationTimeline recommendation={response.recommendations[0]} />}
              <ClimateCharts climate={response.features.climate} scenarios={response.features.slot_scenarios} />
              <SoilRadar soil={response.features.soil} />
            </>}
            </div>
          </Reveal>
        </div>
      </main>
    </div>
  );
}
