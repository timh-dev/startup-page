import React from "react";
import { WiCloudy, WiDaySunny, WiNightClear, WiRain, WiSnow, WiStrongWind } from "react-icons/wi";
import { useWeatherData, type WeatherOverrides } from "@/features/weather/hooks/useWeatherData";
import { useWeatherInstance, useWeatherStore } from "@/features/weather/stores/weatherStore";
import type { WeatherCondition, WeatherData } from "@/features/weather/types/weather";
import { getEffectiveWind, getOpenWeatherCondition, getOpenWeatherVisualProfile } from "@/features/weather/utils";
import { debugNowMs } from "@/lib/debug";
import { WeatherStatus } from "./WeatherStatus";

// The forecast card: what it's like now (big), today's high and low, and the
// next hours as a temperature line with the chance of rain under it. It
// looks ahead from now; for a day picked on the other weather card it shows
// that day from morning to night. Drawn on the dashboard's own card surface,
// tinted by the weather, so it sits with the rest of the page.

type Tone = "sunny" | "night" | "cloudy" | "windy" | "rainy" | "snowy";

const TONE_ICON: Record<Tone, React.ComponentType<{ className?: string }>> = {
  sunny: WiDaySunny,
  night: WiNightClear,
  cloudy: WiCloudy,
  windy: WiStrongWind,
  rainy: WiRain,
  snowy: WiSnow,
};

const TONE_LABEL: Record<Tone, string> = {
  sunny: "Clear",
  night: "Clear night",
  cloudy: "Cloudy",
  windy: "Windy",
  rainy: "Rain",
  snowy: "Snow",
};

function toneFor(condition: WeatherCondition, wind: number, isDay: boolean): Tone {
  if (condition === "Rain" || condition === "Drizzle" || condition === "Thunderstorm") return "rainy";
  if (condition === "Snow") return "snowy";
  if (wind > 0.55) return "windy";
  if (condition === "Clear") return isDay ? "sunny" : "night";
  return "cloudy";
}

interface HourPoint {
  time: number;
  label: string;
  temperature: number | null;
  rain: number | null;
  weatherId: number | null;
  wind: number | null;
}

// OpenWeather's free forecast comes in 3-hour steps; this interpolates hourly
// points from `start` (each hour on the hour after the first).
function hourlyFrom(data: WeatherData, start: number, count: number, firstLabel: string): HourPoint[] {
  const h = data.hourly;
  const points = (h?.time ?? [])
    .map((time, i) => ({
      ts: new Date(time).getTime(),
      temp: h?.temperature_2m?.[i] ?? null,
      rain: h?.precipitation_probability?.[i] ?? null,
      id: h?.weather_code?.[i] ?? null,
      wind: h?.wind_speed_10m?.[i] ?? null,
    }))
    .filter((p) => Number.isFinite(p.ts))
    .sort((a, b) => a.ts - b.ts);
  if (!points.length) return [];
  const lerp = (a: number | null, b: number | null, t: number) => (a != null && b != null ? a + (b - a) * t : (a ?? b));
  const out: HourPoint[] = [];
  const firstHour = new Date(start);
  firstHour.setMinutes(0, 0, 0);
  for (let i = 0; i < count; i++) {
    const ts = i === 0 ? start : firstHour.getTime() + i * 3_600_000;
    let prev = points[0];
    let next = points[points.length - 1];
    for (const p of points) if (p.ts <= ts) prev = p;
    for (let k = points.length - 1; k >= 0; k--) if (points[k].ts >= ts) next = points[k];
    const t = next.ts > prev.ts ? (ts - prev.ts) / (next.ts - prev.ts) : 0;
    const temp = lerp(prev.temp, next.temp, t);
    const rain = lerp(prev.rain, next.rain, t);
    out.push({
      time: ts,
      label: i === 0 ? firstLabel : new Date(ts).toLocaleTimeString([], { hour: "numeric" }),
      temperature: temp != null ? Math.round(temp) : null,
      rain: rain != null ? Math.round(rain) : null,
      weatherId: (t < 0.5 ? prev : next).id,
      wind: lerp(prev.wind, next.wind, t),
    });
  }
  return out;
}

