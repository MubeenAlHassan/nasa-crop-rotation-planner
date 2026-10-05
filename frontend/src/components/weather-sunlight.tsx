"use client";

import { useId, type ReactElement } from "react";

export interface WeatherSunlightProps {
  soft?: boolean;
  hot?: boolean;
}

/**
 * Photographic daylight sun: tiny overexposed core + heavy atmospheric bloom.
 * Intentionally not an icon — light should feel like camera bloom in a real sky.
 */
export function WeatherSunlight({ soft = false, hot = false }: WeatherSunlightProps): ReactElement {
  const uid = useId().replace(/:/g, "");
  const coreId = `sun-core-${uid}`;
  const midId = `sun-mid-${uid}`;
  const farId = `sun-far-${uid}`;
  const blurFarId = `sun-blur-far-${uid}`;
  const blurMidId = `sun-blur-mid-${uid}`;
  const blurCoreId = `sun-blur-core-${uid}`;

  const className = [
    "weather-sunlight",
    soft ? "is-soft" : "",
    hot ? "is-hot" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className} aria-hidden>
      <svg className="weather-sunlight-svg" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id={coreId} cx="48%" cy="46%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#fffaf0" />
            <stop offset="70%" stopColor="#ffe8a8" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#ffc85a" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={midId} cx="50%" cy="48%" r="50%">
            <stop offset="0%" stopColor="#fff6d0" stopOpacity="0.9" />
            <stop offset="40%" stopColor="#ffd878" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ffb040" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={farId} cx="52%" cy="45%" r="50%">
            <stop offset="0%" stopColor="#ffe9b0" stopOpacity="0.55" />
            <stop offset="35%" stopColor="#ffc868" stopOpacity="0.22" />
            <stop offset="65%" stopColor="#8ec4ff" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#4aa0ff" stopOpacity="0" />
          </radialGradient>
          <filter id={blurFarId} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="28" />
          </filter>
          <filter id={blurMidId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
          <filter id={blurCoreId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" />
          </filter>
        </defs>

        <circle cx="220" cy="170" r="170" fill={`url(#${farId})`} filter={`url(#${blurFarId})`} className="weather-sunlight-layer weather-sunlight-far" />
        <circle cx="225" cy="165" r="95" fill={`url(#${midId})`} filter={`url(#${blurMidId})`} className="weather-sunlight-layer weather-sunlight-mid" />
        <circle cx="228" cy="160" r="28" fill={`url(#${coreId})`} filter={`url(#${blurCoreId})`} className="weather-sunlight-layer weather-sunlight-core" />
        <circle cx="224" cy="156" r="9" fill="#ffffff" className="weather-sunlight-layer weather-sunlight-pin" />
      </svg>
      <span className="weather-sunlight-wash" />
    </div>
  );
}
