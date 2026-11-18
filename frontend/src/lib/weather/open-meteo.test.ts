import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWeather, type WeatherPlace } from "./open-meteo";

const place: WeatherPlace = {
  id: "sample", name: "Faisalabad", admin1: "Punjab", country: "Pakistan",
  latitude: 31.4504, longitude: 73.135, timezone: "Asia/Karachi",
};

afterEach(() => vi.unstubAllGlobals());

describe("fetchWeather", () => {
  it("starts the hourly trend at the current local hour and preserves modeled field values", async () => {
    let rainSource: "current" | "hourly" = "current";
    const times = Array.from({ length: 48 }, (_, hour) => {
      const date = new Date(Date.UTC(2026, 9, 6, hour));
      return date.toISOString().slice(0, 16);
    });
    const fetchMock = vi.fn(async (url: URL) => {
      expect(url.searchParams.get("current")).toContain("soil_moisture_0_to_1cm");
      expect(url.searchParams.get("daily")).toContain("et0_fao_evapotranspiration");
      return {
        ok: true,
        json: async () => ({
          timezone: "Asia/Karachi",
          current: {
            time: "2026-10-06T10:30", temperature_2m: 30, relative_humidity_2m: 50,
            apparent_temperature: 32, is_day: 1, precipitation: rainSource === "current" ? 0.2 : 0, weather_code: 0,
            cloud_cover: 10, pressure_msl: 1010, wind_speed_10m: 8,
            wind_direction_10m: 90, wind_gusts_10m: 12, uv_index: 5,
            soil_moisture_0_to_1cm: 0.24,
          },
          daily: {
            time: ["2026-10-06"], weather_code: [0], temperature_2m_max: [34],
            temperature_2m_min: [23], precipitation_sum: [0],
            precipitation_probability_max: [20], wind_speed_10m_max: [15],
            uv_index_max: [7], sunrise: ["2026-10-06T06:00"],
            sunset: ["2026-10-06T18:00"], et0_fao_evapotranspiration: [4.2],
          },
          hourly: {
            time: times, temperature_2m: times.map((_, index) => index),
            precipitation: times.map((_, index) => rainSource === "hourly" && index === 10 ? 0.2 : 0),
            weather_code: times.map((_, index) => rainSource === "hourly" && index === 10 ? 61 : 0),
            wind_speed_10m: times.map(() => 8),
          },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchWeather(place);
    expect(result.hourly).toHaveLength(24);
    expect(result.hourly[0]).toMatchObject({ time: "2026-10-06T10:00", temperatureC: 10 });
    expect(result.current.surfaceSoilMoisturePct).toBe(24);
    expect(result.current).toMatchObject({ theme: "rain", label: "Rain" });
    expect(result.daily[0].referenceEtMm).toBe(4.2);

    rainSource = "hourly";
    const laggingCurrentCode = await fetchWeather(place);
    expect(laggingCurrentCode.current).toMatchObject({ theme: "rain", label: "Rain" });
  });
});
