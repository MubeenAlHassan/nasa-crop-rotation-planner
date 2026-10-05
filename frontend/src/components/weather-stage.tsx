"use client";

import { Wind } from "lucide-react";
import type { ReactElement } from "react";
import type { WeatherTheme } from "../lib/weather/codes";
import { WeatherStageEmblem } from "./weather-stage-emblem";

export interface WeatherStageProps {
  theme: WeatherTheme;
  isDay: boolean;
  temperatureC: number | null;
  windSpeedKmh: number;
  label: string;
  placeLabel: string;
}

function range(count: number): ReadonlyArray<number> {
  return Array.from({ length: count }, (_, index) => index);
}

export function WeatherStage({
  theme,
  isDay,
  temperatureC,
  windSpeedKmh,
  label,
  placeLabel,
}: WeatherStageProps): ReactElement {
  const showRain = theme === "rain" || theme === "storm";
  const showSnow = theme === "snow";
  const showWind = windSpeedKmh >= 10 || theme === "storm";
  // Clear daytime: sky light only — no badge. Everything else gets the frosted emblem.
  const showStageIcon = !(theme === "clear" && isDay);

  return (
    <section
      aria-label="Current sky conditions"
      className={`weather-stage weather-stage-${theme}${isDay ? "" : " is-night"}`}
    >
      <div className="weather-stage-bg" aria-hidden />

      {showRain && (
        <div className={`fx-rain${theme === "storm" ? " is-heavy" : ""}`} aria-hidden>
          {range(36).map((index) => (
            <i
              key={index}
              style={{
                left: `${(index * 2.8) % 100}%`,
                animationDelay: `${(index % 10) * 0.1}s`,
                animationDuration: theme === "storm" ? "0.55s" : `${0.8 + (index % 4) * 0.08}s`,
              }}
            />
          ))}
        </div>
      )}

      {showSnow && (
        <div className="fx-snow" aria-hidden>
          {range(24).map((index) => (
            <i
              key={index}
              style={{
                left: `${(index * 4) % 100}%`,
                width: `${5 + (index % 4) * 2}px`,
                height: `${5 + (index % 4) * 2}px`,
                animationDelay: `${(index % 12) * 0.14}s`,
              }}
            />
          ))}
        </div>
      )}

      {showWind && (
        <div className="fx-wind" aria-hidden>
          {range(5).map((index) => (
            <i key={index} style={{ top: `${22 + index * 14}%`, animationDelay: `${index * 0.4}s` }} />
          ))}
        </div>
      )}

      {theme === "storm" && <div className="fx-lightning" aria-hidden />}

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

        {showStageIcon && (
          <div className="weather-stage-badge" aria-hidden>
            <span className={`weather-stage-orb weather-stage-orb-${theme}`} />
            <WeatherStageEmblem theme={theme} isDay={isDay} label={label} />
          </div>
        )}
      </div>
    </section>
  );
}
