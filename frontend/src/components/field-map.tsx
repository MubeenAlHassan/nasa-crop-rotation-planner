"use client";

import { LocateFixed, MapPin, Search } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactElement } from "react";
import type { Map as LeafletMap } from "leaflet";
import type { Location } from "@/lib/generated/contracts";
import { formatPlaceLabel, reverseGeocode, searchPlaces, type WeatherPlace } from "../lib/weather/open-meteo";
import "leaflet/dist/leaflet.css";

export interface FieldMapProps {
  initialLocation: Location | null;
  onChange: (location: Location) => void;
  disabled: boolean;
}

function coordinate(value: string, limit: number): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed) <= limit ? parsed : null;
}

function formatCoord(value: number): string {
  return value.toFixed(4);
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
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const callbackRef = useRef(onChange);
  const disabledRef = useRef(disabled);
  const searchController = useRef<AbortController | null>(null);
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

  useEffect(() => {
    let mounted = true;
    // Leaflet reads browser globals during module initialization. Keep it out of SSR.
    void import("leaflet").then((leaflet) => {
      if (!mounted || !containerRef.current) return;
      const L = leaflet.default ?? leaflet;
      const center: [number, number] = initialLocation
        ? [initialLocation.latitude, initialLocation.longitude]
        : [31.4504, 73.135];
      const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView(center, 8);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).on("tileerror", () => setTileError(true)).addTo(map);
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
    }).catch(() => {
      if (mounted) setTileError(true);
    });
    return () => {
      mounted = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // The map is initialized once; current callback and disabled values live in refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <section aria-label="Field location" className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--brand-strong)]">Field location</h2>
        <p className="text-xs text-[var(--muted)]">Search, locate, click map, or type WGS84</p>
      </div>

      <form onSubmit={onSearchSubmit} className="space-y-2">
        <label className="text-sm font-medium">
          Search a place
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" aria-hidden />
            <input
              type="search"
              value={query}
              disabled={busy}
              autoComplete="off"
              placeholder={locating ? "Detecting your location…" : "City, region, or farm town"}
              className="w-full pl-10"
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
            className="max-h-52 overflow-auto rounded-xl border border-[var(--panel-border)] bg-white shadow-sm"
          >
            {suggestions.map((place) => (
              <li key={place.id} role="option">
                <button
                  type="button"
                  disabled={busy}
                  className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-[var(--brand-soft)]/40"
                  onClick={() => applyLocation(place.latitude, place.longitude, formatPlaceLabel(place))}
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-strong)]" aria-hidden />
                  <span>
                    <span className="font-semibold">{place.name}</span>
                    <span className="block text-[var(--muted)]">
                      {[place.admin1, place.country].filter(Boolean).join(", ")} · {place.latitude.toFixed(2)}, {place.longitude.toFixed(2)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn-primary text-sm" disabled={busy || query.trim().length < 2}>
            {searching ? "Searching…" : "Use searched place"}
          </button>
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={busy}
            onClick={useCurrentLocation}
          >
            <LocateFixed className="h-4 w-4" aria-hidden />
            {locating ? "Detecting…" : "Current location"}
          </button>
        </div>
      </form>

      {placeLabel && (
        <p className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)]">
          <MapPin className="h-3.5 w-3.5 text-[var(--brand-strong)]" aria-hidden />
          {placeLabel}
        </p>
      )}

      <div ref={containerRef} aria-label="Map coordinate picker" className="h-64 w-full overflow-hidden rounded-xl border border-[var(--panel-border)]" />
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
