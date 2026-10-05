"use client";

import type { ReactElement } from "react";

export interface SamsungSunProps {
  size?: "md" | "lg" | "xl";
  className?: string;
}

/** Soft pearl sun for the weather stage card (glow + orb, no spokes). */
export function SamsungSun({ size = "lg", className = "" }: SamsungSunProps): ReactElement {
  return (
    <div className={`samsung-sun samsung-sun-${size} ${className}`.trim()} aria-hidden>
      <span className="samsung-sun-outer-glow" />
      <span className="samsung-sun-halo" />
      <span className="samsung-sun-disk" />
      <span className="samsung-sun-highlight" />
    </div>
  );
}
