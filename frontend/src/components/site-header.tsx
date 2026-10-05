"use client";

import Link from "next/link";
import { CloudSun, Leaf } from "lucide-react";
import type { ReactElement } from "react";

export interface SiteHeaderProps {
  active?: "home" | "planner" | "weather";
  tone?: "default" | "glass";
}

export function SiteHeader({ active = "home", tone = "default" }: SiteHeaderProps): ReactElement {
  const headerClass = tone === "glass"
    ? "animate-header-in fixed inset-x-0 top-0 z-50 border-b border-white/30 bg-[rgba(243,252,235,0.72)] backdrop-blur-xl"
    : "animate-header-in fixed inset-x-0 top-0 z-50 border-b border-[rgba(20,31,18,0.06)] bg-[rgba(243,252,235,0.88)] backdrop-blur-xl";

  const link = (href: string, label: string, isActive: boolean): ReactElement => (
    <Link
      href={href}
      className={`text-sm font-semibold ${isActive ? "text-[var(--primary)]" : "text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"}`}
    >
      {label}
    </Link>
  );

  return (
    <header className={headerClass}>
      <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-4 sm:px-8">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-container-low)] text-[var(--primary)] shadow-sm">
              <Leaf className="h-5 w-5" aria-hidden />
            </span>
            <span className="flex flex-col">
              <span className="font-display text-lg font-bold leading-none text-[var(--on-surface)]">Field Shift</span>
              <span className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--primary)]">
                Crop rotation decision aid
              </span>
            </span>
          </Link>
          <nav className="hidden items-center gap-6 xl:flex" aria-label="Primary">
            <a href="/#how-it-works" className="text-sm font-semibold text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]">How it works</a>
            <a href="/#capabilities" className="text-sm font-semibold text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]">Capabilities</a>
            <a href="/#demo-farm" className="text-sm font-semibold text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]">Demo farm</a>
            {link("/planner", "Planner", active === "planner")}
            {link("/weather", "Weather prediction", active === "weather")}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/weather"
            className={`hidden items-center gap-1.5 text-sm font-semibold sm:inline-flex ${
              active === "weather" ? "text-[var(--primary)]" : "text-[var(--on-surface-variant)] hover:text-[var(--primary)]"
            }`}
          >
            <CloudSun className="h-4 w-4" aria-hidden />
            Weather
          </Link>
          <Link href="/planner" className="hidden text-sm font-semibold text-[var(--on-surface-variant)] hover:text-[var(--primary)] md:inline-flex">
            Open planner
          </Link>
          <Link href="/planner?demo=1" className="btn-primary text-sm">
            Run pinned demo
          </Link>
        </div>
      </div>
    </header>
  );
}
