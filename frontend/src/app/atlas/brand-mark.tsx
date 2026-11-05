'use client';

import { useId } from 'react';
import { Sprout } from 'lucide-react';

type BrandMarkProps = {
  size?: number;
};

/** Previous header mark: Lucide sprout in the brand tile. */
export default function BrandMark({ size = 28 }: BrandMarkProps) {
  return (
    <span className="ra-brand-icon" aria-hidden="true">
      <Sprout size={size} />
    </span>
  );
}

/** Sidebar footer globe + orbit accent. */
export function OrbitPerspective({ size = 72, duration = 10 }: { size?: number; duration?: number }) {
  const uid = useId().replace(/:/g, '');
  const ellipse = 'M24 5.5A9.8 18.4 0 1 1 23.99 5.5';
  const glow = `ra-orbit-glow-${uid}`;

  return (
    <div className="ra-orbit" aria-hidden="true">
      <svg viewBox="0 0 48 48" width={size} height={size} fill="none">
        <defs>
          <filter id={glow} x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="0.7" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path d={ellipse} stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.85" />
        <circle cx="24" cy="24" r="12.5" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.65" />
        <circle cx="24" cy="24" r="7.4" stroke="currentColor" strokeWidth="1.3" />
        <path
          d="M18.8 21.2c1.7-1.4 3.8-1.9 5.7-1 1.4.6 2.9.3 4-.8M18.6 25.9c1.3 1.1 3 1.6 4.7 1.2 1.5-.4 3 .2 4.2 1.2"
          stroke="currentColor"
          strokeWidth="1.15"
          strokeLinecap="round"
        />
        <g className="ra-logo-sat" filter={`url(#${glow})`}>
          <animateMotion dur={`${duration}s`} repeatCount="indefinite" rotate="0" path={ellipse} />
          <circle r="1.5" fill="currentColor" />
          <circle r="2.4" fill="currentColor" opacity="0.2" />
        </g>
      </svg>
    </div>
  );
}
