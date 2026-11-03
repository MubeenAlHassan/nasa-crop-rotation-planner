"use client";

import { LocateFixed, MapPin, Search } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
} from "react";
import type { Location } from "@/lib/generated/contracts";
import { formatPlaceLabel, reverseGeocode, searchPlaces, type WeatherPlace } from "../lib/weather/open-meteo";

export interface FieldMapProps {
  initialLocation: Location | null;
  onChange: (location: Location) => void;
  disabled: boolean;
}

interface LeafletLatLng {
  lat: number;
  lng: number;
}

interface LeafletMap {
  setView: (center: [number, number], zoom?: number) => LeafletMap;
  remove: () => void;
  invalidateSize: () => void;
  on: (type: string, fn: (event: { latlng: LeafletLatLng }) => void) => void;
  getZoom?: () => number;
}

interface LeafletTileLayer {
  on: (type: string, fn: () => void) => LeafletTileLayer;
  addTo: (map: LeafletMap) => LeafletTileLayer;
}

interface LeafletNamespace {
  map: (container: HTMLElement, options?: { scrollWheelZoom?: boolean }) => LeafletMap;
  tileLayer: (url: string, options?: { attribution?: string; maxZoom?: number }) => LeafletTileLayer;
}

declare global {
  interface Window {
    L?: LeafletNamespace;
  }
}

function coordinate(value: string, limit: number): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed) <= limit ? parsed : null;
}

function formatCoord(value: number): string {
  return value.toFixed(4);
}

function ensureLeafletCss(): void {
  if (typeof document === "undefined") return;
  if (document.querySelector('link[data-leaflet-css="true"], link[href*="leaflet.css"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/vendor/leaflet.css";
  link.dataset.leafletCss = "true";
  document.head.appendChild(link);
}

function loadLeaflet(): Promise<LeafletNamespace> {
  if (typeof window !== "undefined" && window.L) {
    return Promise.resolve(window.L);
  }

  return new Promise<LeafletNamespace>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Leaflet requires a browser."));
      return;
    }
    if (window.L) {
      resolve(window.L);
      return;
    }

    ensureLeafletCss();

    let settled = false;
    const succeed = (leaflet: LeafletNamespace): void => {
      if (settled) return;
      settled = true;
      resolve(leaflet);
    };
    const fail = (message: string): void => {
      if (settled) return;
      settled = true;
      reject(new Error(message));
    };

    // Poll — Next may inject Leaflet without a reliable load event for late listeners.
    const started = Date.now();
    const poll = window.setInterval(() => {
      if (window.L) {
        window.clearInterval(poll);
        succeed(window.L);
        return;
      }
      if (Date.now() - started > 8_000) {
        window.clearInterval(poll);
        fail("Leaflet did not become available.");
      }
    }, 50);

    const existing = document.querySelector(
      'script[data-leaflet-js="true"], script[src*="leaflet.js"]',
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.L) succeed(window.L);
      }, { once: true });
      existing.addEventListener("error", () => fail("Leaflet script failed to load."), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "/vendor/leaflet.js";
    script.dataset.leafletJs = "true";
    script.addEventListener("load", () => {
      if (window.L) succeed(window.L);
    }, { once: true });
    script.addEventListener("error", () => fail("Leaflet script failed to load."), { once: true });
    document.head.appendChild(script);
  });
}

function clearLeafletStamp(container: HTMLElement): void {
  const stamped = container as HTMLElement & { _leaflet_id?: number };
  if (stamped._leaflet_id != null) {
    delete stamped._leaflet_id;
  }
  container.replaceChildren();
  container.classList.remove(
    "leaflet-container",
    "leaflet-touch",
    "leaflet-fade-anim",
    "leaflet-grab",
    "leaflet-touch-drag",
    "leaflet-touch-zoom",
  );
  delete container.dataset.mapReady;
}

function safeInvalidate(map: LeafletMap | null | undefined): void {
  if (!map) return;
  try {
    map.invalidateSize();
  } catch {
    // Leaflet throws `_leaflet_pos` if invalidateSize runs after remove().
  }
}

