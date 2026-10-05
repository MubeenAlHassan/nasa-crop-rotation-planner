"use client";

import type { ReactElement } from "react";
import type { WeatherTheme } from "../lib/weather/codes";
import { WeatherSunlight } from "./weather-sunlight";

export interface WeatherAtmosphereProps {
  theme: WeatherTheme;
  isDay: boolean;
  windSpeedKmh?: number;
  temperatureC?: number;
}

function particles(count: number, spread: number): ReadonlyArray<{ left: string; delay: string; duration: string; size: string }> {
  return Array.from({ length: count }, (_, index) => ({
    left: `${(index * spread) % 100}%`,
    delay: `${(index % 16) * 0.11}s`,
    duration: `${1.1 + (index % 7) * 0.18}s`,
    size: `${4 + (index % 5) * 2}px`,
  }));
}

export function WeatherAtmosphere({
  theme,
  isDay,
  windSpeedKmh = 0,
  temperatureC = 20,
}: WeatherAtmosphereProps): ReactElement {
  const showSun = (theme === "clear" || theme === "partly") && isDay;
  const showMoon = (theme === "clear" || theme === "partly") && !isDay;
  const showClouds = theme !== "clear" || !isDay;
  const showRain = theme === "rain" || theme === "storm";
  const showSnow = theme === "snow";
  const showWind = windSpeedKmh >= 12 || theme === "storm";
  const showHeat = theme === "clear" && isDay && temperatureC >= 30;

  return (
    <div
      className={`weather-sky weather-sky-${theme}${isDay ? "" : " is-night"}${showHeat ? " is-hot" : ""}`}
      aria-hidden
    >
      <div className="weather-sky-wash" />
      <div className="weather-horizon" />

      {showSun && (
        <WeatherSunlight soft={theme === "partly"} hot={showHeat} />
      )}

      {showMoon && <div className="weather-moon" />}

      {showClouds && (
        <div className="weather-clouds">
          <span className="weather-cloud c1" />
          <span className="weather-cloud c2" />
          <span className="weather-cloud c3" />
          <span className="weather-cloud c4" />
        </div>
      )}

      {showWind && (
        <div className={`weather-wind${windSpeedKmh >= 28 ? " is-strong" : ""}`}>
          {Array.from({ length: 10 }, (_, index) => (
            <i key={index} style={{ top: `${8 + index * 8}%`, animationDelay: `${index * 0.35}s` }} />
          ))}
        </div>
      )}

      {showRain && (
        <div className={`weather-rain${theme === "storm" ? " is-heavy" : ""}`}>
          {particles(70, 1.45).map((drop, index) => (
            <i
              key={index}
              style={{
                left: drop.left,
                animationDelay: drop.delay,
                animationDuration: theme === "storm" ? "0.55s" : drop.duration,
              }}
            />
          ))}
        </div>
      )}

      {showSnow && (
        <div className="weather-snow">
          {particles(55, 1.85).map((flake, index) => (
            <i
              key={index}
              style={{
                left: flake.left,
                width: flake.size,
                height: flake.size,
                animationDelay: flake.delay,
                animationDuration: `${2.8 + (index % 6) * 0.45}s`,
              }}
            />
          ))}
        </div>
      )}

      {theme === "storm" && (
        <>
          <div className="weather-lightning" />
          <div className="weather-lightning weather-lightning-b" />
        </>
      )}

      {theme === "fog" && (
        <div className="weather-fog">
          <span /><span /><span />
        </div>
      )}

      {showHeat && <div className="weather-heat" />}

      <div className="weather-vignette" />
    </div>
  );
}
