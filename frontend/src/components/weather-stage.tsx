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

/** Local photographic skies (Unsplash / NASA public-domain assets under /public/weather). */
const SKY_PHOTOS: Record<WeatherTheme, string> = {
  clear: "/weather/sky-clear.jpg",
  partly: "/weather/sky-clear.jpg",
  cloudy: "/weather/sky-cloudy.jpg",
  fog: "/weather/sky-cloudy.jpg",
  rain: "/weather/sky-rain.jpg",
  snow: "/weather/sky-snow.jpg",
  storm: "/weather/sky-storm.jpg",
};

function particles(count: number): ReadonlyArray<number> {
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
  const showSunGlow = (theme === "clear" || theme === "partly") && isDay;

  return (
    <section
      aria-label="Current sky conditions"
      className={`weather-stage weather-stage-${theme}${isDay ? "" : " is-night"}${showSunGlow ? " has-sun" : ""}`}
    >
      <img className="weather-stage-photo" src={SKY_PHOTOS[theme]} alt="" aria-hidden />
      <div className="weather-stage-shade" aria-hidden />
      {showSunGlow && <div className="weather-stage-sunbeam" aria-hidden />}

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

      {showRain && (
        <div className="stage-rain" aria-hidden>
          {particles(40).map((index) => (
            <i key={index} style={{ left: `${(index * 2.5) % 100}%`, animationDelay: `${(index % 10) * 0.1}s` }} />
          ))}
        </div>
      )}
      {showSnow && (
        <div className="stage-snow" aria-hidden>
          {particles(30).map((index) => (
            <i
              key={index}
              style={{
                left: `${(index * 3.2) % 100}%`,
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
