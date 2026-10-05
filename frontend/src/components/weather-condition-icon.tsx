"use client";

import {
  Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun, type LucideIcon,
} from "lucide-react";
import type { ReactElement } from "react";
import type { WeatherTheme } from "../lib/weather/codes";

const THEME_ICONS: Record<WeatherTheme, LucideIcon> = {
  clear: Sun,
  partly: CloudSun,
  cloudy: Cloud,
  fog: CloudFog,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
};

const THEME_COLORS: Record<WeatherTheme, string> = {
  clear: "text-[#d97706]",
  partly: "text-[#0ea5e9]",
  cloudy: "text-[#64748b]",
  fog: "text-[#94a3b8]",
  rain: "text-[#0284c7]",
  snow: "text-[#38bdf8]",
  storm: "text-[#475569]",
};

export interface WeatherConditionIconProps {
  theme: WeatherTheme;
  label: string;
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
  size = "md",
  className = "",
}: WeatherConditionIconProps): ReactElement {
  const Icon = THEME_ICONS[theme] ?? Cloud;
  return (
    <span
      className={`inline-flex items-center justify-center ${THEME_COLORS[theme]} ${className}`}
      aria-label={label}
      title={label}
    >
      <Icon className={SIZE_CLASS[size]} aria-hidden strokeWidth={1.75} />
    </span>
  );
}