function safeRemove(map: LeafletMap | null | undefined): void {
  if (!map) return;
  try {
    map.remove();
  } catch {
    // Ignore teardown races during Strict Mode remounts.
  }
}

export function FieldMap({ initialLocation, onChange, disabled }: FieldMapProps): ReactElement {
  const [latitude, setLatitude] = useState(initialLocation ? formatCoord(initialLocation.latitude) : "");
  const [longitude, setLongitude] = useState(initialLocation ? formatCoord(initialLocation.longitude) : "");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<WeatherPlace[]>([]);
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tileError, setTileError] = useState(false);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const callbackRef = useRef(onChange);
  const disabledRef = useRef(disabled);
  const searchController = useRef<AbortController | null>(null);
  const initialLocationRef = useRef(initialLocation);
  const attachGeneration = useRef(0);
  initialLocationRef.current = initialLocation;
  const [external, setExternal] = useState({ latitude: initialLocation?.latitude, longitude: initialLocation?.longitude });
  if (external.latitude !== initialLocation?.latitude || external.longitude !== initialLocation?.longitude) {
    setExternal({ latitude: initialLocation?.latitude, longitude: initialLocation?.longitude });
    setLatitude(initialLocation ? formatCoord(initialLocation.latitude) : "");
    setLongitude(initialLocation ? formatCoord(initialLocation.longitude) : "");
  }

  useEffect(() => {
    callbackRef.current = onChange;
    disabledRef.current = disabled;
  }, [onChange, disabled]);

  const destroyMap = useCallback((): void => {
    const existing = mapRef.current;
    mapRef.current = null;
    safeRemove(existing);
    const container = containerRef.current;
    if (container) clearLeafletStamp(container);
    setMapReady(false);
  }, []);

  const createMap = useCallback((container: HTMLDivElement, leaflet: LeafletNamespace, generation: number): void => {
    if (attachGeneration.current !== generation || !container.isConnected) return;

    const previous = mapRef.current;
    mapRef.current = null;
    safeRemove(previous);
    containerRef.current = container;
    clearLeafletStamp(container);

    const start = initialLocationRef.current;
    const center: [number, number] = start
      ? [start.latitude, start.longitude]
      : [30.6612, 73.1086];

    let map: LeafletMap;
    try {
      map = leaflet.map(container, { scrollWheelZoom: false }).setView(center, 8);
    } catch {
      if (attachGeneration.current === generation) setTileError(true);
      return;
    }

    if (attachGeneration.current !== generation || !container.isConnected) {
      safeRemove(map);
      return;
    }

    mapRef.current = map;
    container.dataset.mapReady = "true";
    setMapReady(true);
    setTileError(false);

    leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).on("tileerror", () => {
      if (attachGeneration.current === generation) setTileError(true);
    }).addTo(map);

    map.on("click", (event) => {
      if (disabledRef.current) return;
      const { lat, lng } = event.latlng;
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
      setLatitude(formatCoord(lat));
      setLongitude(formatCoord(lng));
      setPlaceLabel(null);
      setQuery("");
      setSuggestions([]);
      setError(null);
      callbackRef.current({ latitude: lat, longitude: lng });
    });

    requestAnimationFrame(() => {
      if (attachGeneration.current === generation && mapRef.current === map) safeInvalidate(map);
    });
    window.setTimeout(() => {
      if (attachGeneration.current === generation && mapRef.current === map) safeInvalidate(map);
    }, 250);
  }, []);

  const setMapContainer = useCallback((node: HTMLDivElement | null): void => {
    if (node === null) {
      attachGeneration.current += 1;
      destroyMap();
      containerRef.current = null;
      return;
    }

    containerRef.current = node;
    const generation = ++attachGeneration.current;
    ensureLeafletCss();

    const boot = (leaflet: LeafletNamespace): void => {
      createMap(node, leaflet, generation);
    };

    if (window.L) {
      boot(window.L);
      return;
    }

    void loadLeaflet()
      .then((leaflet) => {
        if (attachGeneration.current === generation && containerRef.current === node) {
          boot(leaflet);
        }
      })
      .catch(() => {
        if (attachGeneration.current === generation) setTileError(true);
      });
  }, [createMap, destroyMap]);

  useEffect(() => {
    if (!mapReady) return undefined;
    const mapNode = containerRef.current;
    if (!mapNode) return undefined;

    const refresh = (): void => {
      safeInvalidate(mapRef.current);
    };
    refresh();

    const observers: Array<{ disconnect: () => void }> = [];
    if (typeof IntersectionObserver !== "undefined") {
      const intersection = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) refresh();
        },
        { threshold: 0.1 },
      );
      intersection.observe(mapNode);
      observers.push(intersection);
    }
    if (typeof ResizeObserver !== "undefined") {
      const resize = new ResizeObserver(() => refresh());
      resize.observe(mapNode);
      observers.push(resize);
    }
    window.addEventListener("resize", refresh);
    return () => {
      for (const observer of observers) observer.disconnect();
      window.removeEventListener("resize", refresh);
    };
  }, [mapReady]);

  const initialLatitude = initialLocation?.latitude;
  const initialLongitude = initialLocation?.longitude;
  useEffect(() => {
    if (initialLatitude !== undefined && initialLongitude !== undefined) {
      mapRef.current?.setView([initialLatitude, initialLongitude]);
    }
  }, [initialLatitude, initialLongitude]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2 || (placeLabel !== null && placeLabel === trimmed)) {
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
  }, [query, placeLabel]);

  function applyLocation(lat: number, lon: number, label: string | null = null): void {
    setLatitude(formatCoord(lat));
    setLongitude(formatCoord(lon));
    setPlaceLabel(label);
    if (label) setQuery(label);
    setSuggestions([]);
    setError(null);
    mapRef.current?.setView([lat, lon], 10);
    onChange({ latitude: lat, longitude: lon });
  }

  function update(nextLatitude: string, nextLongitude: string): void {
    setLatitude(nextLatitude);
    setLongitude(nextLongitude);
    setPlaceLabel(null);
    const lat = coordinate(nextLatitude, 90);
    const lon = coordinate(nextLongitude, 180);
    if (lat === null || lon === null) {
      setError("Enter a latitude from -90 to 90 and a longitude from -180 to 180.");
      return;
    }
    setError(null);
    mapRef.current?.setView([lat, lon]);
    onChange({ latitude: lat, longitude: lon });
  }

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
    if (disabled) return;
    setSearching(true);
    setError(null);
    try {
      const place = await resolvePlaceFromQuery();
      if (!place) {
        setError("No matching place found. Pick a suggestion, or enter latitude and longitude.");
        return;
      }
      applyLocation(place.latitude, place.longitude, formatPlaceLabel(place));
    } finally {
      setSearching(false);
    }
  }

  function useCurrentLocation(): void {
    if (disabled) return;
    if (!navigator.geolocation) {
      setError("Geolocation is not available in this browser.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setLatitude(formatCoord(lat));
        setLongitude(formatCoord(lon));
        mapRef.current?.setView([lat, lon], 12);
        onChange({ latitude: lat, longitude: lon });
        void reverseGeocode(lat, lon)
          .then((place) => {
            const label = formatPlaceLabel(place);
            setPlaceLabel(label);
            setQuery(label);
            setSuggestions([]);
          })
          .catch(() => {
            setPlaceLabel(null);
          })
          .finally(() => {
            setLocating(false);
          });
      },
      () => {
        setLocating(false);
        setError("Location permission denied. Allow location access, or search a place / enter coordinates.");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  }

  const busy = disabled || searching || locating;

  return (
    <section aria-label="Field location" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-lg font-semibold text-[var(--brand-strong)]">Field location</h2>
        <p className="text-xs text-[var(--muted)]">Search, locate, click map, or type WGS84</p>
      </div>

      <form
        onSubmit={onSearchSubmit}
        className="field-location-search space-y-3 rounded-xl border border-[var(--panel-border)] bg-[var(--brand-soft)]/35 p-3 sm:p-4"
      >
        <label className="text-sm font-semibold text-[var(--on-surface)]">
          Search a place
          <div className="relative mt-1.5">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--brand-strong)]"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
              placeholder={locating ? "Detecting your location…" : "City, region, or farm town"}
              className="field-location-search-input"
              onChange={(event) => {
                setQuery(event.target.value);
                setPlaceLabel(null);
              }}
            />
          </div>
        </label>

        {suggestions.length > 0 && (
          <ul
            role="listbox"
            aria-label="Place suggestions"
            className="max-h-52 overflow-auto rounded-xl border border-[var(--panel-border)] bg-white shadow-[var(--shadow-card)]"
          >
            {suggestions.map((place) => (
              <li key={place.id} role="option" className="border-b border-[var(--panel-border)] last:border-b-0">
                <button
                  type="button"
                  disabled={busy}
                  className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left text-sm transition hover:bg-[var(--brand-soft)]/55"
                  onClick={() => applyLocation(place.latitude, place.longitude, formatPlaceLabel(place))}
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-strong)]" aria-hidden />
                  <span>
                    <span className="font-semibold text-[var(--on-surface)]">{place.name}</span>
                    <span className="mt-0.5 block text-xs text-[var(--muted)]">
                      {[place.admin1, place.country].filter(Boolean).join(", ")} · {place.latitude.toFixed(2)}, {place.longitude.toFixed(2)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="submit"
            className="btn-primary h-11 w-full text-sm"
            disabled={busy || query.trim().length < 2}
          >
            {searching ? "Searching…" : "Use searched place"}
          </button>
          <button
            type="button"
            className="btn-secondary h-11 w-full text-sm"
            disabled={busy}
            onClick={useCurrentLocation}
          >
            <LocateFixed className="h-4 w-4" aria-hidden />
            {locating ? "Detecting…" : "Current location"}
          </button>
        </div>

        {placeLabel && (
          <p className="inline-flex items-center gap-1.5 rounded-lg bg-white/80 px-2.5 py-1.5 text-sm text-[var(--on-surface-variant)] ring-1 ring-[var(--panel-border)]">
            <MapPin className="h-3.5 w-3.5 text-[var(--brand-strong)]" aria-hidden />
            <span>{placeLabel}</span>
          </p>
        )}
      </form>

      <div
        ref={setMapContainer}
        aria-label="Map coordinate picker"
        className="field-map-canvas h-64 w-full overflow-hidden rounded-xl border border-[var(--panel-border)] bg-[var(--surface-container)]"
      />
      <p className="text-sm text-[var(--muted)]">Map tiles © OpenStreetMap contributors. Select a point or enter coordinates below.</p>
      {tileError && <p role="status" className="rounded-lg bg-[var(--warning-bg)] px-3 py-2 text-sm text-[var(--warning-ink)]">Map tiles are unavailable. Coordinate entry remains available.</p>}
      <div className="grid grid-cols-2 gap-3">
        <label>Latitude
          <input type="number" step="any" min="-90" max="90" value={latitude} disabled={busy}
            onChange={(event) => update(event.target.value, longitude)} aria-invalid={error !== null} />
        </label>
        <label>Longitude
          <input type="number" step="any" min="-180" max="180" value={longitude} disabled={busy}
            onChange={(event) => update(latitude, event.target.value)} aria-invalid={error !== null} />
        </label>
      </div>
      {(searching || locating) && (
        <p role="status" className="text-sm text-[var(--info-ink)]">
          {locating ? "Requesting your current location…" : "Looking up the place…"}
        </p>
      )}
      {error && <p role="alert" className="text-sm text-[var(--danger-ink)]">{error}</p>}
    </section>
  );
}
