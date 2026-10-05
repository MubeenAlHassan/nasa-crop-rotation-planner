"use client";

import Link from "next/link";
import { Leaf } from "lucide-react";
import type { ReactElement } from "react";

export interface SiteHeaderProps {
  active?: "home" | "planner";
}

export function SiteHeader({ active = "home" }: SiteHeaderProps): ReactElement {
  return (
    <header className="animate-header-in fixed inset-x-0 top-0 z-50 border-b border-[rgba(20,31,18,0.06)] bg-[rgba(243,252,235,0.88)] backdrop-blur-xl">
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
            <Link
              href="/planner"
              className={`text-sm font-semibold ${active === "planner" ? "text-[var(--primary)]" : "text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"}`}
            >
              Planner
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/planner" className="hidden text-sm font-semibold text-[var(--on-surface-variant)] hover:text-[var(--primary)] sm:inline-flex">
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
