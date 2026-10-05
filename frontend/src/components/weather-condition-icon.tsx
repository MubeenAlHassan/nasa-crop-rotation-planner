"use client";

import {
  Cloud, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun, Moon, Snowflake, Sun, ThermometerSun,
  type LucideIcon,
} from "lucide-react";
import type { ReactElement } from "react";
import type { WeatherTheme } from "../lib/weather/codes";

export type TemperatureBand = "freezing" | "cold" | "mild" | "warm" | "hot";

export function temperatureBand(temperatureC: number): TemperatureBand {
  if (temperatureC <= 0) return "freezing";
  if (temperatureC < 10) return "cold";
  if (temperatureC < 25) return "mild";
  if (temperatureC < 33) return "warm";
  return "hot";
}

/**
 * Pick a display theme from forecast weather + air temperature.
 * Precipitation / storm codes win; otherwise temperature drives the look
 * (e.g. clear sky at −53°C shows cold/snow, not a warm sun).
 */
export function resolveVisualTheme(theme: WeatherTheme, temperatureC: number): WeatherTheme {
  if (theme === "rain" || theme === "storm" || theme === "snow") return theme;

  const band = temperatureBand(temperatureC);
  if (band === "freezing") return "snow";
  if (band === "cold" && (theme === "cloudy" || theme === "fog" || theme === "partly")) return "fog";
  if (band === "hot" && (theme === "clear" || theme === "partly")) return "clear";
  return theme;
}

function iconFor(
  theme: WeatherTheme,
  temperatureC: number,
  isDay: boolean,
): { Icon: LucideIcon; color: string } {
  const visual = resolveVisualTheme(theme, temperatureC);
  const band = temperatureBand(temperatureC);

  if (visual === "storm") return { Icon: CloudLightning, color: "text-[#475569]" };
  if (visual === "rain") return { Icon: CloudRain, color: "text-[#0284c7]" };
  if (visual === "snow" || band === "freezing") {
    return { Icon: band === "freezing" && theme === "clear" ? Snowflake : CloudSnow, color: "text-[#38bdf8]" };
  }
  if (visual === "fog") return { Icon: CloudFog, color: "text-[#94a3b8]" };
  if (visual === "cloudy") return { Icon: Cloud, color: "text-[#64748b]" };

  // Night: never show a sun — use moon / cloud-moon.
  if (!isDay) {
    if (visual === "partly") return { Icon: CloudMoon, color: "text-[#c4b5fd]" };
    return { Icon: Moon, color: "text-[#e2e8f0]" };
  }

  if (visual === "partly") return { Icon: CloudSun, color: "text-[#0ea5e9]" };
  if (band === "hot") return { Icon: ThermometerSun, color: "text-[#ea580c]" };
  return { Icon: Sun, color: "text-[#d97706]" };
}

export interface WeatherConditionIconProps {
  theme: WeatherTheme;
  label: string;
  /** Air temperature in °C — used to choose a temperature-aware icon. */
  temperatureC: number;
  /** When false, clear/partly skies use a moon instead of a sun. */
  isDay?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASS = {
  sm: "h-5 w-5",
  md: "h-8 w-8",
  lg: "h-11 w-11",
} as const;

export function WeatherConditionIcon({
  theme,
  label,
  temperatureC,
  isDay = true,
  size = "md",
  className = "",
}: WeatherConditionIconProps): ReactElement {
  const { Icon, color } = iconFor(theme, temperatureC, isDay);
  const detail = `${label} · ${Math.round(temperatureC)}°C`;
  return (
    <span
      className={`inline-flex items-center justify-center ${color} ${className}`}
      aria-label={detail}
      title={detail}
    >
      <Icon className={SIZE_CLASS[size]} aria-hidden strokeWidth={1.75} />
    </span>
  );
}
