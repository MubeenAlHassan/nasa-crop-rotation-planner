"use client";

import {
  CloudRain, Droplets, Gauge, LocateFixed, MapPin, Search, Sun, Sunrise, Sunset, Wind,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactElement } from "react";
import { Reveal } from "../../components/reveal";
import { SiteHeader } from "../../components/site-header";
import { WeatherAtmosphere } from "../../components/weather-atmosphere";
import { WeatherConditionIcon } from "../../components/weather-condition-icon";
import { describeWeatherCode } from "../../lib/weather/codes";
import {
  fetchWeather, formatPlaceLabel, reverseGeocode, searchPlaces,
  type WeatherBundle, type WeatherPlace,
} from "../../lib/weather/open-meteo";

function windArrow(degrees: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(degrees / 45) % 8] ?? "N";
}

function formatDay(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function metric(label: string, value: string, icon: ReactElement): ReactElement {
  return (
    <div className="weather-metric">
      <span className="weather-metric-icon">{icon}</span>
      <div>
        <p className="weather-metric-label">{label}</p>
        <p className="weather-metric-value">{value}</p>
      </div>
    </div>
  );
}

/** Returns null when either field is blank or out of WGS84 range. */
function parseCoordinatePair(latRaw: string, lonRaw: string): { lat: number; lon: number } | null {
  if (latRaw.trim() === "" || lonRaw.trim() === "") return null;
  const lat = Number(latRaw);
  const lon = Number(lonRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

export default function WeatherClient(): ReactElement {
  const [query, setQuery] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [suggestions, setSuggestions] = useState<WeatherPlace[]>([]);
  const [bundle, setBundle] = useState<WeatherBundle | null>(null);
  const [pending, setPending] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchController = useRef<AbortController | null>(null);
  const weatherController = useRef<AbortController | null>(null);
  const autoStarted = useRef(false);

  const parsedCoords = parseCoordinatePair(latitude, longitude);
  const coordsReady = parsedCoords !== null;

  async function loadWeather(place: WeatherPlace): Promise<void> {
    weatherController.current?.abort();
    const controller = new AbortController();
    weatherController.current = controller;
    setPending(true);
    setError(null);
    setSuggestions([]);
    try {
      const next = await fetchWeather(place, controller.signal);
      if (!controller.signal.aborted) {
        setBundle(next);
        setLatitude(place.latitude.toFixed(4));
        setLongitude(place.longitude.toFixed(4));
        setQuery(formatPlaceLabel(place));
      }
    } catch (failure: unknown) {
      if (!controller.signal.aborted) {
        setError(failure instanceof Error ? failure.message : "Unable to load weather.");
        setBundle(null);
      }
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }

  async function useMyLocation(): Promise<void> {
    if (!navigator.geolocation) {
      setError("Geolocation is not available in this browser.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        // Fill the custom-field coords as soon as the browser reports a fix.
        setLatitude(lat.toFixed(4));
        setLongitude(lon.toFixed(4));
        setQuery("Your current location");
        try {
          const place = await reverseGeocode(lat, lon);
          place.name = "Your current location";
          place.country = "Detected by browser";
          place.latitude = lat;
          place.longitude = lon;
          await loadWeather(place);
        } catch (failure: unknown) {
          setError(failure instanceof Error ? failure.message : "Unable to use current location.");
          setBundle(null);
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setBundle(null);
        setLatitude("");
        setLongitude("");
        setQuery("");
        setError("Location permission denied. Allow location access, or enter coordinates / search a place.");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  }

  useEffect(() => {
    if (autoStarted.current) return;
    autoStarted.current = true;
    void useMyLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Empty coordinates → no search / no forecast results.
  useEffect(() => {
    if (coordsReady) return;
    weatherController.current?.abort();
    setBundle(null);
    setSuggestions([]);
    setPending(false);
  }, [coordsReady]);

  useEffect(() => {
    const trimmed = query.trim();
    if (
      trimmed.length < 2
      || trimmed === "Your current location"
      || (bundle && formatPlaceLabel(bundle.place) === trimmed)
    ) {
      setSuggestions([]);
      return undefined;
    }
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    const timer = window.setTimeout(() => {
      void searchPlaces(trimmed, controller.signal)
        .then((places) => {
          if (!controller.signal.aborted) setSuggestions(places);
        })
        .catch(() => {
          if (!controller.signal.aborted) setSuggestions([]);
        });
    }, 280);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, bundle]);

  function onSearchSubmit(event: FormEvent): void {
    event.preventDefault();
    if (suggestions[0]) {
      void loadWeather(suggestions[0]);
      return;
    }
    setError("Pick a place from the suggestions, or enter latitude and longitude below.");
  }

  function onCoordsSubmit(event: FormEvent): void {
    event.preventDefault();
    if (!parsedCoords) {
      setError("Enter both latitude and longitude before checking coordinates.");
      setBundle(null);
      return;
    }
    const { lat, lon } = parsedCoords;
    void reverseGeocode(lat, lon).then((place) => {
      place.name = "Custom field";
      place.country = "Worldwide coordinates";
      return loadWeather(place);
    });
  }

  function updateLatitude(value: string): void {
    setLatitude(value);
    if (value.trim() === "") {
      setBundle(null);
      setSuggestions([]);
      setError(null);
    }
  }

  function updateLongitude(value: string): void {
    setLongitude(value);
    if (value.trim() === "") {
      setBundle(null);
      setSuggestions([]);
      setError(null);
    }
  }

  const theme = bundle?.current.theme ?? "partly";
  const isDay = bundle?.current.isDay ?? true;
  const showResults = coordsReady && bundle !== null;

  return (
    <div className="weather-page relative min-h-full overflow-hidden text-[var(--on-surface)]">
      <WeatherAtmosphere theme={theme} isDay={isDay} />
      <SiteHeader active="weather" tone="glass" />

      <main className="relative z-10 mx-auto max-w-6xl space-y-6 px-4 pb-12 pt-28 sm:px-6 lg:px-8">
        <Reveal immediate className="weather-glass p-5 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--primary)]">Weather prediction</p>
          <h1 className="font-display mt-2 text-3xl font-bold sm:text-4xl">Global field conditions</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--on-surface-variant)] sm:text-base">
            Check your current location or any custom field worldwide. Forecasts use Open-Meteo (not NASA POWER climatology used by the rotation planner).
          </p>

          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <form onSubmit={onSearchSubmit} className="space-y-2">
              <label className="text-sm font-semibold">Search a place
                <div className="relative mt-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--outline)]" aria-hidden />
                  <input
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="City, region, or farm town"
                    className="weather-search-input"
                    autoComplete="off"
                  />
                </div>
              </label>
              {suggestions.length > 0 && (
                <ul className="overflow-hidden rounded-xl border border-[var(--outline-variant)] bg-white shadow-lg">
                  {suggestions.map((place) => (
                    <li key={place.id}>
                      <button
                        type="button"
                        className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-[var(--surface-container-low)]"
                        onClick={() => void loadWeather(place)}
                      >
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" aria-hidden />
                        <span>
                          <span className="font-semibold">{place.name}</span>
                          <span className="block text-[var(--on-surface-variant)]">
                            {[place.admin1, place.country].filter(Boolean).join(", ")} · {place.latitude.toFixed(2)}, {place.longitude.toFixed(2)}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </form>

            <form onSubmit={onCoordsSubmit} className="space-y-2">
              <p className="text-sm font-semibold">Custom field (WGS84)</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">Latitude
                  <input
                    type="number"
                    step="any"
                    value={latitude}
                    onChange={(e) => updateLatitude(e.target.value)}
                    placeholder={locating ? "Detecting…" : "e.g. 31.4504"}
                  />
                </label>
                <label className="text-xs">Longitude
                  <input
                    type="number"
                    step="any"
                    value={longitude}
                    onChange={(e) => updateLongitude(e.target.value)}
                    placeholder={locating ? "Detecting…" : "e.g. 73.1350"}
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="submit"
                  className="btn-primary text-sm"
                  disabled={!coordsReady || pending || locating}
                  title={coordsReady ? "Load forecast for these coordinates" : "Enter latitude and longitude first"}
                >
                  Check coordinates
                </button>
                <button type="button" className="btn-secondary text-sm" disabled={locating || pending} onClick={() => void useMyLocation()}>
                  <LocateFixed className="h-4 w-4" aria-hidden />
                  {locating ? "Detecting…" : "Use my location"}
                </button>
              </div>
            </form>
          </div>

          {(pending || locating) && (
            <p role="status" className="mt-4 text-sm text-[var(--info-ink)]">
              {locating ? "Requesting your location…" : "Loading 7-day forecast…"}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-4 rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger-ink)]">
              {error}
            </p>
          )}
        </Reveal>

        {showResults && bundle && (
          <>
            <Reveal immediate delayMs={80} className="weather-glass p-5 sm:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--on-surface-variant)]">
                    <MapPin className="h-4 w-4 text-[var(--primary)]" aria-hidden />
                    {formatPlaceLabel(bundle.place)}
                  </p>
                  <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
                    {bundle.place.latitude.toFixed(4)}°, {bundle.place.longitude.toFixed(4)}°
                    {bundle.place.timezone ? ` · ${bundle.place.timezone}` : ""}
                  </p>
                  <div className="mt-4 flex items-center gap-4">
                    <WeatherConditionIcon
                      theme={bundle.current.theme}
                      label={bundle.current.label}
                      size="lg"
                      className="rounded-2xl bg-[rgba(237,247,229,0.9)] p-2"
                    />
                    <p className="font-display text-6xl font-bold tracking-tight sm:text-7xl">
                      {Math.round(bundle.current.temperatureC)}°
                    </p>
                  </div>
                  <p className="mt-2 text-xl font-semibold">{bundle.current.label}</p>
                  <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
                    Feels like {Math.round(bundle.current.feelsLikeC)}° · Updated {formatClock(bundle.current.time)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {metric("Humidity", `${Math.round(bundle.current.humidityPct)}%`, <Droplets className="h-4 w-4" />)}
                  {metric("Wind", `${Math.round(bundle.current.windSpeedKmh)} km/h ${windArrow(bundle.current.windDirectionDeg)}`, <Wind className="h-4 w-4" />)}
                  {metric("Gusts", `${Math.round(bundle.current.windGustsKmh)} km/h`, <Wind className="h-4 w-4" />)}
                  {metric("Precip", `${bundle.current.precipitationMm.toFixed(1)} mm`, <CloudRain className="h-4 w-4" />)}
                  {metric("Pressure", `${Math.round(bundle.current.pressureHpa)} hPa`, <Gauge className="h-4 w-4" />)}
                  {metric("UV index", bundle.current.uvIndex.toFixed(1), <Sun className="h-4 w-4" />)}
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-4 text-sm text-[var(--on-surface-variant)]">
                <span className="inline-flex items-center gap-2">
                  <Sunrise className="h-4 w-4 text-[var(--tertiary)]" aria-hidden />
                  Sunrise {formatClock(bundle.daily[0]?.sunrise ?? bundle.current.time)}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Sunset className="h-4 w-4 text-[var(--tertiary)]" aria-hidden />
                  Sunset {formatClock(bundle.daily[0]?.sunset ?? bundle.current.time)}
                </span>
                <span>Cloud cover {Math.round(bundle.current.cloudCoverPct)}%</span>
              </div>
            </Reveal>

            <Reveal delayMs={120} className="weather-glass p-4 sm:p-5">
              <h2 className="font-display mb-3 text-xl font-semibold">Next 24 hours</h2>
              <div className="overflow-x-auto">
                <div className="flex min-w-max gap-2">
                  {bundle.hourly.map((hour) => (
                    <div key={hour.time} className="weather-hour">
                      <p className="text-xs font-semibold text-[var(--on-surface-variant)]">{formatClock(hour.time)}</p>
                      <div className="mt-2 flex justify-center">
                        <WeatherConditionIcon
                          theme={describeWeatherCode(hour.weatherCode).theme}
                          label={hour.label}
                          size="sm"
                        />
                      </div>
                      <p className="mt-2 text-lg font-bold">{Math.round(hour.temperatureC)}°</p>
                      <p className="mt-1 text-[11px] text-[var(--on-surface-variant)]">{hour.label}</p>
                      <p className="mt-2 text-[11px]">{hour.precipitationMm.toFixed(1)} mm</p>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal delayMs={160} className="weather-glass p-4 sm:p-5">
              <h2 className="font-display mb-3 text-xl font-semibold">7-day outlook</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
                {bundle.daily.map((day) => (
                  <article key={day.date} className={`weather-day weather-day-${day.theme}`}>
                    <p className="text-xs font-bold uppercase tracking-wide">{formatDay(day.date)}</p>
                    <div className="mt-3 flex items-center justify-center">
                      <WeatherConditionIcon theme={day.theme} label={day.label} size="lg" />
                    </div>
                    <p className="mt-2 text-center text-sm font-semibold">{day.label}</p>
                    <p className="mt-3 text-center text-2xl font-bold">{Math.round(day.tempMaxC)}°</p>
                    <p className="text-center text-sm text-[var(--on-surface-variant)]">Low {Math.round(day.tempMinC)}°</p>
                    <dl className="mt-3 space-y-1 text-[11px] text-[var(--on-surface-variant)]">
                      <div className="flex justify-between gap-2"><dt>Rain chance</dt><dd>{Math.round(day.precipitationProbabilityPct)}%</dd></div>
                      <div className="flex justify-between gap-2"><dt>Precip</dt><dd>{day.precipitationMm.toFixed(1)} mm</dd></div>
                      <div className="flex justify-between gap-2"><dt>Wind</dt><dd>{Math.round(day.windMaxKmh)} km/h</dd></div>
                      <div className="flex justify-between gap-2"><dt>UV max</dt><dd>{day.uvIndexMax.toFixed(1)}</dd></div>
                    </dl>
                  </article>
                ))}
              </div>
            </Reveal>

            <p className="weather-glass mx-auto max-w-3xl px-4 py-2 text-center text-xs text-[var(--on-surface-variant)]">
              Weather data © Open-Meteo (CC BY 4.0). Field Shift rotation scores still use observed NASA POWER climate context, not this forecast page.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
