"use client";

import { useId, useState, type ReactElement } from "react";
import type { WeatherBundle } from "../lib/weather/open-meteo";

type Range = "hourly" | "daily";

interface ChartPoint {
  label: string;
  temperature: number;
  detail: string;
}

function curve(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const before = points[index - 2] ?? previous;
    const next = points[index + 1] ?? point;
    const firstX = previous.x + (point.x - before.x) / 6;
    const firstY = previous.y + (point.y - before.y) / 6;
    const secondX = point.x - (next.x - previous.x) / 6;
    const secondY = point.y - (next.y - previous.y) / 6;
    return `${path} C ${firstX} ${firstY}, ${secondX} ${secondY}, ${point.x} ${point.y}`;
  }, "");
}

export function WeatherForecastChart({ bundle }: { bundle: WeatherBundle }): ReactElement {
  const [range, setRange] = useState<Range>("hourly");
  const [activeIndex, setActiveIndex] = useState(0);
  const gradientId = useId().replace(/:/g, "");
  const points: ChartPoint[] = range === "hourly"
    ? bundle.hourly.map((hour) => ({
      label: new Date(hour.time).toLocaleTimeString(undefined, { hour: "numeric" }),
      temperature: hour.temperatureC,
      detail: `${hour.precipitationMm.toFixed(1)} mm rain · ${Math.round(hour.windSpeedKmh)} km/h wind`,
    }))
    : bundle.daily.map((day) => ({
      label: new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" }),
      temperature: day.tempMaxC,
      detail: `${Math.round(day.precipitationProbabilityPct)}% rain chance · low ${Math.round(day.tempMinC)}°`,
    }));

  const values = points.map((point) => point.temperature);
  const minimum = Math.floor((values.length ? Math.min(...values) : 0) - 2);
  const maximum = Math.ceil((values.length ? Math.max(...values) : 1) + 2);
  const positions = points.map((point, index) => ({
    x: 24 + index * (592 / Math.max(points.length - 1, 1)),
    y: 176 - ((point.temperature - minimum) / (maximum - minimum)) * 130,
  }));
  const line = curve(positions);
  const area = positions.length > 0 ? `${line} L ${positions.at(-1)!.x} 188 L 24 188 Z` : "";
  const selected = points[Math.min(activeIndex, points.length - 1)];
  const selectedPosition = positions[Math.min(activeIndex, positions.length - 1)];

  function changeRange(next: Range): void {
    setRange(next);
    setActiveIndex(0);
  }

  return (
    <section className="weather-glass weather-dashboard-card forecast-panel p-5 sm:p-7" aria-label="Temperature forecast">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="weather-eyebrow">Forecast intelligence</p>
          <h2 className="font-display mt-1 text-2xl font-bold tracking-tight">Temperature trend</h2>
          <p className="weather-muted mt-1 text-sm">{range === "hourly" ? "Next 24 hours" : "Daily highs for the next 7 days"}</p>
        </div>
        <div className="weather-segments" role="group" aria-label="Forecast range">
          <button type="button" aria-pressed={range === "hourly"} className={range === "hourly" ? "is-active" : ""} onClick={() => changeRange("hourly")}>Hourly</button>
          <button type="button" aria-pressed={range === "daily"} className={range === "daily" ? "is-active" : ""} onClick={() => changeRange("daily")}>7-day</button>
        </div>
      </div>
      {selected && selectedPosition && (
        <div className="forecast-selection" aria-live="polite">
          <span className="forecast-selection-icon" aria-hidden>●</span>
          <strong>{selected.label} · {Math.round(selected.temperature)}°C</strong>
          <span>{selected.detail}</span>
        </div>
      )}
      <div className="forecast-chart-scroll" data-range={range}>
        <div className="forecast-chart">
          <p className="sr-only">{range === "hourly" ? "Hourly temperature" : "Daily high temperature"} line chart. Use the data point buttons to inspect values.</p>
          <svg viewBox="0 0 640 210" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id={`${gradientId}-line`} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#0d8f77"/><stop offset="0.55" stopColor="#36c3a0"/><stop offset="1" stopColor="#d3a844"/></linearGradient>
              <linearGradient id={`${gradientId}-area`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#49cba9" stopOpacity="0.26"/><stop offset="1" stopColor="#49cba9" stopOpacity="0"/></linearGradient>
            </defs>
            {[48, 94, 140, 186].map((y) => <line key={y} x1="24" x2="616" y1={y} y2={y} className="forecast-grid-line" />)}
            <path d={area} fill={`url(#${gradientId}-area)`} />
            <path d={line} className="forecast-line-glow" />
            <path d={line} stroke={`url(#${gradientId}-line)`} strokeWidth="3.5" fill="none" strokeLinecap="round" />
            {selectedPosition && <line x1={selectedPosition.x} x2={selectedPosition.x} y1={selectedPosition.y} y2="188" className="forecast-guide" />}
          </svg>
          {positions.map((position, index) => (
            <button
              key={`${range}-${index}`}
              type="button"
              className={`forecast-point${index === activeIndex ? " is-active" : ""}`}
              style={{ left: `${(position.x / 640) * 100}%`, top: `${(position.y / 210) * 100}%` }}
              aria-label={`${points[index].label}: ${Math.round(points[index].temperature)} degrees Celsius, ${points[index].detail}`}
              onMouseEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              onClick={() => setActiveIndex(index)}
            />
          ))}
        </div>
        <div className="forecast-axis" aria-hidden>
          {points.filter((_, index) => index % (range === "hourly" ? 4 : 1) === 0).map((point, index) => <span key={`${point.label}-${index}`}>{point.label}</span>)}
        </div>
      </div>
    </section>
  );
}
