export type WeatherTheme = "clear" | "partly" | "cloudy" | "fog" | "rain" | "snow" | "storm";

export interface WeatherCodeInfo {
  label: string;
  theme: WeatherTheme;
}

/** WMO Weather interpretation codes (Open-Meteo). */
export function describeWeatherCode(code: number): WeatherCodeInfo {
  if (code === 0) return { label: "Clear sky", theme: "clear" };
  if (code === 1) return { label: "Mainly clear", theme: "clear" };
  if (code === 2) return { label: "Partly cloudy", theme: "partly" };
  if (code === 3) return { label: "Overcast", theme: "cloudy" };
  if (code === 45 || code === 48) return { label: "Fog", theme: "fog" };
  if (code >= 51 && code <= 55) return { label: "Drizzle", theme: "rain" };
  if (code === 56 || code === 57) return { label: "Freezing drizzle", theme: "snow" };
  if (code >= 61 && code <= 65) return { label: "Rain", theme: "rain" };
  if (code === 66 || code === 67) return { label: "Freezing rain", theme: "snow" };
  if (code >= 71 && code <= 77) return { label: "Snow", theme: "snow" };
  if (code >= 80 && code <= 82) return { label: "Rain showers", theme: "rain" };
  if (code === 85 || code === 86) return { label: "Snow showers", theme: "snow" };
  if (code >= 95 && code <= 99) return { label: "Thunderstorm", theme: "storm" };
  return { label: "Unknown conditions", theme: "cloudy" };
}
