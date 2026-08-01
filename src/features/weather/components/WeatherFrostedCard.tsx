import React from "react";
import { WiDaySunny, WiCloudy, WiStrongWind, WiRain, WiSnow } from "react-icons/wi";
import { useWeatherStore, useWeatherInstance } from "@/features/weather/stores/weatherStore";
import { useWeatherData, type WeatherOverrides } from "@/features/weather/hooks/useWeatherData";
import { getEffectiveWind, getOpenWeatherCondition, getOpenWeatherVisualProfile } from "@/features/weather/utils";
import type { WeatherCondition, WeatherData } from "@/features/weather/types/weather";

type FrostedCategory = "sunny" | "cloudy" | "windy" | "rainy" | "snowy";

const CATEGORY_ICON: Record<FrostedCategory, React.ComponentType<{ className?: string }>> = {
  sunny: WiDaySunny,
  cloudy: WiCloudy,
  windy: WiStrongWind,
  rainy: WiRain,
  snowy: WiSnow,
};

const CATEGORY_LABEL: Record<FrostedCategory, string> = {
  sunny: "Sunny",
  cloudy: "Cloudy",
  windy: "Windy",
  rainy: "Rainy",
  snowy: "Snowy",
};

// The design this widget is based on only knows 5 looks, so the real 7-way
// WeatherCondition collapses down: precipitation always wins (rainy/snowy),
// then strong wind gets its own look even on an otherwise clear/cloudy day,
// otherwise it's just sunny vs. cloudy.
function categorize(condition: WeatherCondition, windEffective: number): FrostedCategory {
  if (condition === "Rain" || condition === "Drizzle" || condition === "Thunderstorm") return "rainy";
  if (condition === "Snow") return "snowy";
  if (windEffective > 0.55) return "windy";
  if (condition === "Clear") return "sunny";
  return "cloudy";
}

interface FrostedHourPoint {
  offsetHours: number;
  label: string;
  temperature: number | null;
  weatherId: number | null;
  windSpeed: number | null;
  isCenter: boolean;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// OpenWeather's free forecast is 3-hour-stepped. Interpolate a symmetric,
// 1-hour-step window around an arbitrary center time by absolute timestamp
// (not by day-bucket, like the detail view does) so the center point is
// always exactly centered and the window never breaks at midnight — used
// both for "today, centered on now" and "a future day, centered on noon".
function buildHourlyWindow(data: WeatherData, centerTime: number, span: number): FrostedHourPoint[] {
  const times = data.hourly?.time ?? [];
  const temps = data.hourly?.temperature_2m ?? [];
  const ids = data.hourly?.weather_code ?? [];
  const winds = data.hourly?.wind_speed_10m ?? [];

  const points = times
    .map((time, index) => ({
      ts: new Date(time).getTime(),
      temp: temps[index] ?? null,
      id: ids[index] ?? null,
      wind: winds[index] ?? null,
    }))
    .filter((point) => Number.isFinite(point.ts))
    .sort((a, b) => a.ts - b.ts);

  if (!points.length) return [];

  const stepMs = 60 * 60 * 1000;
  const result: FrostedHourPoint[] = [];

  for (let offset = -span; offset <= span; offset++) {
    const targetTs = centerTime + offset * stepMs;
    let prev = points[0];
    let next = points[points.length - 1];
    for (const point of points) {
      if (point.ts <= targetTs) prev = point;
    }
    for (let i = points.length - 1; i >= 0; i--) {
      if (points[i].ts >= targetTs) next = points[i];
    }

    const span2 = next.ts - prev.ts;
    const t = span2 > 0 ? (targetTs - prev.ts) / span2 : 0;
    const nearest = t < 0.5 ? prev : next;
    const temperature = prev.temp != null && next.temp != null
      ? lerp(prev.temp, next.temp, t)
      : prev.temp ?? next.temp;
    const windSpeed = prev.wind != null && next.wind != null
      ? lerp(prev.wind, next.wind, t)
      : prev.wind ?? next.wind;

    result.push({
      offsetHours: offset,
      label: new Date(targetTs).toLocaleTimeString([], { hour: "numeric" }),
      temperature: temperature != null ? Math.round(temperature) : null,
      weatherId: nearest.id,
      windSpeed,
      isCenter: offset === 0,
    });
  }

  return result;
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function mixHex(from: string, to: string, amount: number): string {
  const t = Math.max(0, Math.min(amount, 1));
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const mixed = a.map((channel, index) => Math.round(channel + (b[index] - channel) * t).toString(16).padStart(2, "0"));
  return `#${mixed.join("")}`;
}

// Cold -> icy blue, through white, to warm orange/yellow — same visual
// language as the design's fixed rainbow ribbon, but driven by each hour's
// actual temperature relative to the window's own range.
function temperatureToColor(temp: number, min: number, max: number): string {
  const range = Math.max(max - min, 1);
  const t = Math.max(0, Math.min((temp - min) / range, 1));
  if (t < 0.45) return mixHex("#d6eef7", "#ffffff", t / 0.45);
  if (t < 0.7) return mixHex("#ffffff", "#f2764a", (t - 0.45) / 0.25);
  return mixHex("#f2764a", "#ffe45e", (t - 0.7) / 0.3);
}

// Deterministic (index-based, not Math.random()) so first render is stable —
// same technique the source design's own generator script used.
function makeDrops(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    left: `${(3 + (i * 4.7) % 95).toFixed(1)}%`,
    delay: `${(-(i * 0.13) % 1.6).toFixed(2)}s`,
    duration: `${(1.5 + ((i * 7) % 5) * 0.14).toFixed(2)}s`,
  }));
}

