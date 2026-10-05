"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import type { Map as LeafletMap } from "leaflet";
import type { Location } from "@/lib/generated/contracts";
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

export function FieldMap({ initialLocation, onChange, disabled }: FieldMapProps): ReactElement {
  const [latitude, setLatitude] = useState(initialLocation?.latitude.toString() ?? "");
  const [longitude, setLongitude] = useState(initialLocation?.longitude.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [tileError, setTileError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const callbackRef = useRef(onChange);
  const disabledRef = useRef(disabled);
  const [external, setExternal] = useState({ latitude: initialLocation?.latitude, longitude: initialLocation?.longitude });
  if (external.latitude !== initialLocation?.latitude || external.longitude !== initialLocation?.longitude) {
    setExternal({ latitude: initialLocation?.latitude, longitude: initialLocation?.longitude });
    setLatitude(initialLocation?.latitude.toString() ?? "");
    setLongitude(initialLocation?.longitude.toString() ?? "");
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
        setLatitude(lat.toString());
        setLongitude(lng.toString());
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

  function update(nextLatitude: string, nextLongitude: string): void {
    setLatitude(nextLatitude);
    setLongitude(nextLongitude);
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

  return (
    <section aria-label="Field location" className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--brand-strong)]">Field location</h2>
        <p className="text-xs text-[var(--muted)]">Click map or type WGS84</p>
      </div>
      <div ref={containerRef} aria-label="Map coordinate picker" className="h-64 w-full overflow-hidden rounded-xl border border-[var(--panel-border)]" />
      <p className="text-sm text-[var(--muted)]">Map tiles © OpenStreetMap contributors. Select a point or enter coordinates below.</p>
      {tileError && <p role="status" className="rounded-lg bg-[var(--warning-bg)] px-3 py-2 text-sm text-[var(--warning-ink)]">Map tiles are unavailable. Coordinate entry remains available.</p>}
      <div className="grid grid-cols-2 gap-3">
        <label>Latitude
          <input type="number" step="any" min="-90" max="90" value={latitude} disabled={disabled}
            onChange={(event) => update(event.target.value, longitude)} aria-invalid={error !== null} />
        </label>
        <label>Longitude
          <input type="number" step="any" min="-180" max="180" value={longitude} disabled={disabled}
            onChange={(event) => update(latitude, event.target.value)} aria-invalid={error !== null} />
        </label>
      </div>
      {error && <p role="alert" className="text-sm text-[var(--danger-ink)]">{error}</p>}
    </section>
  );
}
