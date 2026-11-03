"use client";

import { useState, type ReactElement } from "react";
import {
  ArrowUpRight, CloudRain, Droplets, Gauge, MapPin, MoveUpRight,
  Sprout, Sun, Sunrise, Sunset, Wind,
} from "lucide-react";
import { WeatherConditionIcon } from "./weather-condition-icon";
import { WeatherForecastChart } from "./weather-forecast-chart";
import { formatPlaceLabel, type WeatherBundle } from "../lib/weather/open-meteo";

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function dayLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" });
}

function fieldworkStatus(bundle: WeatherBundle): { title: string; copy: string; tone: "good" | "caution" } {
  const { current } = bundle;
  const rainChance = bundle.daily[0]?.precipitationProbabilityPct ?? 0;
  const wetOrWindySoon = bundle.hourly.slice(0, 6).some((hour) => hour.precipitationMm >= 0.2 || hour.windSpeedKmh >= 20);
  if (current.precipitationMm > 0 || current.windSpeedKmh >= 20 || wetOrWindySoon) {
    return {
      title: "Plan around a weather hold",
      copy: "Rain or stronger wind is forecast in the next six hours. Check local conditions and product guidance before field work.",
      tone: "caution",
    };
  }
  if (rainChance >= 40) {
    return {
      title: "Watch the rain window",
      copy: "Conditions look calmer now, but rain remains possible later today. Check the hourly trend before time-sensitive work.",
      tone: "caution",
    };
  }
  return {
    title: "A promising near-term window",
    copy: "Wind is relatively calm and near-term rain risk is lower. Confirm field conditions and product guidance before spraying.",
    tone: "good",
  };
}

function MetricChip({ icon, label, value, note, onClick, active = false }: {
  icon: ReactElement; label: string; value: string; note: string; onClick?: () => void; active?: boolean;
}): ReactElement {
  const content = (
    <>
      <span className="weather-insight-icon" aria-hidden>{icon}</span>
      <span className="weather-chip-body">
        <span className="weather-chip-label">{label}</span>
        <span className="weather-chip-value">{value}</span>
        <span className="weather-chip-note">{note}</span>
      </span>
    </>
  );
  if (onClick) return <button type="button" className={`weather-insight-chip is-interactive${active ? " is-active" : ""}`} aria-pressed={active} onClick={onClick}>{content}</button>;
  return <div className="weather-insight-chip">{content}</div>;
}

type InsightKey = "soil" | "rain" | "wind" | "humidity" | "et";

const INSIGHT_HELP: Record<InsightKey, { title: string; copy: string }> = {
  soil: { title: "Surface soil water", copy: "This model estimates water in the top 1 cm. It does not measure root-zone moisture or tell you when to irrigate; confirm conditions in the field." },
  rain: { title: "Rain chance", copy: "This is today's highest forecast probability. Check the hourly temperature trend and local sky before timing field operations." },
  wind: { title: "Wind speed", copy: "This is current modeled wind at 10 m height. Gusts and field-level exposure may differ; follow product label limits for spraying." },
  humidity: { title: "Humidity", copy: "Relative humidity describes current air moisture. Read it with temperature, wind, and rainfall when planning drying-sensitive work." },
  et: { title: "Reference ET₀", copy: "ET₀ estimates daily atmospheric water demand for a well-watered reference surface. It is not a crop-specific irrigation prescription." },
};