function makeFlakes(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    left: `${(3 + (i * 6.1) % 94).toFixed(1)}%`,
    delay: `${(-(i * 0.6) % 8).toFixed(2)}s`,
    duration: `${(9 + ((i * 3) % 5) * 1.1).toFixed(2)}s`,
  }));
}

function makeGusts() {
  return [10, 30, 48, 66, 84].map((top, i) => ({
    top: `${top}%`,
    delay: `${(-(i * 0.85)).toFixed(2)}s`,
    duration: `${(2.8 + i * 0.4).toFixed(2)}s`,
  }));
}

const DROPS = makeDrops(22);
const FLAKES = makeFlakes(18);
const GUSTS = makeGusts();

function FrostedBackground({ category }: { category: FrostedCategory }): React.ReactElement {
  if (category === "sunny") {
    return (
      <>
        <div className="weather-v2-bg-base weather-v2-bg-sunny-base" />
        <div className="weather-v2-bg-sunny-wash" />
        <div className="weather-v2-bg-sunny-glow-outer" />
        <div className="weather-v2-bg-sunny-glow-core" />
      </>
    );
  }

  if (category === "cloudy") {
    return (
      <>
        <div className="weather-v2-bg-base weather-v2-bg-cloudy-base" />
        <div className="weather-v2-bg-cloudy-drift weather-v2-bg-cloudy-drift-a" />
        <div className="weather-v2-bg-cloudy-drift weather-v2-bg-cloudy-drift-b" />
      </>
    );
  }

  if (category === "windy") {
    return (
      <>
        <div className="weather-v2-bg-base weather-v2-bg-windy-base" />
        {GUSTS.map((gust, index) => (
          <span
            key={index}
            className="weather-v2-gust"
            style={{ top: gust.top, animationDelay: gust.delay, animationDuration: gust.duration }}
          />
        ))}
      </>
    );
  }

  if (category === "rainy") {
    return (
      <>
        <div className="weather-v2-bg-base weather-v2-bg-rainy-base" />
        {DROPS.map((drop, index) => (
          <span
            key={index}
            className="weather-v2-raindrop"
            style={{ left: drop.left, animationDelay: drop.delay, animationDuration: drop.duration }}
          />
        ))}
      </>
    );
  }

  return (
    <>
      <div className="weather-v2-bg-base weather-v2-bg-snowy-base" />
      {FLAKES.map((flake, index) => (
        <span
          key={index}
          className="weather-v2-snowflake"
          style={{ left: flake.left, animationDelay: flake.delay, animationDuration: flake.duration }}
        />
      ))}
    </>
  );
}

