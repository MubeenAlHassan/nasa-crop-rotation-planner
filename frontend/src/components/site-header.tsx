"use client";

import Link from "next/link";
import { CloudSun, Leaf } from "lucide-react";
import type { ReactElement } from "react";

export interface SiteHeaderProps {
  active?: "home" | "planner" | "weather";
  /** @deprecated Kept for call-site compatibility; header styling is always the default treatment. */
  tone?: "default" | "glass";
}

export function SiteHeader({ active = "home" }: SiteHeaderProps): ReactElement {
  // Keep one stable header treatment across home, planner, and weather.
  const headerClass =
    "animate-header-in fixed inset-x-0 top-0 z-50 border-b border-[rgba(20,31,18,0.06)] bg-[rgba(243,252,235,0.88)] backdrop-blur-xl";

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
      <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-8">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-container-low)] text-[var(--primary)] shadow-sm">
              <Leaf className="h-5 w-5" aria-hidden />
            </span>
            <span className="flex flex-col">
              <span className="font-display text-lg font-bold leading-none text-[var(--on-surface)]">Field Shift</span>
              <span className="mt-1 hidden text-[11px] font-semibold uppercase tracking-wide text-[var(--primary)] sm:inline">
                Crop rotation decision aid
              </span>
            </span>
          </Link>
          <nav className="hidden items-center gap-6 xl:flex" aria-label="Primary">
            <Link href="/#how-it-works" className="text-sm font-semibold text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]">How it works</Link>
            <Link href="/#capabilities" className="text-sm font-semibold text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]">Capabilities</Link>
            <Link href="/#demo-farm" className="text-sm font-semibold text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]">Demo farm</Link>
            {link("/planner", "Planner", active === "planner")}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/weather"
            aria-label="Weather dashboard"
            className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-semibold transition-colors sm:px-0 ${
              active === "weather" ? "text-[var(--primary)]" : "text-[var(--on-surface-variant)] hover:text-[var(--primary)]"
            }`}
          >
            <CloudSun className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Weather</span>
          </Link>
          <Link href="/planner" className="hidden text-sm font-semibold text-[var(--on-surface-variant)] hover:text-[var(--primary)] md:inline-flex">
            Open planner
          </Link>
          <Link href="/planner?location=sahiwal" className="btn-primary whitespace-nowrap px-4 text-xs sm:px-6 sm:text-sm">
            <span className="sm:hidden">Sahiwal demo</span><span className="hidden sm:inline">Run Sahiwal demo</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
