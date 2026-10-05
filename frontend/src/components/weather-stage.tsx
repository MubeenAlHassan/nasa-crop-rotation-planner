"use client";

import { Wind } from "lucide-react";
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

function range(count: number): ReadonlyArray<number> {
  return Array.from({ length: count }, (_, index) => index);
}

function AnimatedSun(): ReactElement {
  return (
    <div className="fx-sun" aria-hidden>
      <span className="fx-sun-rays" />
      <span className="fx-sun-corona" />
      <span className="fx-sun-core" />
      <span className="fx-sun-shine" />
    </div>
  );
}

function AnimatedMoon(): ReactElement {
  return (
    <div className="fx-moon" aria-hidden>
      <span className="fx-moon-glow" />
      <span className="fx-moon-disk" />
    </div>
  );
}

function AnimatedClouds({ dense = false }: { dense?: boolean }): ReactElement {
  return (
    <div className={`fx-clouds${dense ? " is-dense" : ""}`} aria-hidden>
      <span className="fx-cloud c1" />
      <span className="fx-cloud c2" />
      <span className="fx-cloud c3" />
      <span className="fx-cloud c4" />
      {dense && <span className="fx-cloud c5" />}
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
  const denseClouds = theme === "cloudy" || theme === "rain" || theme === "storm" || theme === "fog";
  const showClouds = theme !== "clear";
  const showRain = theme === "rain" || theme === "storm";
  const showSnow = theme === "snow";
  const showWind = windSpeedKmh >= 10 || theme === "storm";
  const showHeat = theme === "clear" && isDay && (temperatureC ?? 0) >= 30;

  return (
    <section
      aria-label="Current sky conditions"
      className={`weather-stage weather-stage-${theme}${isDay ? "" : " is-night"}${showHeat ? " is-hot" : ""}`}
    >
      <div className="fx-sky-gradient" aria-hidden />
      <div className="fx-horizon" aria-hidden />

      {showSun && <AnimatedSun />}
      {showMoon && <AnimatedMoon />}
      {(showClouds || (theme === "clear" && isDay)) && (
        <AnimatedClouds dense={denseClouds || theme === "partly"} />
      )}

      {showWind && (
        <div className={`fx-wind${windSpeedKmh >= 28 ? " is-strong" : ""}`} aria-hidden>
          {range(8).map((index) => (
            <i key={index} style={{ top: `${14 + index * 10}%`, animationDelay: `${index * 0.32}s` }} />
          ))}
        </div>
      )}

      {showRain && (
        <div className={`fx-rain${theme === "storm" ? " is-heavy" : ""}`} aria-hidden>
          {range(64).map((index) => (
            <i
              key={index}
              style={{
                left: `${(index * 1.6) % 100}%`,
                animationDelay: `${(index % 14) * 0.08}s`,
                animationDuration: theme === "storm" ? "0.55s" : `${0.75 + (index % 5) * 0.08}s`,
              }}
            />
          ))}
        </div>
      )}

      {showSnow && (
        <div className="fx-snow" aria-hidden>
          {range(48).map((index) => (
            <i
              key={index}
              style={{
                left: `${(index * 2.1) % 100}%`,
                width: `${5 + (index % 5) * 2}px`,
                height: `${5 + (index % 5) * 2}px`,
                animationDelay: `${(index % 16) * 0.12}s`,
                animationDuration: `${2.6 + (index % 7) * 0.35}s`,
              }}
            />
          ))}
        </div>
      )}

      {theme === "storm" && (
        <>
          <div className="fx-lightning" aria-hidden />
          <div className="fx-lightning fx-lightning-b" aria-hidden />
        </>
      )}

      {theme === "fog" && (
        <div className="fx-fog" aria-hidden>
          <span /><span /><span />
        </div>
      )}

      {showHeat && <div className="fx-heat" aria-hidden />}

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
      </div>
    </section>
  );
}