/** A sentence about the hours shown: how the temperature moves, and whether rain is likely. */
function summarize(hours: HourPoint[], tone: Tone): string {
  const temps = hours.map((h) => h.temperature).filter((t): t is number => t != null);
  const wettest = hours.reduce<HourPoint | null>((best, h) => ((h.rain ?? 0) > (best?.rain ?? 0) ? h : best), null);
  const last = hours[hours.length - 1]?.label;
  let trend = "";
  if (temps.length > 1) {
    const delta = temps[temps.length - 1] - temps[0];
    trend = Math.abs(delta) < 3 ? "Steady temperatures" : delta > 0 ? `Warming ${delta}° by ${last}` : `Cooling ${-delta}° by ${last}`;
  }
  const wet = wettest && (wettest.rain ?? 0) >= 30 ? `${wettest.rain}% chance of ${tone === "snowy" ? "snow" : "rain"} around ${wettest.label}` : "no rain expected";
  return trend ? `${trend}, ${wet}.` : `${wet.charAt(0).toUpperCase()}${wet.slice(1)}.`;
}

/** The temperature line in a 100 x 100 box (stretched to the card). */
function chartGeometry(hours: HourPoint[]) {
  const temps = hours.map((h) => h.temperature).filter((t): t is number => t != null);
  const min = temps.length ? Math.min(...temps) : 0;
  const max = temps.length ? Math.max(...temps) : 0;
  const range = Math.max(max - min, 4);
  const mid = (max + min) / 2;
  const points = hours.map((h, i) => ({
    x: hours.length > 1 ? 4 + (i / (hours.length - 1)) * 92 : 50,
    // Kept clear of the top (values sit above the points) and the bottom (rain bars).
    y: h.temperature == null ? 52 : 52 - ((h.temperature - mid) / range) * 52,
  }));
  // A smooth curve through the points (Catmull-Rom as cubic Béziers).
  let d = points.length ? `M${points[0].x} ${points[0].y}` : "";
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    d += ` C${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6} ${p2.x} ${p2.y}`;
  }
  const first = points[0];
  const lastPoint = points[points.length - 1];
  return { points, line: d, area: points.length ? `${d} L${lastPoint.x} 100 L${first.x} 100 Z` : "" };
}

interface ForecastProps {
  data: WeatherData;
  clockTime: number;
  location?: string;
  /** A picked day: show it from 6 AM, not from now. */
  dayStart?: number | null;
  hourCount: number;
}