function FrostedLoading(): React.ReactElement {
  return (
    <div className="weather-v2-card weather-v2-state relative flex h-full w-full items-center justify-center overflow-hidden rounded-[inherit]">
      <div className="weather-v2-spinner" />
    </div>
  );
}

function FrostedError({ message }: { message: string }): React.ReactElement {
  return (
    <div className="weather-v2-card weather-v2-state relative flex h-full w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-[inherit] p-4 text-center">
      <p className="weather-v2-state-title">Weather unavailable</p>
      <p className="weather-v2-state-hint">{message}</p>
    </div>
  );
}

interface FrostedContentProps {
  data: WeatherData;
  clockTime: number;
  centerTime: number;
  hourSpan: number;
}

function FrostedContent({ data, clockTime, centerTime, hourSpan }: FrostedContentProps): React.ReactElement {
  const hours = buildHourlyWindow(data, centerTime, hourSpan);
  const centerHour = hours.find((hour) => hour.isCenter) ?? hours[Math.floor(hours.length / 2)];

  // Derived from the CENTERED hour's own data — not "right now" — so a
  // future selected day shows that day's condition/wind, not today's.
  const weatherId = centerHour?.weatherId ?? 800;
  const condition = getOpenWeatherCondition(weatherId, "");
  const visual = getOpenWeatherVisualProfile(weatherId);
  const windEffective = getEffectiveWind(visual, centerHour?.windSpeed ?? undefined, data.unit);
  const category = categorize(condition, windEffective);
  const Icon = CATEGORY_ICON[category];

  const centerDate = new Date(centerTime);
  const isToday = centerDate.toDateString() === new Date(clockTime).toDateString();
  const centerLabel = isToday ? "NOW" : centerDate.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase();
  const headlineTail = isToday
    ? "conditions will continue for the rest of the day"
    : `conditions expected ${centerDate.toLocaleDateString(undefined, { weekday: "long" })}`;

  const temps = hours.map((hour) => hour.temperature).filter((value): value is number => value != null);
  const minTemp = temps.length ? Math.min(...temps) : (centerHour?.temperature ?? 0) - 5;
  const maxTemp = temps.length ? Math.max(...temps) : (centerHour?.temperature ?? 0) + 5;

  const blobWidthPct = 34;
  const spanStart = -8;
  const spanEnd = 108;
  const gridColumns = { gridTemplateColumns: `repeat(${hours.length}, 1fr)` };

  return (
    <div
      className="weather-v2-card relative isolate flex h-full w-full flex-col overflow-hidden rounded-[inherit]"
      data-category={category}
    >
      <div className="weather-v2-bg-layer absolute inset-0" aria-hidden="true">
        <FrostedBackground category={category} />
      </div>
      <div className="weather-v2-glass absolute inset-0" aria-hidden="true" />
      <div className="weather-v2-content relative z-10 flex h-full w-full flex-col">
        <p className="weather-v2-headline">
          {CATEGORY_LABEL[category]}{" "}
          <Icon className="weather-v2-headline-icon" aria-hidden="true" />{" "}
          {headlineTail}
        </p>

        <div className="weather-v2-rule" aria-hidden="true" />

        <div className="weather-v2-temp-row" style={gridColumns}>
          {hours.map((hour) => (
            <div key={hour.offsetHours} className={`weather-v2-temp-cell ${hour.isCenter ? "weather-v2-temp-cell-now" : ""}`}>
              {hour.isCenter && <span className="weather-v2-now-label">{centerLabel}</span>}
              <span className="weather-v2-temp-value">{hour.temperature != null ? `${hour.temperature}°` : "--"}</span>
            </div>
          ))}
        </div>

        <div className="weather-v2-ribbon">
          <div className="weather-v2-ribbon-blur" aria-hidden="true">
            {hours.map((hour, index) => {
              if (hour.temperature == null) return null;
              const color = temperatureToColor(hour.temperature, minTemp, maxTemp);
              const centerPct = spanStart + (index / (hours.length - 1)) * (spanEnd - spanStart);
              return (
                <span
                  key={hour.offsetHours}
                  className="weather-v2-ribbon-blob"
                  style={{
                    left: `${centerPct - blobWidthPct / 2}%`,
                    width: `${blobWidthPct}%`,
                    background: `radial-gradient(50% 50% at 50% 50%, ${color} 0%, ${color} 42%, transparent 100%)`,
                  }}
                />
              );
            })}
          </div>
          <span className="weather-v2-ribbon-marker" aria-hidden="true" />
          <span className="weather-v2-ribbon-dot" aria-hidden="true" />
        </div>

        <div className="weather-v2-rule" aria-hidden="true" />

        <div className="weather-v2-hour-row" style={gridColumns}>
          {hours.map((hour) => (
            <div key={hour.offsetHours} className="weather-v2-hour-cell">
              {hour.isCenter ? <span className="weather-v2-hour-pill">{hour.label}</span> : hour.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const LIVE_HOUR_SPAN = 6;

function LiveFrostedCard({ instanceId, overrides }: { instanceId: string; overrides?: WeatherOverrides }): React.ReactElement {
  useWeatherData(instanceId, overrides);
  const { data, error, selectedDay } = useWeatherInstance(instanceId);
  const clockTime = useWeatherStore((state) => state.clockTime);
  const tickClock = useWeatherStore((state) => state.tickClock);

  React.useEffect(() => {
    const timer = window.setInterval(tickClock, 10 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [tickClock]);

  if (error) return <FrostedError message={error} />;
  if (!data) return <FrostedLoading />;

  // A selected forecast day (from the v1 widget's date pills, sharing this
  // same weatherStore instance) has no "now" of its own — center on its noon.
  const centerTime = selectedDay ? new Date(`${selectedDay.day.date}T12:00:00`).getTime() : clockTime;

  return <FrostedContent data={data} clockTime={clockTime} centerTime={centerTime} hourSpan={LIVE_HOUR_SPAN} />;
}

export interface WeatherFrostedCardProps {
  instanceId?: string;
  overrides?: WeatherOverrides;
  data?: WeatherData;
  clockTime?: number;
  /** Hour to center the ribbon on; defaults to `clockTime` ("now"). */
  centerTime?: number;
  /** Hours shown before/after the center point; defaults to 6 (13 points). */
  hourSpan?: number;
}

// Dual-mode like WeatherBox: pass instanceId for a live dashboard widget
// (fetches + caches per-instance via useWeatherData/useWeatherStore, and
// follows the instance's selectedDay so it doubles as the v1 widget's
// day-detail view), or pass a synthetic `data` fixture directly to preview a
// specific condition without needing that weather to actually be happening.
export default function WeatherFrostedCard(props: WeatherFrostedCardProps = {}): React.ReactElement {
  if (!props.data) {
    return <LiveFrostedCard instanceId={props.instanceId ?? ""} overrides={props.overrides} />;
  }

  const clockTime = props.clockTime ?? Date.now();
  return (
    <FrostedContent
      data={props.data}
      clockTime={clockTime}
      centerTime={props.centerTime ?? clockTime}
      hourSpan={props.hourSpan ?? LIVE_HOUR_SPAN}
    />
  );
}