export function WeatherDashboard({ bundle }: { bundle: WeatherBundle }): ReactElement {
  const [showDetails, setShowDetails] = useState(false);
  const [activeInsight, setActiveInsight] = useState<InsightKey | null>(null);
  const status = fieldworkStatus(bundle);
  const { current, daily } = bundle;
  const today = daily[0];
  const moisture = current.surfaceSoilMoisturePct;
  const selectInsight = (key: InsightKey) => setActiveInsight((currentKey) => currentKey === key ? null : key);

  return (
    <div className="weather-results space-y-5">
      <div className="weather-hero-grid">
        <section className="weather-glass weather-dashboard-card weather-current-card p-6 sm:p-8" aria-labelledby="current-weather-heading">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="weather-eyebrow">Live field outlook</p>
              <h2 id="current-weather-heading" className="font-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Current conditions</h2>
              <p className="weather-muted mt-2 flex items-center gap-1.5 text-sm"><MapPin className="h-4 w-4 shrink-0" aria-hidden />{formatPlaceLabel(bundle.place)}</p>
            </div>
            <span className="weather-live-badge"><span aria-hidden /> Forecast updated {clock(bundle.fetchedAt)}</span>
          </div>
          <div className="weather-current-core">
            <div>
              <p className="weather-temperature" key={bundle.current.time}>{Math.round(current.temperatureC)}<span>°C</span></p>
              <p className="font-display text-xl font-semibold">{current.label}</p>
              <p className="weather-muted mt-1 text-sm">Feels like {Math.round(current.feelsLikeC)}° · {bundle.place.latitude.toFixed(2)}°, {bundle.place.longitude.toFixed(2)}°</p>
            </div>
            <div className="weather-condition-orb">
              <WeatherConditionIcon theme={current.theme} label={current.label} temperatureC={current.temperatureC} size="lg" />
            </div>
          </div>
          <div className="weather-current-footer">
            <span><Sunrise className="h-4 w-4" aria-hidden /> Sunrise {clock(today?.sunrise ?? current.time)}</span>
            <span><Sunset className="h-4 w-4" aria-hidden /> Sunset {clock(today?.sunset ?? current.time)}</span>
            <span>Today {Math.round(today?.tempMaxC ?? current.temperatureC)}° / {Math.round(today?.tempMinC ?? current.temperatureC)}°</span>
          </div>
        </section>
        <section className={`weather-action-card is-${status.tone}`} aria-labelledby="fieldwork-heading">
          <div className="weather-action-icon"><Sprout className="h-5 w-5" aria-hidden /></div>
          <div>
            <p className="weather-action-kicker">Fieldwork signal</p>
            <h2 id="fieldwork-heading" className="font-display mt-2 text-2xl font-bold tracking-tight">{status.title}</h2>
            <p className="mt-3 text-sm leading-relaxed">{status.copy}</p>
          </div>
          <div className="weather-action-bottom">
            <span>Wind {Math.round(current.windSpeedKmh)} km/h</span>
            <span>Today’s rain chance {Math.round(today?.precipitationProbabilityPct ?? 0)}%</span>
            <ArrowUpRight className="h-5 w-5" aria-hidden />
          </div>
        </section>
      </div>

      <section aria-labelledby="field-signals-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="weather-eyebrow">At a glance</p>
            <h2 id="field-signals-heading" className="font-display mt-1 text-xl font-bold">Farm-critical signals</h2>
          </div>
          <span className="weather-muted hidden text-xs sm:block">Select a signal for context · inspect field before acting</span>
        </div>
        <div className="weather-insights-grid">
          <MetricChip icon={<Droplets className="h-5 w-5" />} label="Surface soil water" value={moisture === null ? "—" : `${Math.round(moisture)}%`} note={moisture === null ? "Model unavailable" : "Top 1 cm · model estimate"} active={activeInsight === "soil"} onClick={() => selectInsight("soil")} />
          <MetricChip icon={<CloudRain className="h-5 w-5" />} label="Rain chance" value={`${Math.round(today?.precipitationProbabilityPct ?? 0)}%`} note="Maximum today" active={activeInsight === "rain"} onClick={() => selectInsight("rain")} />
          <MetricChip icon={<Wind className="h-5 w-5" />} label="Wind speed" value={`${Math.round(current.windSpeedKmh)} km/h`} note={current.windSpeedKmh < 20 ? "Calmer conditions" : "Check spray limits"} active={activeInsight === "wind"} onClick={() => selectInsight("wind")} />
          <MetricChip icon={<Droplets className="h-5 w-5" />} label="Humidity" value={`${Math.round(current.humidityPct)}%`} note="Current air moisture" active={activeInsight === "humidity"} onClick={() => selectInsight("humidity")} />
          <MetricChip icon={<Sun className="h-5 w-5" />} label="Reference ET₀" value={today?.referenceEtMm == null ? "—" : `${today.referenceEtMm.toFixed(1)} mm`} note={today?.referenceEtMm == null ? "Model unavailable" : "Today · well-watered reference"} active={activeInsight === "et"} onClick={() => selectInsight("et")} />
        </div>
        {activeInsight && <div className="weather-insight-explainer" role="status"><strong>{INSIGHT_HELP[activeInsight].title}</strong><p>{INSIGHT_HELP[activeInsight].copy}</p></div>}
      </section>

      <WeatherForecastChart bundle={bundle} />

      <section className="weather-glass weather-dashboard-card p-5 sm:p-7" aria-labelledby="daily-outlook-heading">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div><p className="weather-eyebrow">Week ahead</p><h2 id="daily-outlook-heading" className="font-display mt-1 text-2xl font-bold tracking-tight">7-day outlook</h2></div>
          <button className="weather-detail-toggle" type="button" aria-expanded={showDetails} onClick={() => setShowDetails((value) => !value)}>
            {showDetails ? "Hide agronomy details" : "Show agronomy details"}<MoveUpRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="weather-week-grid">
          {daily.map((day) => (
            <article key={day.date} className="weather-week-day">
              <p className="weather-chip-label">{dayLabel(day.date)}</p>
              <div className="my-3"><WeatherConditionIcon theme={day.theme} label={day.label} temperatureC={(day.tempMaxC + day.tempMinC) / 2} size="sm" /></div>
              <p className="weather-week-temp">{Math.round(day.tempMaxC)}° <span>{Math.round(day.tempMinC)}°</span></p>
              <p className="weather-chip-note mt-2"><CloudRain className="inline h-3.5 w-3.5" aria-hidden /> {Math.round(day.precipitationProbabilityPct)}% rain</p>
            </article>
          ))}
        </div>
        {showDetails && (
          <div className="weather-detail-grid">
            <MetricChip icon={<Gauge className="h-5 w-5" />} label="Pressure" value={`${Math.round(current.pressureHpa)} hPa`} note="Sea level" />
            <MetricChip icon={<Wind className="h-5 w-5" />} label="Wind gusts" value={`${Math.round(current.windGustsKmh)} km/h`} note="Current model estimate" />
            <MetricChip icon={<CloudRain className="h-5 w-5" />} label="Precipitation" value={`${current.precipitationMm.toFixed(1)} mm`} note="Current interval" />
            <MetricChip icon={<Sun className="h-5 w-5" />} label="UV index" value={current.uvIndex.toFixed(1)} note={`Cloud cover ${Math.round(current.cloudCoverPct)}%`} />
          </div>
        )}
      </section>
      <p className="weather-source-note">Weather forecast and model estimates: Open-Meteo (CC BY 4.0). Surface soil water is a volumetric model estimate, not measured field capacity. Rotation planning uses observed NASA POWER climate context.</p>
    </div>
  );
}
