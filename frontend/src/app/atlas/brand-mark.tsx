'use client';

import { useId } from 'react';
import { Sprout } from 'lucide-react';

type BrandMarkProps = {
  size?: number;
};

/** Header mark: Lucide sprout in the brand tile. */
export default function BrandMark({ size = 28 }: BrandMarkProps) {
  return (
    <span className="ra-brand-icon" aria-hidden="true">
      <Sprout size={size} />
    </span>
  );
}

function orbitEllipse(cx: number, cy: number, rx: number, ry: number, deg: number): string {
  const φ = (deg * Math.PI) / 180;
  const topX = cx + ry * Math.sin(φ);
  const topY = cy - ry * Math.cos(φ);
  const botX = cx - ry * Math.sin(φ);
  const botY = cy + ry * Math.cos(φ);
  return `M${topX.toFixed(2)} ${topY.toFixed(2)} A${rx} ${ry} ${deg} 1 1 ${botX.toFixed(2)} ${botY.toFixed(2)} A${rx} ${ry} ${deg} 1 1 ${topX.toFixed(2)} ${topY.toFixed(2)}`;
}

const CX = 24;
const CY = 24;
const INNER = orbitEllipse(CX, CY, 7.2, 11.2, 18);
const MID = orbitEllipse(CX, CY, 9.4, 16.2, -32);
const OUTER = orbitEllipse(CX, CY, 11.2, 20.4, 58);

/** Sidebar solar-system mark: sun, orbital rings, and a moving satellite. */
export function OrbitPerspective({ size = 88, duration = 12 }: { size?: number; duration?: number }) {
  const uid = useId().replace(/:/g, '');
  const sunGrad = `ra-sun-${uid}`;
  const glow = `ra-sat-glow-${uid}`;

  return (
    <div className="ra-orbit" aria-hidden="true">
      <svg viewBox="0 0 48 48" width={size} height={size} fill="none" overflow="visible">
        <defs>
          <radialGradient id={sunGrad} cx="38%" cy="34%" r="65%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.95" />
            <stop offset="55%" stopColor="currentColor" stopOpacity="0.55" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.12" />
          </radialGradient>
          <filter id={glow} x="-160%" y="-160%" width="420%" height="420%">
            <feGaussianBlur stdDeviation="0.85" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Orbital rings */}
        <path d={INNER} stroke="currentColor" strokeWidth="0.95" strokeOpacity="0.38" />
        <path d={MID} stroke="currentColor" strokeWidth="1.05" strokeOpacity="0.55" />
        <path d={OUTER} stroke="currentColor" strokeWidth="1.15" strokeOpacity="0.78" />

        {/* Soft sun halo */}
        <circle cx={CX} cy={CY} r="6.8" fill="currentColor" opacity="0.08" />
        {/* Central sun / Earth */}
        <circle cx={CX} cy={CY} r="4.6" fill={`url(#${sunGrad})`} />
        <circle cx={CX} cy={CY} r="4.6" stroke="currentColor" strokeWidth="1.15" strokeOpacity="0.9" />
        {/* Subtle planet banding */}
        <path
          d="M20.4 22.6c1.2-.7 2.5-.9 3.8-.3 1 .5 2.1.3 3-.5M20.2 25.4c1.1.8 2.4 1.1 3.7.7 1.1-.3 2.2.1 3.1.8"
          stroke="currentColor"
          strokeWidth="0.9"
          strokeLinecap="round"
          strokeOpacity="0.55"
        />

        {/* Inner planet */}
        <g opacity="0.85">
          <animateMotion dur={`${duration * 0.55}s`} begin="-2s" repeatCount="indefinite" rotate="0" path={INNER} />
          <circle r="1.05" fill="currentColor" />
        </g>

        {/* Mid planet */}
        <g opacity="0.7">
          <animateMotion dur={`${duration * 0.8}s`} begin="-5s" repeatCount="indefinite" rotate="0" path={MID} />
          <circle r="0.85" fill="currentColor" />
        </g>

        {/* Outer satellite with glow */}
        <g className="ra-logo-sat" filter={`url(#${glow})`}>
          <animateMotion dur={`${duration}s`} repeatCount="indefinite" rotate="0" path={OUTER} />
          <circle r="2.3" fill="currentColor" opacity="0.18" />
          <circle r="1.45" fill="currentColor" />
        </g>
      </svg>
    </div>
  );
}