function Forecast({ data, clockTime, location, dayStart, hourCount }: ForecastProps) {
  const hours = hourlyFrom(data, dayStart ?? clockTime, hourCount, dayStart ? new Date(dayStart).toLocaleTimeString([], { hour: "numeric" }) : "Now");
  const first = hours[0];
  const weatherId = dayStart ? (first?.weatherId ?? 800) : (data.current?.weather_code ?? first?.weatherId ?? 800);
  const condition = getOpenWeatherCondition(weatherId, "");
  const wind = getEffectiveWind(getOpenWeatherVisualProfile(weatherId), dayStart ? (first?.wind ?? undefined) : data.current?.wind_speed, data.unit);
  const isDay = dayStart ? true : data.current?.is_day !== 0;
  const tone = toneFor(condition, wind, isDay);
  const Icon = TONE_ICON[tone];
  const temperature = dayStart ? first?.temperature : Math.round(data.current?.temperature_2m ?? first?.temperature ?? 0);
  const description = !dayStart ? data.openWeather?.description : undefined;
  const days = data.daily?.time ?? [];
  const dayIndex = dayStart ? Math.max(0, days.findIndex((t) => new Date(`${t}T12:00:00`).toDateString() === new Date(dayStart).toDateString())) : 0;
  const high = data.daily?.temperature_2m_max?.[dayIndex];
  const low = data.daily?.temperature_2m_min?.[dayIndex];
  const { points, line, area } = chartGeometry(hours);
  const fillId = `forecast-fill-${React.useId().replace(/:/g, "")}`;
  // Values on every second or third hour (always the first and last).
  const labelEvery = hours.length > 9 ? 3 : 2;
  // A regular label too close to the last one is skipped, so they don't overlap.
  const showLabel = (i: number) => i === 0 || i === hours.length - 1 || (i % labelEvery === 0 && hours.length - 1 - i >= labelEvery);
  const eyebrow = [location, dayStart ? new Date(dayStart).toLocaleDateString(undefined, { weekday: "long" }) : null].filter(Boolean).join(" · ");
  const conditionText = description ? description.charAt(0).toUpperCase() + description.slice(1) : TONE_LABEL[tone];

  return (
    <div className="forecast" data-tone={tone}>
      <header className="forecast-head">
        <div className="forecast-now">
          {eyebrow && <p className="forecast-eyebrow">{eyebrow}</p>}
          <p className="forecast-reading">
            <span className="forecast-temp numeric">{temperature != null ? `${temperature}°` : "--"}</span>
            <span className="forecast-condition">
              <Icon className="forecast-icon" aria-hidden="true" />
              <span className="forecast-condition-text">{conditionText}</span>
            </span>
          </p>
        </div>
        {high != null && low != null && (
          <p className="forecast-hilo numeric" aria-label={`High ${Math.round(high)}°, low ${Math.round(low)}°`}>
            <span>H {Math.round(high)}°</span>
            <span>L {Math.round(low)}°</span>
          </p>
        )}
      </header>

      <p className="forecast-summary">{summarize(hours, tone)}</p>

      <div
        className="forecast-chart"
        role="img"
        aria-label={hours.map((h) => `${h.label} ${h.temperature ?? "--"}°${h.rain ? `, ${h.rain}% rain` : ""}`).join("; ")}
      >
        <svg className="forecast-plot" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--forecast-line)" stopOpacity="0.2" />
              <stop offset="1" stopColor="var(--forecast-line)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {hours.map((h, i) =>
            h.rain ? <rect key={i} className="forecast-rain" x={points[i].x - 1.4} width={2.8} y={100 - h.rain * 0.24} height={h.rain * 0.24} /> : null,
          )}
          <path d={area} fill={`url(#${fillId})`} />
          <path d={line} className="forecast-line" />
        </svg>
        {hours.map((h, i) =>
          showLabel(i) ? (
            <span key={i} className="forecast-point" data-first={i === 0 || undefined} data-last={i === hours.length - 1 || undefined} style={{ left: `${points[i].x}%`, top: `${points[i].y}%` }}>
              <span className="forecast-point-value numeric">{h.temperature != null ? `${h.temperature}°` : ""}</span>
            </span>
          ) : null,
        )}
      </div>

      <div className="forecast-hours" aria-hidden="true">
        {hours.map((h, i) =>
          showLabel(i) ? (
            <span key={i} style={{ left: `${points[i].x}%` }} data-first={i === 0 || undefined} data-last={i === hours.length - 1 || undefined}>
              {h.label}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}

/** Eight hours on a narrow (2 x 1) card, twelve when there's room. */
function useHourCount(ref: React.RefObject<HTMLDivElement | null>) {
  const [count, setCount] = React.useState(12);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setCount(el.clientWidth && el.clientWidth < 420 ? 8 : 12);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return count;
}

function LiveForecast({ instanceId, overrides, hourCount }: { instanceId: string; overrides?: WeatherOverrides; hourCount: number }) {
  useWeatherData(instanceId, overrides);
  const { data, error, selectedDay, location } = useWeatherInstance(instanceId);
  const clockTime = useWeatherStore((state) => state.clockTime);
  const tickClock = useWeatherStore((state) => state.tickClock);

  React.useEffect(() => {
    const timer = window.setInterval(tickClock, 10 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [tickClock]);

  if (error) return <WeatherStatus error={error} instanceId={instanceId} />;
  if (!data) return <div className="forecast forecast-loading" aria-busy="true" />;
  // A day picked on the other weather card: that day from 6 AM.
  const dayStart = selectedDay ? new Date(`${selectedDay.day.date}T06:00:00`).getTime() : null;
  return <Forecast data={data} clockTime={clockTime} location={location} dayStart={dayStart} hourCount={dayStart ? 16 : hourCount} />;
}

export interface WeatherFrostedCardProps {
  instanceId?: string;
  overrides?: WeatherOverrides;
  /** Sample data instead of a live card (the weather preview page). */
  data?: WeatherData;
  clockTime?: number;
}

// Live on the dashboard (pass instanceId: fetches and caches per card, and
// follows a day picked on the other weather card), or with sample `data`.
export default function WeatherFrostedCard(props: WeatherFrostedCardProps = {}): React.ReactElement {
  const ref = React.useRef<HTMLDivElement>(null);
  const hourCount = useHourCount(ref);
  return (
    <div ref={ref} className="h-full w-full">
      {props.data ? (
        <Forecast data={props.data} clockTime={props.clockTime ?? debugNowMs()} location="Preview" hourCount={hourCount} />
      ) : (
        <LiveForecast instanceId={props.instanceId ?? ""} overrides={props.overrides} hourCount={hourCount} />
      )}
    </div>
  );
}
