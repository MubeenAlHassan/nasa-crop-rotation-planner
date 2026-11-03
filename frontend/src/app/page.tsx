"use client";

import Link from "next/link";
import {
  ArrowRight, CheckCircle2, CloudSun, Droplets, Leaf, MapPin, PlayCircle, Satellite,
  ShieldCheck, SlidersHorizontal, Sprout, ThermometerSun, Wheat, Zap,
} from "lucide-react";
import type { ReactElement } from "react";
import { HeroSlider } from "../components/hero-slider";
import { Reveal } from "../components/reveal";
import { SiteHeader } from "../components/site-header";

const FIELD_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBNPWMVHr9l3IXxvIGer71Zb6ZeiQoruNMoshq_3us-dR-tMwM1fa2LMlXfZFswJRPz6yP59YdR0BTMq7Hx4IJs1Hh2aQkLha3b9YvR0wTofQK8KlDSCysC1Agu58m0SyhHd2-b95ifKvfSAw_wfJBkaNv5gopGImBd7_Ajd-7rkDS5giVY6mluCdAL-7WTh1QCwNAGR4PBXcIny4ChQxU_waqa-Upnb3ay1VcXQTXdYvc7jh9qssBv";
const FARMER_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAH9vBPkVKpwMcFoz7yLd4o-IvQGitcVWCTkYkZeMPWYpfqKel7owb6lVaVDBRPPDLA_mY07IYeChCYmLqTArh8UkDZOt1LiEzs6Ik7YfUDGhmSidcaBU6-7uTk1rXRw3mf4rwClZMa_CyYzPTLtlrAuHuljt3KZ_dOLSYSMoTtsRyPaSmVpNHhr7ZsEZzA8m57bJHJoSYUIuKnCBDsAA3i2V4jqrT5vMMDQaqGL24TRlf_rPiW427O";

