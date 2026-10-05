"use client";

import type { ReactElement } from "react";
import type { WeatherTheme } from "../lib/weather/codes";

export interface WeatherAtmosphereProps {
  theme: WeatherTheme;
  isDay: boolean;
}

export function WeatherAtmosphere({ theme, isDay }: WeatherAtmosphereProps): ReactElement {
  return (
    <div className={`weather-sky weather-sky-${theme}${isDay ? "" : " is-night"}`} aria-hidden>
      <div className="weather-sky-glow" />
      {(theme === "clear" || theme === "partly") && <div className="weather-sun" />}
      {(theme === "partly" || theme === "cloudy" || theme === "fog" || theme === "rain" || theme === "storm") && (
        <div className="weather-clouds">
          <span /><span /><span />
        </div>
      )}
      {theme === "rain" && (
        <div className="weather-rain">
          {Array.from({ length: 40 }, (_, index) => <i key={index} style={{ left: `${(index * 2.6) % 100}%`, animationDelay: `${(index % 12) * 0.12}s` }} />)}
        </div>
      )}
      {theme === "snow" && (
        <div className="weather-snow">
          {Array.from({ length: 36 }, (_, index) => <i key={index} style={{ left: `${(index * 2.9) % 100}%`, animationDelay: `${(index % 14) * 0.18}s` }} />)}
        </div>
      )}
      {theme === "storm" && (
        <>
          <div className="weather-rain">
            {Array.from({ length: 48 }, (_, index) => <i key={index} style={{ left: `${(index * 2.1) % 100}%`, animationDelay: `${(index % 10) * 0.08}s` }} />)}
          </div>
          <div className="weather-lightning" />
        </>
      )}
      {theme === "fog" && <div className="weather-fog" />}
    </div>
  );
}
