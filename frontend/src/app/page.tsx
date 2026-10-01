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

function samePoint(first: Location, second: Location): boolean {
  return first.latitude === second.latitude && first.longitude === second.longitude;
}

export default function HomePage(): ReactElement {
  const [catalog, setCatalog] = useState<CropCatalogResponse | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [location, setLocation] = useState<Location | null>(null);
  const [demoArmed, setDemoArmed] = useState(false);
  const [response, setResponse] = useState<RecommendationResponse | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const active = useRef<AbortController | null>(null);
  const generation = useRef(0);

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

  function selectLocation(next: Location): void {
    if (location && samePoint(location, next)) return;
    active.current?.abort();
    active.current = null;
    generation.current += 1;
    setPending(false);
    setResponse(null);
    setRequestError(null);
    if (!samePoint(next, DEMO_POINT)) setDemoArmed(false);
    setLocation(next);
  }

  function armDemo(): void {
    selectLocation(DEMO_POINT);
    setDemoArmed(true);
    setRequestError(null);
  }

  function submit(request: RecommendationRequest): void {
    if (request.data_mode === "fixture" && (!demoArmed || !samePoint(request.location, DEMO_POINT) ||
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

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 text-slate-900">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Field Shift</h1>
        <p>Explore crop rotation choices using observed climate, local soil context, and transparent agronomic rules.</p>
      </header>
      <section aria-label="Pinned demonstration" className="rounded border border-amber-300 bg-amber-50 p-4">
        <h2 className="font-semibold">Pinned Faisalabad demonstration</h2>
        <p>Only the documented farm at 31.4504° N, 73.1350° E has captured fixture data. Assessment: 2025-10-15; Rabi 2025: 2025-11-01 to 2026-03-31. SoilGrids and SMAP were unavailable in this capture.</p>
        <button type="button" onClick={armDemo} className="mt-2 rounded bg-amber-800 px-3 py-2 text-white">Use pinned Faisalabad demo</button>
        {demoArmed && <p role="status">Pinned demo selected. Choose “Authorized demo fixture” in the form after entering the listed dates.</p>}
      </section>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          <FieldMap initialLocation={location} onChange={selectLocation} disabled={false} />
          {catalogError && <section role="alert"><p>{catalogError}</p><button type="button" onClick={() => setCatalogAttempt((value) => value + 1)}>Retry crop catalog</button></section>}
          {!catalog && !catalogError && <p role="status">Loading crop catalog…</p>}
          {catalog && <RecommendationForm catalog={catalog} initialLocation={location} submitting={pending} onSubmit={submit} />}
        </div>
        <div className="space-y-8" aria-live="polite">
          {pending && <p role="status">Building recommendations…</p>}
          {requestError && <p role="alert">{requestError}</p>}
          {!response && !pending && !requestError && <p>Select a field and submit the form to see crop choices.</p>}
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