export default function LandingPage(): ReactElement {
  return (
    <div className="landing-page min-h-full bg-[var(--background)] text-[var(--on-surface)]">
      <SiteHeader active="home" />
      <main>
        <section aria-label="Field Shift hero" className="w-full pt-20">
          <HeroSlider>
            <div className="landing-hero-grid">
              <div className="landing-hero-copy">
                <Reveal immediate delayMs={40} variant="down" className="landing-hero-kicker">
                  <Satellite className="h-4 w-4" aria-hidden /> NASA Space Apps · Field intelligence
                </Reveal>
                <Reveal immediate delayMs={120} as="h1" className="font-display landing-hero-title">
                  A clearer path to <span>your next crop.</span>
                </Reveal>
                <Reveal immediate delayMs={220} as="p" className="landing-hero-description">
                  Turn observed climate, field context, and transparent agronomic rules into rotation choices you can actually explain.
                </Reveal>
                <Reveal immediate delayMs={320} className="landing-hero-actions">
                  <Link href="/planner" className="landing-hero-primary">
                    Open the planner <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                  <Link href="/planner?location=sahiwal" className="landing-hero-secondary">
                    <PlayCircle className="h-5 w-5" aria-hidden /> Explore the Sahiwal field
                  </Link>
                </Reveal>
                <Reveal immediate delayMs={390} className="landing-hero-proof">
                  <span><CheckCircle2 className="h-4 w-4" aria-hidden /> Constraints before scores</span>
                  <span><ShieldCheck className="h-4 w-4" aria-hidden /> Sources shown clearly</span>
                </Reveal>
              </div>
              <Reveal immediate delayMs={250} variant="right" className="landing-preview-wrap">
                <div className="landing-preview-card">
                  <div className="landing-preview-top">
                    <span className="landing-preview-mark"><Leaf className="h-5 w-5" aria-hidden /></span>
                    <div><p className="landing-preview-eyebrow">Decision preview</p><p className="font-display text-lg font-bold">Sahiwal field</p></div>
                    <span className="landing-preview-live"><span /> Live NASA POWER</span>
                  </div>
                  <div className="landing-preview-main">
                    <p className="landing-preview-eyebrow">Rabi season · live climate insight</p>
                    <h2 className="font-display mt-2 text-2xl font-bold tracking-tight">See which crops fit Sahiwal&apos;s observed season.</h2>
                    <p className="mt-2 text-sm text-[#51635b]">Current rainfall and temperature are compared with the 1991–2020 baseline before any crop is ranked.</p>
                  </div>
                  <div className="landing-preview-steps">
                    <div className="landing-preview-step" style={{ ["--step-delay" as string]: "80ms" }}>
                      <span>01</span>
                      <div><strong>Locate the field</strong><small>Sahiwal, Punjab · 30.66° N, 73.11° E</small></div>
                      <CheckCircle2 className="h-4 w-4" aria-hidden />
                    </div>
                    <div className="landing-preview-step" style={{ ["--step-delay" as string]: "180ms" }}>
                      <span>02</span>
                      <div><strong>Apply constraints</strong><small>Calendar and irrigation checked first</small></div>
                      <CheckCircle2 className="h-4 w-4" aria-hidden />
                    </div>
                    <div className="landing-preview-step is-highlight" style={{ ["--step-delay" as string]: "280ms" }}>
                      <span>03</span>
                      <div><strong>Compare alternatives</strong><small>Ranked by observed climate, soil context, and your priority</small></div>
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </div>
                  </div>
                  <div className="landing-preview-footer">
                    <span><Satellite className="h-4 w-4" aria-hidden /> NASA POWER climate context</span>
                    <Link href="/weather" className="landing-preview-weather" aria-label="Open weather dashboard">
                      <CloudSun className="h-4 w-4" aria-hidden />
                      <span>Weather for fieldwork</span>
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </div>
                </div>
              </Reveal>
            </div>
          </HeroSlider>
        </section>

        <section className="px-4 py-6 sm:px-8">
          <div className="mx-auto grid max-w-[1440px] gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Satellite, title: "NASA POWER climate", body: "Observed rainfall and temperature context with explicit baseline comparison." },
              { icon: Leaf, title: "Transparent scoring", body: "Deterministic component weights and reason codes — never invented rankings." },
              { icon: ShieldCheck, title: "Honest provenance", body: "Every response labels fixture, live, cache, or unavailable sources." },
              { icon: CheckCircle2, title: "Hard constraints first", body: "Calendar, irrigation, and catalog rules filter crops before scoring." },
            ].map((item, index) => (
              <Reveal key={item.title} delayMs={index * 90} variant="up" className="panel flex h-full flex-col gap-3 p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--surface-container-low)] text-[var(--primary)]">
                  <item.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="font-display text-lg font-semibold text-[var(--primary)]">{item.title}</h3>
                <p className="text-sm text-[var(--on-surface-variant)]">{item.body}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="px-4 py-12 sm:px-8">
          <div className="mx-auto grid max-w-[1440px] items-center gap-10 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-6">
              <Reveal>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">Effortless agronomy</p>
                <h2 className="font-display mt-2 text-3xl font-bold tracking-tight">Smart farming, made remarkably simple</h2>
                <p className="mt-3 text-[var(--on-surface-variant)]">
                  Three clear steps turn field coordinates and planting slots into explainable rotation alternatives.
                </p>
              </Reveal>
              {[
                ["1", "Select the field", "Sahiwal opens by default with live NASA POWER climate. Pin any map location, or use the pre-authorized Faisalabad offline fixture."],
                ["2", "Enter history and slots", "Add completed crops, irrigation, and dated Rabi/Kharif planting windows."],
                ["3", "Review ranked alternatives", "Read scores, reasons, exclusions, climate charts, and source provenance side by side."],
              ].map(([step, title, body], index) => (
                <Reveal key={step} delayMs={index * 100} variant="left" className="panel flex gap-4 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary-fixed)] font-display text-lg font-bold text-[var(--on-primary-fixed)]">
                    {step}
                  </span>
                  <div>
                    <h3 className="font-display font-semibold">{title}</h3>
                    <p className="mt-1 text-sm text-[var(--on-surface-variant)]">{body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal delayMs={120} variant="right" className="relative lg:col-span-6">
              <div className="landing-explainable overflow-hidden rounded-2xl shadow-[var(--shadow-lift)]">
                <img
                  src={FIELD_IMAGE}
                  alt="Soil moisture probe among leafy crops in bright daylight"
                  className="h-[420px] w-full object-cover sm:h-[480px]"
                />
              </div>
              <div className="landing-explainable-card absolute inset-x-6 bottom-6 rounded-2xl p-5 shadow-xl">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--on-surface)]">
                    Sahiwal field · Rabi slot
                  </span>
                  <span className="badge bg-[var(--primary-fixed)] text-[var(--on-primary-fixed)]">Live climate</span>
                </div>
                <p className="font-display text-3xl font-bold text-[var(--primary)]">Explainable</p>
                <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
                  Climate anomalies · catalog constraints · provenance for POWER, SoilGrids, and SMAP
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="capabilities" className="bg-[var(--surface-container-low)] px-4 py-12 sm:px-8">
          <div className="mx-auto max-w-[1440px]">
            <Reveal className="mx-auto mb-10 max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">Designed for practical farming</p>
              <h2 className="font-display mt-2 text-3xl font-bold">Clear insights, honest limits</h2>
              <p className="mt-3 text-[var(--on-surface-variant)]">
                Field Shift states what each source can and cannot support. Missing SoilGrids or SMAP stays visible as unavailable.
              </p>
            </Reveal>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                { icon: CloudSun, title: "Climate fit without forecasts", body: "Uses observed anomalies and historical stress scenarios for requested slots — not daily future weather." },
                { icon: Sprout, title: "Rotation feasibility first", body: "Hard constraints remove impossible crops before any suitability score is shown." },
                { icon: Satellite, title: "Source-aware decisions", body: "Each recommendation carries mode, product, retrieval time, and fixture identity when demo data is used." },
              ].map((item, index) => (
                <Reveal key={item.title} delayMs={index * 110} variant="up" className="panel flex h-full flex-col p-6">
                  <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--primary-fixed)] text-[var(--primary)]">
                    <item.icon className="h-6 w-6" aria-hidden />
                  </span>
                  <h3 className="font-display text-xl font-semibold">{item.title}</h3>
                  <p className="mt-3 flex-1 text-[var(--on-surface-variant)]">{item.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="challenge-coverage" className="px-4 py-12 sm:px-8">
          <div className="mx-auto max-w-[1440px]">
            <Reveal className="mx-auto mb-10 max-w-3xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">NASA Space Apps challenge</p>
              <h2 className="font-display mt-2 text-3xl font-bold">Every challenge requirement, answered in the product</h2>
              <p className="mt-3 text-[var(--on-surface-variant)]">
                The challenge asks for a decision-support tool built on NASA Earth observations, local soil, crop
                characteristics, and farmer priorities. Here is where each one lives in Field Shift.
              </p>
            </Reveal>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: ThermometerSun,
                  need: "Shifting temperatures & rainfall",
                  how: "NASA POWER daily rainfall and temperature are compared against the 1991–2020 baseline, with anomaly bands shown for every assessment window.",
                  where: "Planner → Weather & climate tab",
                },
                {
                  icon: Zap,
                  need: "Extreme weather",
                  how: "Severe-dry, severe-wet, and high-heat bands raise an explicit stress alert and feed the climate adaptation score of every crop option.",
                  where: "Planner → Weather & climate tab",
                },
                {
                  icon: Droplets,
                  need: "Water shortages",
                  how: "Rainfed versus irrigated scenarios are first-class: infeasible rainfed plans show exactly which crops irrigation would unlock, plus a water-conservation priority.",
                  where: "Planner → Plan step, irrigation setting",
                },
                {
                  icon: Sprout,
                  need: "Declining soil health",
                  how: "Nitrogen transitions, root-class diversity, and pH/organic-carbon context are scored per rotation and summarized as soil & rotation fit signals.",
                  where: "Planner → Soil & water tab",
                },
                {
                  icon: MapPin,
                  need: "Local soil information",
                  how: "SoilGrids map estimates when available, and a farmer-entered 0–30 cm soil sample (pH, carbon, nitrogen, texture) that overrides the map for screening.",
                  where: "Planner → Plan step, farmer soil observations",
                },
                {
                  icon: Wheat,
                  need: "Crop characteristics",
                  how: "Versioned regional catalogs (Punjab, Maryland, England) carry each crop's calendar, family, nitrogen demand, rooting class, rainfall, temperature, and pH ranges.",
                  where: "Planner → crop guide & crop characteristics",
                },
                {
                  icon: SlidersHorizontal,
                  need: "Farmer priorities",
                  how: "A balanced, water-conservation, soil-health, or climate-adaptation objective transparently remaps scoring weights — hard agronomic rules always apply first.",
                  where: "Planner → Plan step, farmer priority",
                },
                {
                  icon: Satellite,
                  need: "NASA Earth observations",
                  how: "POWER climate context on every request; SMAP surface moisture from versioned Earthdata captures where prepared — never invented for unsupported farms.",
                  where: "Planner → Data notes tab",
                },
                {
                  icon: ShieldCheck,
                  need: "Rotation strategies & resilience",
                  how: "Feasibility rules filter the calendar and water constraints first, then ranked, explainable alternatives show scores, reasons, and exclusions side by side.",
                  where: "Planner → Recommended crops tab",
                },
              ].map((item, index) => (
                <Reveal key={item.need} delayMs={index * 70} variant="up" className="panel flex h-full flex-col gap-3 p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-fixed)] text-[var(--primary)]">
                      <item.icon className="h-5 w-5" aria-hidden />
                    </span>
                    <h3 className="font-display text-base font-bold leading-snug">{item.need}</h3>
                  </div>
                  <p className="flex-1 text-sm text-[var(--on-surface-variant)]">{item.how}</p>
                  <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)]">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {item.where}
                  </p>
                </Reveal>
              ))}
            </div>
            <Reveal delayMs={120} className="mx-auto mt-8 max-w-3xl rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-5 py-4 text-center text-sm text-[var(--on-surface-variant)]">
              Honest limits: scores are heuristic suitability — not yield, revenue, or water-savings guarantees. Missing
              SoilGrids or SMAP data is labeled unavailable instead of being invented, and climate context is observed
              history, not a weather forecast.
            </Reveal>
          </div>
        </section>

        <section id="demo-farm" className="px-4 py-12 sm:px-8">
          <div className="mx-auto max-w-[1440px]">
            <Reveal variant="scale" className="panel overflow-hidden p-6 sm:p-8">
              <div className="grid items-center gap-8 lg:grid-cols-12">
                <div className="lg:col-span-5">
                  <div className="relative h-[360px] overflow-hidden rounded-xl shadow-md sm:h-[440px]">
                    <img src={FARMER_IMAGE} alt="Grower standing in a sunlit wheat field near an irrigation channel" className="h-full w-full object-cover" />
                    <div className="absolute bottom-4 left-4 rounded-full bg-[rgba(255,255,255,0.92)] px-3 py-1 text-xs font-semibold text-[var(--primary)] shadow">
                      Sahiwal, Punjab
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-7">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">Default demonstration field</p>
                  <blockquote className="font-display mt-3 text-2xl font-semibold leading-snug tracking-tight">
                    “Sahiwal runs on current NASA POWER climate — observed rainfall and temperature against the 1991–2020
                    baseline — then ranks Rabi crops with transparent reasons. Soil and satellite moisture are labeled
                    honestly whenever they are unavailable.”
                  </blockquote>
                  <p className="mt-6 font-semibold">What the Sahiwal run uses</p>
                  <p className="text-sm text-[var(--on-surface-variant)]">
                    Live POWER rainfall & temperature · Punjab crop catalog · irrigated scenario by default · SoilGrids & SMAP shown as unavailable unless captured
                  </p>
                  <div className="mt-6 rounded-xl bg-[var(--surface-container-low)] p-4 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">Next step</p>
                      <p className="font-display text-lg font-bold text-[var(--primary)]">Open the Sahiwal field in the planner</p>
                    </div>
                    <Link href="/planner?location=sahiwal" className="btn-primary mt-3 sm:mt-0">
                      Launch Sahiwal
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </div>
                  <p className="mt-3 text-xs text-[var(--on-surface-variant)]">
                    Offline judging without internet? The pinned{" "}
                    <Link href="/planner?demo=1" className="font-semibold text-[var(--primary)] underline-offset-2 hover:underline">
                      Faisalabad fixture demo
                    </Link>{" "}
                    (assessment 2025-10-15, slot rabi_2025) is the only captured archive.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="px-4 pb-12 sm:px-8">
          <Reveal variant="up" className="relative mx-auto max-w-[1440px] overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--primary)] via-[var(--primary-container)] to-[#006d30] px-6 py-14 text-center text-white shadow-[var(--shadow-lift)] sm:px-20">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Ready to explore your next rotation?</h2>
            <p className="mx-auto mt-3 max-w-xl text-[var(--on-primary-container)]">
              Open the planner, see Sahiwal&apos;s live results, then change irrigation or your priority to see how the ranking shifts.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/planner?location=sahiwal" className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-bold text-[var(--primary)] shadow-md">
                See the Sahiwal field
              </Link>
              <Link href="/planner" className="inline-flex items-center justify-center rounded-full border border-white/40 px-6 py-3 text-sm font-bold text-white">
                Open planner
              </Link>
            </div>
          </Reveal>
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
