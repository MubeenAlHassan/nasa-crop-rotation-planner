import { describeWeatherCode, type WeatherTheme } from "./codes";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

export interface WeatherPlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1: string | null;
  timezone: string | null;
}

export interface CurrentWeather {
  time: string;
  temperatureC: number;
  feelsLikeC: number;
  humidityPct: number;
  precipitationMm: number;
  weatherCode: number;
  label: string;
  theme: WeatherTheme;
  cloudCoverPct: number;
  pressureHpa: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
  windGustsKmh: number;
  uvIndex: number;
  isDay: boolean;
  /** Modelled volumetric water content in the top 1 cm, not field capacity. */
  surfaceSoilMoisturePct: number | null;
}

export interface DailyForecast {
  date: string;
  weatherCode: number;
  label: string;
  theme: WeatherTheme;
  tempMaxC: number;
  tempMinC: number;
  precipitationMm: number;
  precipitationProbabilityPct: number;
  windMaxKmh: number;
  uvIndexMax: number;
  sunrise: string;
  sunset: string;
  referenceEtMm: number | null;
}

export interface HourlyPoint {
  time: string;
  temperatureC: number;
  precipitationMm: number;
  weatherCode: number;
  label: string;
  windSpeedKmh: number;
}

export interface WeatherBundle {
  place: WeatherPlace;
  current: CurrentWeather;
  daily: DailyForecast[];
  hourly: HourlyPoint[];
  fetchedAt: string;
}

interface GeocodeResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  timezone?: string;
}

interface ForecastPayload {
  timezone?: string;
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    is_day: number;
    precipitation: number;
    weather_code: number;
    cloud_cover: number;
    pressure_msl: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    wind_gusts_10m: number;
    uv_index: number;
    soil_moisture_0_to_1cm?: number | null;
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    precipitation_probability_max: number[];
    wind_speed_10m_max: number[];
    uv_index_max: number[];
    sunrise: string[];
    sunset: string[];
    et0_fao_evapotranspiration?: (number | null)[];
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    precipitation: number[];
    weather_code: number[];
    wind_speed_10m: number[];
  };
}

function assertFinite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`Invalid ${label} from weather service.`);
  return value;
}

