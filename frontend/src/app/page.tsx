"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import { ClimateCharts } from "../components/climate-charts";
import { FieldMap } from "../components/field-map";
import { RecommendationForm } from "../components/recommendation-form";
import { RecommendationResults } from "../components/recommendation-results";
import { RotationTimeline } from "../components/rotation-timeline";
import { SoilRadar } from "../components/soil-radar";
import { fetchCropCatalog, recommendRotation } from "../lib/api/client";
import type { CropCatalogResponse, Location, RecommendationRequest, RecommendationResponse } from "../lib/generated/contracts";

const DEMO_POINT: Location = { latitude: 31.4504, longitude: 73.135 };

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

function samePoint(first: Location, second: Location): boolean {
  return first.latitude === second.latitude && first.longitude === second.longitude;
}

export default function HomePage(): ReactElement {
  const [catalog, setCatalog] = useState<CropCatalogResponse | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [location, setLocation] = useState<Location | null>(null);
  const [demoArmed, setDemoArmed] = useState(false);
  const [demoApplyKey, setDemoApplyKey] = useState(0);
  const [response, setResponse] = useState<RecommendationResponse | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const active = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const demoArmedRef = useRef(false);
  const resultsRef = useRef<HTMLDivElement | null>(null);

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
        setRequestError(failure instanceof Error ? failure.message : "Recommendation request failed.");
      }
    }).finally(() => {
      if (current === generation.current) {
        active.current = null;
        setPending(false);
      }
    });
  }

  function armDemo(): void {
    selectLocation(DEMO_POINT);
    demoArmedRef.current = true;
    setDemoArmed(true);
    setDemoApplyKey((value) => value + 1);
    setRequestError(null);
    if (!catalog) {
      setRequestError("Crop catalog is still loading. Wait a moment, then click the pinned demo again.");
      return;
    }
    submit(DEMO_REQUEST);
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 text-[var(--foreground)] sm:px-6 lg:px-8">
      <header className="soft-panel px-5 py-6 sm:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">NASA data · transparent rules</p>
        <h1 className="mt-2 text-4xl font-bold text-[var(--brand-strong)] sm:text-5xl">Field Shift</h1>
        <p className="mt-3 max-w-2xl text-base text-[var(--muted)] sm:text-lg">
          Explore crop rotation choices using observed climate, local soil context, and transparent agronomic rules.
        </p>
      </header>

      <section
        aria-label="Pinned demonstration"
        className="overflow-hidden rounded-2xl border border-[var(--warning-border)] bg-[var(--warning-bg)] p-5 shadow-sm sm:p-6"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-2 text-[var(--warning-ink)]">
            <h2 className="text-xl font-semibold">Pinned Faisalabad demonstration</h2>
            <p className="text-sm leading-relaxed sm:text-base">
              Only the documented farm at 31.4504° N, 73.1350° E has captured fixture data.
              Assessment: 2025-10-15; Rabi 2025: 2025-11-01 to 2026-03-31. SoilGrids and SMAP were unavailable in this capture.
            </p>
          </div>
          <button
            type="button"
            onClick={armDemo}
            disabled={pending}
            className="shrink-0 rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-strong)]"
          >
            {pending && demoArmed ? "Running pinned demo…" : "Use pinned Faisalabad demo"}
          </button>
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
            Pinned demo complete. Results are shown on the right; you can change irrigation in the form and submit again.
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
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:items-start">
        <div className="space-y-6">
          <div className="panel p-4 sm:p-5">
            <FieldMap initialLocation={location} onChange={selectLocation} disabled={false} />
          </div>
          {!catalog && !catalogError && (
            <p role="status" className="panel px-4 py-3 text-sm text-[var(--muted)]">Loading crop catalog…</p>
          )}
          {catalog && (
            <div className="panel p-4 sm:p-5">
              <RecommendationForm
                catalog={catalog}
                initialLocation={location}
                submitting={pending}
                onSubmit={submit}
                demoApplyKey={demoApplyKey}
              />
            </div>
          )}
        </div>

        <div ref={resultsRef} className="panel space-y-8 p-4 sm:p-6" aria-live="polite">
          {pending && (
            <p role="status" className="rounded-xl bg-[var(--info-bg)] px-4 py-3 text-[var(--info-ink)]">
              Building recommendations…
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
            <div className="rounded-xl border border-dashed border-[var(--panel-border)] bg-[#fbfffc] px-4 py-10 text-center">
              <p className="font-display text-xl text-[var(--brand-strong)]">Ready when you are</p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Select a field and submit the form to see crop choices.
              </p>
            </div>
          )}
          {response && <>
            <RecommendationResults recommendations={response.recommendations}
              feasibleRotationCount={response.feasible_rotation_count} dataQuality={response.data_quality}
              sources={response.sources} warnings={response.warnings} exclusions={response.exclusions} />
            {response.recommendations[0] && <RotationTimeline recommendation={response.recommendations[0]} />}
            <ClimateCharts climate={response.features.climate} scenarios={response.features.slot_scenarios} />
            <SoilRadar soil={response.features.soil} />
          </>}
        </div>
      </div>
    </main>
  );
}
