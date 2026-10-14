"use client";

import type { ReactElement } from "react";

export type PlannerStep = "field" | "plan" | "results";

export interface PlannerStepNavProps {
  step: PlannerStep;
  onChange: (step: PlannerStep) => void;
  resultsReady: boolean;
}

const STEPS: ReadonlyArray<{ id: PlannerStep; label: string; hint: string }> = [
  { id: "field", label: "1. Field", hint: "Where is the farm?" },
  { id: "plan", label: "2. Plan", hint: "Dates and preferences" },
  { id: "results", label: "3. Results", hint: "What to plant next" },
];

export function PlannerStepNav({ step, onChange, resultsReady }: PlannerStepNavProps): ReactElement {
  return (
    <nav aria-label="Planner steps" className="panel p-2 sm:p-3">
      <ol className="grid gap-2 sm:grid-cols-3">
        {STEPS.map((item) => {
          const active = step === item.id;
          const disabled = item.id === "results" && !resultsReady;
          return (
            <li key={item.id}>
              <button
                type="button"
                disabled={disabled}
                aria-current={active ? "step" : undefined}
                onClick={() => onChange(item.id)}
                className={`flex w-full flex-col rounded-xl px-3 py-3 text-left transition ${
                  active
                    ? "bg-[var(--primary)] text-white shadow-sm"
                    : disabled
                      ? "cursor-not-allowed bg-[var(--surface-container-low)] text-[var(--outline)]"
                      : "bg-[var(--surface-container-low)] text-[var(--on-surface)] hover:bg-[var(--surface-container)]"
                }`}
              >
                <span className="text-sm font-semibold">{item.label}</span>
                <span className={`mt-0.5 text-xs ${active ? "text-white/85" : "text-[var(--on-surface-variant)]"}`}>
                  {item.hint}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
