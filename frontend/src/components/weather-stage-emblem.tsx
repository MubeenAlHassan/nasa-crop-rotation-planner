"use client";

import type { ReactElement } from "react";
import type { WeatherTheme } from "../lib/weather/codes";

export interface WeatherStageEmblemProps {
  theme: WeatherTheme;
  isDay: boolean;
  label: string;
}

/**
 * Premium frosted emblem for the temperature stage card.
 * Soft filled shapes and muted palette — not thin bright Lucide outlines.
 */
export function WeatherStageEmblem({
  theme,
  isDay,
  label,
}: WeatherStageEmblemProps): ReactElement {
  const nightClear = !isDay && (theme === "clear" || theme === "partly");

  return (
    <div className={`weather-emblem weather-emblem-${theme}${nightClear ? " is-night" : ""}`} aria-hidden title={label}>
      <span className="weather-emblem-glow" />
      <svg className="weather-emblem-svg" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
        {(theme === "rain" || theme === "storm") && (
          <>
            <ellipse cx="38" cy="42" rx="20" ry="14" fill="url(#em-cloud-back)" opacity="0.55" />
            <ellipse cx="58" cy="40" rx="22" ry="16" fill="url(#em-cloud-main)" />
            <ellipse cx="46" cy="46" rx="26" ry="15" fill="url(#em-cloud-front)" />
            <path d="M34 62 L31 72" stroke="url(#em-drop)" strokeWidth="3.2" strokeLinecap="round" className="weather-emblem-drop d1" />
            <path d="M48 64 L45 76" stroke="url(#em-drop)" strokeWidth="3.2" strokeLinecap="round" className="weather-emblem-drop d2" />
            <path d="M62 62 L59 73" stroke="url(#em-drop)" strokeWidth="3.2" strokeLinecap="round" className="weather-emblem-drop d3" />
            {theme === "storm" && (
              <path
                d="M52 48 L44 60 H52 L46 74"
                fill="#f8fafc"
                opacity="0.92"
                className="weather-emblem-bolt"
              />
            )}
          </>
        )}

        {theme === "snow" && (
          <>
            <ellipse cx="48" cy="40" rx="24" ry="16" fill="url(#em-cloud-main)" />
            <ellipse cx="38" cy="46" rx="18" ry="12" fill="url(#em-cloud-front)" opacity="0.85" />
            <circle cx="34" cy="66" r="3" fill="#f8fafc" className="weather-emblem-flake f1" />
            <circle cx="48" cy="72" r="2.4" fill="#e2e8f0" className="weather-emblem-flake f2" />
            <circle cx="62" cy="66" r="2.8" fill="#f8fafc" className="weather-emblem-flake f3" />
          </>
        )}

        {(theme === "cloudy" || theme === "fog") && (
          <>
            <ellipse cx="36" cy="48" rx="20" ry="13" fill="url(#em-cloud-back)" opacity="0.5" />
            <ellipse cx="54" cy="46" rx="24" ry="16" fill="url(#em-cloud-main)" />
            <ellipse cx="44" cy="52" rx="22" ry="12" fill="url(#em-cloud-front)" />
          </>
        )}

        {theme === "partly" && isDay && (
          <>
            <circle cx="62" cy="34" r="14" fill="url(#em-sun)" />
            <ellipse cx="40" cy="52" rx="22" ry="14" fill="url(#em-cloud-main)" />
            <ellipse cx="52" cy="56" rx="18" ry="11" fill="url(#em-cloud-front)" />
          </>
        )}

        {nightClear && (
          <>
            <circle cx="54" cy="40" r="18" fill="url(#em-moon)" />
            <circle cx="60" cy="34" r="12" fill="url(#em-moon-cut)" opacity="0.55" />
            {theme === "partly" && (
              <ellipse cx="38" cy="58" rx="18" ry="11" fill="url(#em-cloud-front)" opacity="0.85" />
            )}
          </>
        )}

        <defs>
          <linearGradient id="em-cloud-back" x1="20" y1="30" x2="60" y2="55" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#94a3b8" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id="em-cloud-main" x1="30" y1="28" x2="78" y2="58" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" stopOpacity="0.92" />
            <stop offset="1" stopColor="#cbd5e1" stopOpacity="0.72" />
          </linearGradient>
          <linearGradient id="em-cloud-front" x1="24" y1="40" x2="72" y2="62" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f8fafc" stopOpacity="0.95" />
            <stop offset="1" stopColor="#94a3b8" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id="em-drop" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#e2e8f0" stopOpacity="0.95" />
            <stop offset="1" stopColor="#94a3b8" stopOpacity="0.55" />
          </linearGradient>
          <radialGradient id="em-sun" cx="0.4" cy="0.35" r="0.65">
            <stop stopColor="#fff7ed" />
            <stop offset="0.55" stopColor="#fde68a" />
            <stop offset="1" stopColor="#f59e0b" stopOpacity="0.85" />
          </radialGradient>
          <radialGradient id="em-moon" cx="0.35" cy="0.35" r="0.7">
            <stop stopColor="#f8fafc" />
            <stop offset="1" stopColor="#cbd5e1" />
          </radialGradient>
          <radialGradient id="em-moon-cut" cx="0.5" cy="0.5" r="0.5">
            <stop stopColor="#1e293b" stopOpacity="0.35" />
            <stop offset="1" stopColor="#0f172a" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
}
