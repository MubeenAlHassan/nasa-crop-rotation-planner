"use client";

import type { ReactElement } from "react";

export interface SamsungSunProps {
  size?: "md" | "lg" | "xl";
  className?: string;
}

/**
 * Layered animated sun for clear/partly skies:
 * corona bloom → soft rotating rays → chromosphere → photosphere → drifting highlight.
 */
export function SamsungSun({ size = "lg", className = "" }: SamsungSunProps): ReactElement {
  return (
    <div className={`samsung-sun samsung-sun-${size} ${className}`.trim()} aria-hidden>
      <span className="samsung-sun-corona" />
      <span className="samsung-sun-rays" />
      <span className="samsung-sun-chromosphere" />
      <span className="samsung-sun-photosphere" />
      <span className="samsung-sun-limb" />
      <span className="samsung-sun-flare" />
      <span className="samsung-sun-highlight" />
    </div>
  );
}
