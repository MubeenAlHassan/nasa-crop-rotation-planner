"use client";

import {
  LocateFixed, MapPin, Search,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactElement } from "react";
import { Reveal } from "../../components/reveal";
import { SiteHeader } from "../../components/site-header";
import { WeatherAtmosphere } from "../../components/weather-atmosphere";
import { resolveVisualTheme } from "../../components/weather-condition-icon";
import { WeatherDashboard } from "../../components/weather-dashboard";
import {
  fetchWeather, formatPlaceLabel, reverseGeocode, searchPlaces,
  type WeatherBundle, type WeatherPlace,
} from "../../lib/weather/open-meteo";

/** Returns null when either field is blank or out of WGS84 range. */
function parseCoordinatePair(latRaw: string, lonRaw: string): { lat: number; lon: number } | null {
  if (latRaw.trim() === "" || lonRaw.trim() === "") return null;
  const lat = Number(latRaw);
  const lon = Number(lonRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

const DEMO_PLACE: WeatherPlace = {
  id: "faisalabad-sample",
  name: "Faisalabad",
  admin1: "Punjab",
  country: "Pakistan",
  latitude: 31.4504,
  longitude: 73.1350,
  timezone: "Asia/Karachi",
};

export default function WeatherClient(): ReactElement {
  const [query, setQuery] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [suggestions, setSuggestions] = useState<WeatherPlace[]>([]);
  const [bundle, setBundle] = useState<WeatherBundle | null>(null);
  const [pending, setPending] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Controls muted search-field hint when the value stays empty. */
  const [searchHint, setSearchHint] = useState<"default" | "mylocation" | "coords">("default");
  const searchController = useRef<AbortController | null>(null);
  const weatherController = useRef<AbortController | null>(null);
  const autoStarted = useRef(false);

  const parsedCoords = parseCoordinatePair(latitude, longitude);
  const coordsReady = parsedCoords !== null;
  const activePlace = bundle?.place ?? null;

  async function loadWeather(
    place: WeatherPlace,
    options?: { fillSearch?: boolean; hint?: "default" | "mylocation" | "coords" },
  ): Promise<void> {
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
        const hint = options?.hint ?? "default";
        setSearchHint(hint);
        // Coord / browser location stay as placeholders; searched places fill City, Province, Country.
        if (options?.fillSearch !== false) {
          setQuery(formatPlaceLabel(place));
        } else {
          setQuery("");
        }
      }
    } catch (failure: unknown) {
      if (!controller.signal.aborted) {
        const message = failure instanceof Error ? failure.message : "Unable to load weather.";
        setError(message.includes("(503)")
          ? "The weather service is temporarily unavailable. Try again in a moment."
          : message);
      }
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }

  async function detectMyLocation(): Promise<void> {
    if (!navigator.geolocation) {
      setError("Geolocation is not available in this browser.");
      return;
    }
    setLocating(true);
    setError(null);
    setQuery("");
    setSearchHint("mylocation");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        // Fill the custom-field coords as soon as the browser reports a fix.
        setLatitude(lat.toFixed(4));
        setLongitude(lon.toFixed(4));
        try {
          const place = await reverseGeocode(lat, lon);
          place.latitude = lat;
          place.longitude = lon;
          await loadWeather(place, { fillSearch: false, hint: "mylocation" });
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
        setSearchHint("default");
        setError("Location permission denied. Allow location access, or enter coordinates / search a place.");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  }

  useEffect(() => {
    if (autoStarted.current) return;
    autoStarted.current = true;
    void loadWeather(DEMO_PLACE, { fillSearch: false });
  }, []);

  useEffect(() => {
    if (!activePlace) return undefined;
    let controller: AbortController | null = null;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      controller?.abort();
      controller = new AbortController();
      void fetchWeather(activePlace, controller.signal)
        .then((next) => setBundle((current) => (
          current?.place.id === activePlace.id
            && current.place.latitude === activePlace.latitude
            && current.place.longitude === activePlace.longitude
            ? next : current
        )))
        .catch(() => { /* Keep the last successful forecast until the next refresh. */ });
    };
    const interval = window.setInterval(refresh, 10 * 60 * 1000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      controller?.abort();
    };
  }, [activePlace]);

  const locationPlaceholder = locating
    ? "Detecting your location…"
    : searchHint === "mylocation"
      ? "Your current location, detected by browser"
      : searchHint === "coords"
        ? "Custom field coordinates"
        : "City, region, or farm town";

  useEffect(() => {
    const trimmed = query.trim();
    if (
      trimmed.length < 2
      || (bundle && formatPlaceLabel(bundle.place) === trimmed)
    ) {
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

  async function resolvePlaceFromQuery(): Promise<WeatherPlace | null> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return null;
    if (suggestions[0]) return suggestions[0];
    try {
      const places = await searchPlaces(trimmed);
      return places[0] ?? null;
    } catch {
      return null;
    }
  }

  async function onSearchSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const place = await resolvePlaceFromQuery();
      if (place) {
        await loadWeather(place);
        return;
      }
      setError("No matching place found. Pick a suggestion, or enter latitude and longitude.");
    } finally {
      setPending(false);
    }
  }

  async function onCoordsSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const trimmed = query.trim();
    const queryLooksLikeSearch =
      trimmed.length >= 2
      && (
        suggestions.length > 0
        || searchHint === "default"
      )
      && !(bundle && formatPlaceLabel(bundle.place) === trimmed);

    // Typed place name wins over leftover lat/lon so Check coordinates works without picking a suggestion.
    if (queryLooksLikeSearch) {
      setPending(true);
      setError(null);
      try {
        const place = await resolvePlaceFromQuery();
        if (place) {
          await loadWeather(place);
          return;
        }
        setError(`No places found for “${trimmed}”. Pick a suggestion or enter coordinates.`);
      } finally {
        setPending(false);
      }
      return;
    }

    if (!parsedCoords) {
      setError("Enter both latitude and longitude before checking coordinates.");
      setBundle(null);
      return;
    }
    const { lat, lon } = parsedCoords;
    setSearchHint("coords");
    setQuery("");
    void reverseGeocode(lat, lon).then((place) => (
      loadWeather(place, { fillSearch: false, hint: "coords" })
    )).catch((failure: unknown) => {
      setError(failure instanceof Error ? failure.message : "Unable to check coordinates.");
      setBundle(null);
    });
  }

  function updateLatitude(value: string): void {
    setLatitude(value);
    if (value.trim() === "") {
      weatherController.current?.abort();
      setBundle(null);
      setSuggestions([]);
      setError(null);
    }
  }

  function updateLongitude(value: string): void {
    setLongitude(value);
    if (value.trim() === "") {
      weatherController.current?.abort();
      setBundle(null);
      setSuggestions([]);
      setError(null);
    }
  }

  const theme = bundle
    ? resolveVisualTheme(bundle.current.theme, bundle.current.temperatureC)
    : "partly";
  const isDay = bundle?.current.isDay ?? true;
  const showResults = coordsReady && bundle !== null;

  return (
    <div className={`weather-page weather-tone-${theme}${isDay ? "" : " is-night"} relative min-h-full overflow-hidden`}>
      <WeatherAtmosphere
        key={`${theme}-${isDay ? "day" : "night"}`}
        theme={theme}
        isDay={isDay}
        windSpeedKmh={bundle?.current.windSpeedKmh ?? 0}
        temperatureC={bundle?.current.temperatureC ?? 22}
      />
      <SiteHeader active="weather" />

      <main className="relative z-10 mx-auto max-w-6xl space-y-6 px-4 pb-12 pt-28 text-[var(--on-surface)] sm:px-6 lg:px-8">
        <Reveal immediate delayMs={80} className="weather-glass p-5 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--primary)]">Field weather intelligence</p>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Plan the next move with confidence.</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--on-surface-variant)] sm:text-base">
            Explore a live Faisalabad sample, then search any field worldwide. Forecasts use Open-Meteo; the rotation planner uses NASA POWER climate context.
          </p>

          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <form onSubmit={onSearchSubmit} className="space-y-2">
              <label htmlFor="weather-place-search" className="text-sm font-semibold">Search a place</label>
              <div className="weather-search-row relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--outline)]" aria-hidden />
                <input
                  id="weather-place-search"
                  type="text"
                  value={query}
                  onChange={(event) => {
                    setSearchHint("default");
                    setQuery(event.target.value);
                    if (event.target.value.trim().length < 2) setSuggestions([]);
                  }}
                  placeholder={locationPlaceholder}
                  className="weather-search-input"
                  autoComplete="off"
                />
                <button type="submit" className="weather-search-submit" disabled={query.trim().length < 2 || pending}>Search</button>
              </div>
              {suggestions.length > 0 && (
                <ul className="weather-suggest">
                  {suggestions.map((place) => (
                    <li key={place.id}>
                      <button
                        type="button"
                        className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm"
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
                  disabled={pending || locating || (!coordsReady && query.trim().length < 2)}
                  title={
                    query.trim().length >= 2
                      ? "Load forecast for the searched place (first match if none selected)"
                      : coordsReady
                        ? "Load forecast for these coordinates"
                        : "Enter a place name or latitude and longitude first"
                  }
                >
                  Check coordinates
                </button>
                <button type="button" className="btn-secondary text-sm" disabled={locating || pending} onClick={() => void detectMyLocation()}>
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
            <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger-ink)]">
              <span>{error}</span>
              {!bundle && <button type="button" className="weather-retry-button" onClick={() => void loadWeather(DEMO_PLACE, { fillSearch: false })}>Retry sample</button>}
            </div>
          )}
        </Reveal>

        {pending && !bundle && (
          <div className="weather-loading" role="status" aria-label="Loading field forecast">
            <div className="weather-glass weather-loading-hero"><span /><span /><span /></div>
            <div className="weather-loading-chips">{Array.from({ length: 5 }, (_, index) => <span key={index} />)}</div>
            <p className="sr-only">Loading the field forecast and model estimates.</p>
          </div>
        )}

        {showResults && bundle && <WeatherDashboard bundle={bundle} />}
      </main>
    </div>
  );
}
