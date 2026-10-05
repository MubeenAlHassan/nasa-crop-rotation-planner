"use client";

import {
  Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, Moon, Snowflake, Wind,
} from "lucide-react";
import type { ReactElement } from "react";
import type { WeatherTheme } from "../lib/weather/codes";

export interface WeatherStageProps {
  theme: WeatherTheme;
  isDay: boolean;
  temperatureC: number | null;
  windSpeedKmh: number;
  label: string;
  placeLabel: string;
}

function particles(count: number): ReadonlyArray<number> {
  return Array.from({ length: count }, (_, index) => index);
}

/** Photorealistic sun disk + soft corona (SVG gradients, no external asset). */
function RealisticSun(): ReactElement {
  return (
    <div className="stage-sun">
      <div className="stage-sun-bloom" />
      <div className="stage-sun-halo" />
      <svg className="stage-sun-svg" viewBox="0 0 200 200" role="img" aria-label="Sun">
        <defs>
          <radialGradient id="sunDisk" cx="38%" cy="36%" r="62%">
            <stop offset="0%" stopColor="#fffef8" />
            <stop offset="18%" stopColor="#fff4b8" />
            <stop offset="42%" stopColor="#ffd54a" />
            <stop offset="68%" stopColor="#ff9f1a" />
            <stop offset="100%" stopColor="#f07000" />
          </radialGradient>
          <radialGradient id="sunCorona" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffe566" stopOpacity="0.55" />
            <stop offset="45%" stopColor="#ffb020" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#ff8a00" stopOpacity="0" />
          </radialGradient>
          <filter id="sunSoft" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
        </defs>
        <circle cx="100" cy="100" r="96" fill="url(#sunCorona)" />
        <circle cx="100" cy="100" r="58" fill="url(#sunDisk)" filter="url(#sunSoft)" />
        <circle cx="100" cy="100" r="54" fill="url(#sunDisk)" />
        <circle cx="78" cy="72" r="14" fill="#ffffff" opacity="0.35" />
      </svg>
      <span className="stage-sun-flare f1" />
      <span className="stage-sun-flare f2" />
    </div>
  );
}

export function WeatherStage({
  theme,
  isDay,
  temperatureC,
  windSpeedKmh,
  label,
  placeLabel,
}: WeatherStageProps): ReactElement {
  const showSun = (theme === "clear" || theme === "partly") && isDay;
  const showMoon = (theme === "clear" || theme === "partly") && !isDay;
  const showRain = theme === "rain" || theme === "storm";
  const showSnow = theme === "snow";
  const showWind = windSpeedKmh >= 10 || theme === "storm";

  return (
    <section
      aria-label="Current sky conditions"
      className={`weather-stage weather-stage-${theme}${isDay ? "" : " is-night"}${showSun ? " has-sun" : ""}`}
    >
      {showSun && <div className="weather-stage-sunfield" aria-hidden />}

      <div className="weather-stage-content">
        <div className="weather-stage-copy">
          <p className="weather-stage-kicker">{placeLabel || "Sky preview"}</p>
          <p className="weather-stage-title">{label}</p>
          {temperatureC !== null && (
            <p className="weather-stage-temp">{Math.round(temperatureC)}°</p>
          )}
          {showWind && (
            <p className="weather-stage-meta">
              <Wind className="h-4 w-4" aria-hidden />
              Wind {Math.round(windSpeedKmh)} km/h
            </p>
          )}
        </div>

        <div className="weather-stage-art" aria-hidden>
          {showSun && <RealisticSun />}
          {showMoon && (
            <div className="stage-moon">
              <Moon className="stage-moon-icon" strokeWidth={1.5} />
            </div>
          )}
          {(theme === "cloudy" || theme === "partly" || theme === "fog") && (
            <Cloud className="stage-cloud-icon" strokeWidth={1.5} />
          )}
          {theme === "fog" && <CloudFog className="stage-side-icon" strokeWidth={1.5} />}
          {showRain && <CloudRain className="stage-precip-icon" strokeWidth={1.5} />}
          {showSnow && (
            <>
              <CloudSnow className="stage-precip-icon" strokeWidth={1.5} />
              <Snowflake className="stage-flake-icon" strokeWidth={1.5} />
            </>
          )}
          {theme === "storm" && <CloudLightning className="stage-storm-icon" strokeWidth={1.5} />}
        </div>
      </div>

      {showRain && (
        <div className="stage-rain" aria-hidden>
          {particles(36).map((index) => (
            <i key={index} style={{ left: `${(index * 2.8) % 100}%`, animationDelay: `${(index % 10) * 0.1}s` }} />
          ))}
        </div>
      )}
      {showSnow && (
        <div className="stage-snow" aria-hidden>
          {particles(28).map((index) => (
            <i
              key={index}
              style={{
                left: `${(index * 3.4) % 100}%`,
                width: `${6 + (index % 4) * 2}px`,
                height: `${6 + (index % 4) * 2}px`,
                animationDelay: `${(index % 12) * 0.14}s`,
              }}
            />
          ))}
        </div>
      )}
      {showWind && (
        <div className="stage-wind" aria-hidden>
          {particles(6).map((index) => (
            <i key={index} style={{ top: `${20 + index * 12}%`, animationDelay: `${index * 0.4}s` }} />
          ))}
        </div>
      )}
    </section>
  );
}
