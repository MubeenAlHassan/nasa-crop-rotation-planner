"use client";

import Link from "next/link";
import {
  ArrowRight, CheckCircle2, CloudSun, Leaf, MapPinned, PlayCircle, Satellite, ShieldCheck, Sprout,
} from "lucide-react";
import type { ReactElement } from "react";
import { SiteHeader } from "../components/site-header";

const HERO_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBmViBBcXoqTEL19ku5fNM-FRnnGiPnX16A66PGOz0TvWfGAbFHeaCQYwomE6p8PT0cugkXu4sZy-ehhjcpXiKX59GaJnwR0yt1vuoPhMUJ7Z2AowgwjoKbBJthSGzNao4F9x-6E4JjX5b5vq-jZ32OLqbwXoCCSFiKyWCRgROj6iRC6elNlZMLEPYqpTSgcbidfSmUTSjKnibtwXYfi1K1mJPILu_9CfO9ltiRVQePz-5do9DcDnUY";
const FIELD_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBNPWMVHr9l3IXxvIGer71Zb6ZeiQoruNMoshq_3us-dR-tMwM1fa2LMlXfZFswJRPz6yP59YdR0BTMq7Hx4IJs1Hh2aQkLha3b9YvR0wTofQK8KlDSCysC1Agu58m0SyhHd2-b95ifKvfSAw_wfJBkaNv5gopGImBd7_Ajd-7rkDS5giVY6mluCdAL-7WTh1QCwNAGR4PBXcIny4ChQxU_waqa-Upnb3ay1VcXQTXdYvc7jh9qssBv";
const FARMER_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAH9vBPkVKpwMcFoz7yLd4o-IvQGitcVWCTkYkZeMPWYpfqKel7owb6lVaVDBRPPDLA_mY07IYeChCYmLqTArh8UkDZOt1LiEzs6Ik7YfUDGhmSidcaBU6-7uTk1rXRw3mf4rwClZMa_CyYzPTLtlrAuHuljt3KZ_dOLSYSMoTtsRyPaSmVpNHhr7ZsEZzA8m57bJHJoSYUIuKnCBDsAA3i2V4jqrT5vMMDQaqGL24TRlf_rPiW427O";

