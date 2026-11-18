"use client";

import { Suspense, type ReactElement } from "react";
import PlannerClient from "./planner-client";

export default function PlannerPage(): ReactElement {
  return (
    <Suspense fallback={<div className="px-4 py-28 text-center text-[var(--on-surface-variant)]">Loading planner…</div>}>
      <PlannerClient />
    </Suspense>
  );
}