export function formatPlaceLabel(place: WeatherPlace): string {
  const parts = [place.name, place.admin1, place.country].filter(Boolean);
  return parts.join(", ");
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<WeatherPlace[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const url = new URL(GEOCODE_URL);
  url.searchParams.set("name", trimmed);
  url.searchParams.set("count", "8");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Place search failed (${response.status}).`);
  const payload = await response.json() as { results?: GeocodeResult[] };
  return (payload.results ?? []).map((item) => ({
    id: String(item.id),
    name: item.name,
    latitude: item.latitude,
    longitude: item.longitude,
    country: item.country ?? "",
    admin1: item.admin1 ?? null,
    timezone: item.timezone ?? null,
  }));
}

interface ReverseGeocodeClientPayload {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  countryName?: string;
}

/**
 * Resolve city / province / country for a WGS84 point.
 * Uses BigDataCloud's browser reverse-geocode client (Open-Meteo has no reverse endpoint).
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<WeatherPlace> {
  const fallback: WeatherPlace = {
    id: `coords:${latitude.toFixed(4)},${longitude.toFixed(4)}`,
    name: `${Math.abs(latitude).toFixed(3)}° ${latitude >= 0 ? "N" : "S"}, ${Math.abs(longitude).toFixed(3)}° ${longitude >= 0 ? "E" : "W"}`,
    latitude,
    longitude,
    country: "",
    admin1: null,
    timezone: null,
  };

  try {
    const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("localityLanguage", "en");
    const response = await fetch(url, { signal });
    if (!response.ok) return fallback;
    const payload = await response.json() as ReverseGeocodeClientPayload;
    const name = (payload.city || payload.locality || "").trim();
    const admin1 = (payload.principalSubdivision || "").trim() || null;
    const country = (payload.countryName || "").trim();
    if (!name && !admin1 && !country) return fallback;
    return {
      id: `coords:${latitude.toFixed(4)},${longitude.toFixed(4)}`,
      name: name || admin1 || country || fallback.name,
      latitude,
      longitude,
      country,
      admin1: name ? admin1 : null,
      timezone: null,
    };
  } catch {
    return fallback;
  }
}

export async function fetchWeather(
  place: WeatherPlace,
  signal?: AbortSignal,
): Promise<WeatherBundle> {
  const url = new URL(FORECAST_URL);
  url.searchParams.set("latitude", String(place.latitude));
  url.searchParams.set("longitude", String(place.longitude));
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "7");
  url.searchParams.set(
    "current",
    [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "is_day",
      "precipitation",
      "weather_code",
      "cloud_cover",
      "pressure_msl",
      "wind_speed_10m",
      "wind_direction_10m",
      "wind_gusts_10m",
      "uv_index",
      "soil_moisture_0_to_1cm",
    ].join(","),
  );
  url.searchParams.set(
    "daily",
    [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "precipitation_probability_max",
      "wind_speed_10m_max",
      "uv_index_max",
      "sunrise",
      "sunset",
      "et0_fao_evapotranspiration",
    ].join(","),
  );
  url.searchParams.set(
    "hourly",
    ["temperature_2m", "precipitation", "weather_code", "wind_speed_10m"].join(","),
  );

  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Weather forecast failed (${response.status}).`);
  const data = await response.json() as ForecastPayload;
  const currentCode = assertFinite(data.current.weather_code, "weather code");
  const currentInfo = describeWeatherCode(currentCode);
  const currentPrecipitation = assertFinite(data.current.precipitation, "current precipitation");
  const currentHour = data.current.time.slice(0, 13);
  const firstHour = Math.max(0, data.hourly.time.findIndex((time) => time.slice(0, 13) >= currentHour));
  const hourlyCondition = data.hourly.time[firstHour]?.slice(0, 13) === currentHour
    ? describeWeatherCode(data.hourly.weather_code[firstHour])
    : null;
  const currentCondition = ["rain", "storm", "snow"].includes(currentInfo.theme)
    ? currentInfo
    : currentPrecipitation >= 0.1
      ? { label: "Rain", theme: "rain" as const }
      : (data.hourly.precipitation[firstHour] ?? 0) >= 0.1
        && (hourlyCondition?.theme === "rain" || hourlyCondition?.theme === "storm")
        ? hourlyCondition
        : currentInfo;

  const daily: DailyForecast[] = data.daily.time.map((date, index) => {
    const code = assertFinite(data.daily.weather_code[index], "daily weather code");
    const info = describeWeatherCode(code);
    return {
      date,
      weatherCode: code,
      label: info.label,
      theme: info.theme,
      tempMaxC: assertFinite(data.daily.temperature_2m_max[index], "max temperature"),
      tempMinC: assertFinite(data.daily.temperature_2m_min[index], "min temperature"),
      precipitationMm: assertFinite(data.daily.precipitation_sum[index], "precipitation"),
      precipitationProbabilityPct: assertFinite(
        data.daily.precipitation_probability_max[index] ?? 0,
        "precip probability",
      ),
      windMaxKmh: assertFinite(data.daily.wind_speed_10m_max[index], "wind"),
      uvIndexMax: assertFinite(data.daily.uv_index_max[index] ?? 0, "uv"),
      sunrise: data.daily.sunrise[index],
      sunset: data.daily.sunset[index],
      referenceEtMm: Number.isFinite(data.daily.et0_fao_evapotranspiration?.[index])
        ? data.daily.et0_fao_evapotranspiration![index]!
        : null,
    };
  });

  const hourly: HourlyPoint[] = data.hourly.time.slice(firstHour, firstHour + 24).map((time, offset) => {
    const index = firstHour + offset;
    const code = assertFinite(data.hourly.weather_code[index], "hourly weather code");
    return {
      time,
      temperatureC: assertFinite(data.hourly.temperature_2m[index], "hourly temperature"),
      precipitationMm: assertFinite(data.hourly.precipitation[index], "hourly precipitation"),
      weatherCode: code,
      label: describeWeatherCode(code).label,
      windSpeedKmh: assertFinite(data.hourly.wind_speed_10m[index], "hourly wind"),
    };
  });

  return {
    place: {
      ...place,
      timezone: data.timezone ?? place.timezone,
    },
    current: {
      time: data.current.time,
      temperatureC: assertFinite(data.current.temperature_2m, "temperature"),
      feelsLikeC: assertFinite(data.current.apparent_temperature, "feels like"),
      humidityPct: assertFinite(data.current.relative_humidity_2m, "humidity"),
      precipitationMm: currentPrecipitation,
      weatherCode: currentCode,
      label: currentCondition.label,
      theme: currentCondition.theme,
      cloudCoverPct: assertFinite(data.current.cloud_cover, "cloud cover"),
      pressureHpa: assertFinite(data.current.pressure_msl, "pressure"),
      windSpeedKmh: assertFinite(data.current.wind_speed_10m, "wind speed"),
      windDirectionDeg: assertFinite(data.current.wind_direction_10m, "wind direction"),
      windGustsKmh: assertFinite(data.current.wind_gusts_10m, "wind gusts"),
      uvIndex: assertFinite(data.current.uv_index, "uv index"),
      isDay: data.current.is_day === 1,
      surfaceSoilMoisturePct: Number.isFinite(data.current.soil_moisture_0_to_1cm)
        ? data.current.soil_moisture_0_to_1cm! * 100
        : null,
    },
    daily,
    hourly,
    fetchedAt: new Date().toISOString(),
  };
}