export default function LandingPage(): ReactElement {
  return (
    <div className="min-h-full bg-[var(--background)] text-[var(--on-surface)]">
      <SiteHeader active="home" />
      <main className="pt-20">
        <section className="px-4 py-10 sm:px-8 sm:py-14">
          <div className="mx-auto flex max-w-[1440px] flex-col items-center text-center">
            <div className="badge mb-6 bg-[var(--surface-container)] text-[var(--primary)] shadow-sm">
              <ShieldCheck className="h-4 w-4" aria-hidden />
              NASA Space Apps · Explainable crop-rotation decision aid
            </div>
            <h1 className="font-display max-w-4xl text-3xl font-bold tracking-tight text-[var(--on-surface)] sm:text-5xl">
              Smarter rotation choices, grounded in observed climate and transparent rules
            </h1>
            <p className="mt-4 max-w-2xl text-base text-[var(--on-surface-variant)] sm:text-lg">
              Field Shift ranks feasible next crops from NASA POWER climate context, local soil signals, and
              deterministic agronomic constraints — not yield forecasts or fertilizer prescriptions.
            </p>
            <div className="mt-8 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
              <Link href="/planner" className="btn-primary w-full sm:w-auto">
                Open the planner
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/planner?demo=1" className="btn-secondary w-full sm:w-auto">
                <PlayCircle className="h-5 w-5 text-[var(--primary)]" aria-hidden />
                Watch pinned field demo
              </Link>
            </div>

            <div className="relative mt-10 w-full max-w-5xl overflow-hidden rounded-2xl bg-[var(--surface-container-lowest)] shadow-[var(--shadow-lift)]">
              <div className="relative h-[280px] w-full sm:h-[420px] md:h-[520px]">
                <img
                  src={HERO_IMAGE}
                  alt="Sunlit irrigated cropland with a center-pivot system across fertile plains"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[rgba(22,30,19,0.45)] via-transparent to-transparent" />
                <div className="absolute left-4 top-4 flex items-center gap-3 rounded-xl bg-[rgba(255,255,255,0.95)] p-3 shadow-lg sm:left-8 sm:top-8 sm:p-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--secondary-fixed)] text-[var(--secondary)]">
                    <CloudSun className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="text-left">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">Observed climate</p>
                    <p className="font-display text-sm font-semibold sm:text-base">90-day POWER anomalies</p>
                  </div>
                </div>
                <div className="absolute bottom-4 left-4 flex items-center gap-3 rounded-xl bg-[rgba(255,255,255,0.95)] p-3 shadow-lg sm:bottom-8 sm:left-8 sm:p-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-fixed)] text-[var(--primary)]">
                    <MapPinned className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="text-left">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">Pinned demo farm</p>
                    <p className="font-display text-sm font-semibold sm:text-base">Faisalabad 31.4504° N, 73.135° E</p>
                  </div>
                </div>
                <div className="absolute bottom-4 right-4 hidden items-center gap-3 rounded-xl bg-[rgba(255,255,255,0.95)] p-4 shadow-lg sm:flex">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--tertiary-fixed)] text-[var(--tertiary)]">
                    <Sprout className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="text-left">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">Decision output</p>
                    <p className="font-display text-sm font-semibold">Ranked rotations + reasons</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-6 sm:px-8">
          <div className="mx-auto grid max-w-[1440px] gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Satellite, title: "NASA POWER climate", body: "Observed rainfall and temperature context with explicit baseline comparison." },
              { icon: Leaf, title: "Transparent scoring", body: "Deterministic component weights and reason codes — never invented rankings." },
              { icon: ShieldCheck, title: "Honest provenance", body: "Every response labels fixture, live, cache, or unavailable sources." },
              { icon: CheckCircle2, title: "Hard constraints first", body: "Calendar, irrigation, and catalog rules filter crops before scoring." },
            ].map((item) => (
              <div key={item.title} className="panel flex flex-col gap-3 p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--surface-container-low)] text-[var(--primary)]">
                  <item.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="font-display text-lg font-semibold text-[var(--primary)]">{item.title}</h3>
                <p className="text-sm text-[var(--on-surface-variant)]">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="px-4 py-12 sm:px-8">
          <div className="mx-auto grid max-w-[1440px] items-center gap-10 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">Effortless agronomy</p>
                <h2 className="font-display mt-2 text-3xl font-bold tracking-tight">Smart farming, made remarkably simple</h2>
                <p className="mt-3 text-[var(--on-surface-variant)]">
                  Three clear steps turn field coordinates and planting slots into explainable rotation alternatives.
                </p>
              </div>
              {[
                ["1", "Select the field", "Pin a map location or enter WGS84 coordinates. The Faisalabad demo is pre-authorized with fixture data."],
                ["2", "Enter history and slots", "Add completed crops, irrigation, and dated Rabi/Kharif planting windows."],
                ["3", "Review ranked alternatives", "Read scores, reasons, exclusions, climate charts, and source provenance side by side."],
              ].map(([step, title, body]) => (
                <div key={step} className="panel flex gap-4 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary-fixed)] font-display text-lg font-bold text-[var(--on-primary-fixed)]">
                    {step}
                  </span>
                  <div>
                    <h3 className="font-display font-semibold">{title}</h3>
                    <p className="mt-1 text-sm text-[var(--on-surface-variant)]">{body}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="relative lg:col-span-6">
              <div className="overflow-hidden rounded-2xl shadow-[var(--shadow-lift)]">
                <img src={FIELD_IMAGE} alt="Soil moisture probe among leafy crops in bright daylight" className="h-[420px] w-full object-cover sm:h-[480px]" />
              </div>
              <div className="absolute inset-x-6 bottom-6 rounded-2xl bg-[rgba(255,255,255,0.95)] p-5 shadow-xl backdrop-blur">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--on-surface)]">Faisalabad demo · Rabi slot</span>
                  <span className="badge bg-[var(--primary-fixed)] text-[var(--on-primary-fixed)]">Fixture ready</span>
                </div>
                <p className="font-display text-3xl font-bold text-[var(--primary)]">Explainable</p>
                <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
                  Climate anomalies · catalog constraints · provenance for POWER, SoilGrids, and SMAP
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="capabilities" className="bg-[var(--surface-container-low)] px-4 py-12 sm:px-8">
          <div className="mx-auto max-w-[1440px]">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">Designed for practical farming</p>
              <h2 className="font-display mt-2 text-3xl font-bold">Clear insights, honest limits</h2>
              <p className="mt-3 text-[var(--on-surface-variant)]">
                Field Shift states what each source can and cannot support. Missing SoilGrids or SMAP stays visible as unavailable.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                { icon: CloudSun, title: "Climate fit without forecasts", body: "Uses observed anomalies and historical stress scenarios for requested slots — not daily future weather." },
                { icon: Sprout, title: "Rotation feasibility first", body: "Hard constraints remove impossible crops before any suitability score is shown." },
                { icon: Satellite, title: "Source-aware decisions", body: "Each recommendation carries mode, product, retrieval time, and fixture identity when demo data is used." },
              ].map((item) => (
                <div key={item.title} className="panel flex flex-col p-6">
                  <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--primary-fixed)] text-[var(--primary)]">
                    <item.icon className="h-6 w-6" aria-hidden />
                  </span>
                  <h3 className="font-display text-xl font-semibold">{item.title}</h3>
                  <p className="mt-3 flex-1 text-[var(--on-surface-variant)]">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="demo-farm" className="px-4 py-12 sm:px-8">
          <div className="mx-auto max-w-[1440px]">
            <div className="panel overflow-hidden p-6 sm:p-8">
              <div className="grid items-center gap-8 lg:grid-cols-12">
                <div className="lg:col-span-5">
                  <div className="relative h-[360px] overflow-hidden rounded-xl shadow-md sm:h-[440px]">
                    <img src={FARMER_IMAGE} alt="Grower standing in a sunlit wheat field near an irrigation channel" className="h-full w-full object-cover" />
                    <div className="absolute bottom-4 left-4 rounded-full bg-[rgba(255,255,255,0.92)] px-3 py-1 text-xs font-semibold text-[var(--primary)] shadow">
                      Faisalabad, Punjab
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-7">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">Pinned demonstration</p>
                  <blockquote className="font-display mt-3 text-2xl font-semibold leading-snug tracking-tight">
                    “Only one authorized farm has captured fixture data. The rainfed Rabi demo shows exclusions honestly —
                    then irrigation availability unlocks a wheat alternative with transparent reasons.”
                  </blockquote>
                  <p className="mt-6 font-semibold">Authorized demo capture</p>
                  <p className="text-sm text-[var(--on-surface-variant)]">
                    Assessment 2025-10-15 · Slot rabi_2025 · Fixture faisalabad_2025 · SoilGrids & SMAP unavailable in this capture
                  </p>
                  <div className="mt-6 rounded-xl bg-[var(--surface-container-low)] p-4 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">Next step</p>
                      <p className="font-display text-lg font-bold text-[var(--primary)]">Run the pinned Faisalabad demo in the planner</p>
                    </div>
                    <Link href="/planner?demo=1" className="btn-primary mt-3 sm:mt-0">
                      Launch demo
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 pb-12 sm:px-8">
          <div className="relative mx-auto max-w-[1440px] overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--primary)] via-[var(--primary-container)] to-[#006d30] px-6 py-14 text-center text-white shadow-[var(--shadow-lift)] sm:px-20">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Ready to explore your next rotation?</h2>
            <p className="mx-auto mt-3 max-w-xl text-[var(--on-primary-container)]">
              Open the planner, run the pinned demo, then change irrigation to see how constraints reshape feasible crops.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/planner?demo=1" className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-bold text-[var(--primary)] shadow-md">
                Watch pinned field demo
              </Link>
              <Link href="/planner" className="inline-flex items-center justify-center rounded-full border border-white/40 px-6 py-3 text-sm font-bold text-white">
                Open planner
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[rgba(20,31,18,0.06)] bg-[var(--surface-container-low)] py-10">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--surface-container)] text-[var(--primary)]">
              <Leaf className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <p className="font-display font-bold">Field Shift</p>
              <p className="text-sm text-[var(--on-surface-variant)]">Explainable rotations with NASA open science data.</p>
            </div>
          </div>
          <p className="text-sm text-[var(--on-surface-variant)]">Scores are heuristic suitability — not harvest predictions.</p>
        </div>
      </footer>
    </div>
  );
}
