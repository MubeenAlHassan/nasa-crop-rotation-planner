"use client";

import {
  Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, Moon, Snowflake, Sun, Wind,
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
      className={`weather-stage weather-stage-${theme}${isDay ? "" : " is-night"}`}
    >
      <div className="weather-stage-content">
        <div>
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
          {showSun && (
            <div className="stage-sun">
              <span className="stage-sun-glow" />
              <span className="stage-sun-ray r1" /><span className="stage-sun-ray r2" />
              <span className="stage-sun-ray r3" /><span className="stage-sun-ray r4" />
              <Sun className="stage-sun-icon" strokeWidth={1.5} />
            </div>
          )}
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
