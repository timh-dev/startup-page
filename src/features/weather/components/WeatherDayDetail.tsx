import React, { useEffect, useState } from "react";
import { WiDaySunny, WiCloud, WiRain, WiSprinkle, WiSnow, WiThunderstorm, WiFog } from "react-icons/wi";
import VolumetricCloudscape from "@/features/media/components/VolumetricCloudscape";
import { useWeatherStore, useWeatherInstance } from "@/features/weather/stores/weatherStore";
import { useWeatherData, type WeatherOverrides } from "@/features/weather/hooks/useWeatherData";
import { getOpenWeatherCondition, getOpenWeatherCoverage, getOpenWeatherVisualProfile, getCloudFraction, resolveWeather } from "@/features/weather/utils";
import { sunElevation } from "@/features/media/solarGraph/solarMath";
import type { HourlyForecastPoint } from "@/features/weather/types/weather";

// OpenWeather's free 3-hour forecast endpoint doesn't report UV at all, so
// there's no real UV data to show. Estimate it instead from solar elevation
// (reusing the same astronomy already used for the solar graph) attenuated
// by cloud cover — clouds cut UV far less than visible light, unlike a
// simple "cloudy = low" assumption would suggest. This is a decorative
// estimate, not measured data.
function estimateUVIndex(lat: number, lon: number, hour: HourlyForecastPoint): number {
  const date = new Date(hour.time);
  const localHour = date.getHours();
  const doy = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  const elevation = sunElevation(lat, lon, localHour, doy);
  if (elevation <= 0) return 0;
  const clearSkyUV = 12.5 * Math.pow(Math.sin((elevation * Math.PI) / 180), 1.25);
  const cloudFraction = getCloudFraction(hour.weatherId ?? undefined, null);
  return Math.max(0, Math.min(11, clearSkyUV * (1 - cloudFraction * 0.35)));
}

// Rough day/night curve from wall-clock hour alone — WeatherDayDetail only
// gets sunrise/sunset for "Today" (see useWeatherData.ts), so precise
// astronomical phase isn't available for other days. Good enough for a
// decorative background: 0 = day, 1 = sunset, 2 = night.
function estimatePhaseFromHour(hour: HourlyForecastPoint): number {
  const clockHour = new Date(hour.time).getHours();
  if (clockHour >= 7 && clockHour < 17) return 0;
  if (clockHour >= 17 && clockHour < 19) return (clockHour - 17) / 2;
  if (clockHour >= 19 && clockHour < 21) return 1 + (clockHour - 19) / 2;
  if (clockHour >= 5 && clockHour < 7) return 2 - (clockHour - 5) / 2;
  return 2;
}

// Flat, single-glyph icons — mirrors the plain look of Apple's stock Weather
// widget rather than a rendered scene, kept intentionally simple.
const CONDITION_ICONS = {
  Clear: WiDaySunny,
  Clouds: WiCloud,
  Rain: WiRain,
  Drizzle: WiSprinkle,
  Snow: WiSnow,
  Thunderstorm: WiThunderstorm,
  Fog: WiFog,
} as const;

function ConditionIcon({ weatherId, className }: { weatherId: number | null; className?: string }): React.ReactElement {
  const Icon = CONDITION_ICONS[getOpenWeatherCondition(weatherId ?? 800, "")] ?? WiCloud;
  return <Icon className={className} aria-hidden="true" />;
}

// windDirection is meteorological (the direction wind is blowing FROM), so
// the arrow — which should point where the wind is headed — is rotated 180°
// past that. The glyph's rest state points up/north.
function WindArrow({ fromDegrees, className }: { fromDegrees: number; className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" style={{ transform: `rotate(${(fromDegrees + 180) % 360}deg)` }}>
      <path d="M12 2 L19 15 H14 V22 H10 V15 H5 Z" fill="currentColor" />
    </svg>
  );
}

type MetricKey = "humidity" | "uv" | "wind" | "precipitation";

interface MetricDefinition {
  key: MetricKey;
  label: string;
  max: number;
  getValue: (hour: HourlyForecastPoint) => number | null;
  format: (hour: HourlyForecastPoint) => string;
}

function formatNumber(value: number | null, suffix = ""): string {
  if (value === null || !Number.isFinite(value)) return "--";
  return `${Math.round(value)}${suffix}`;
}

function mixColor(from: [number, number, number], to: [number, number, number], amount: number): string {
  const value = Math.max(0, Math.min(amount, 1));
  const channels = from.map((channel, index) => Math.round(channel + (to[index] - channel) * value));
  return `rgb(${channels[0]} ${channels[1]} ${channels[2]})`;
}

function getScaleColor(metric: MetricKey, value: number | null, max: number): string {
  if (value === null || !Number.isFinite(value)) return "rgb(148 163 184)";
  const normalized = Math.max(0, Math.min(value / max, 1));

  if (metric === "uv") {
    if (normalized < 0.45) return mixColor([187, 247, 208], [250, 204, 21], normalized / 0.45);
    if (normalized < 0.73) return mixColor([250, 204, 21], [251, 146, 60], (normalized - 0.45) / 0.28);
    return mixColor([251, 146, 60], [244, 114, 182], (normalized - 0.73) / 0.27);
  }

  if (metric === "humidity") return mixColor([167, 243, 208], [14, 165, 233], normalized);
  if (metric === "wind") return mixColor([226, 232, 240], [79, 70, 229], normalized);
  return mixColor([191, 219, 254], [30, 64, 175], normalized);
}

interface HourlySample extends HourlyForecastPoint {
  isInterpolated: boolean;
}

function lerp(a: number | null, b: number | null, t: number): number | null {
  if (a === null && b === null) return null;
  if (a === null) return b;
  if (b === null) return a;
  return a + (b - a) * t;
}

// The underlying source is OpenWeather's free 3-hour-step forecast (00, 03,
// 06 ... 21 — 8 real points), not true hourly. Interpolate the gaps so the
// UI can show all 24 hours; each synthesized hour is flagged
// isInterpolated so it can be styled distinctly from real data.
function buildHourlySeries(hours: HourlyForecastPoint[]): HourlySample[] {
  if (hours.length === 0) return [];
  const real = [...hours]
    .map((point) => ({ point, clockHour: new Date(point.time).getHours() }))
    .sort((a, b) => a.clockHour - b.clockHour);

  const series: HourlySample[] = [];
  for (let h = 0; h < 24; h++) {
    let prev = real[0];
    let next = real[real.length - 1];
    for (const entry of real) {
      if (entry.clockHour <= h) prev = entry;
    }
    for (let i = real.length - 1; i >= 0; i--) {
      if (real[i].clockHour >= h) next = real[i];
    }

    const span = next.clockHour - prev.clockHour;
    const t = span > 0 ? (h - prev.clockHour) / span : 0;
    const isReal = prev.clockHour === h || next.clockHour === h;
    const nearest = t < 0.5 ? prev.point : next.point;

    const time = new Date(prev.point.time);
    time.setHours(h, 0, 0, 0);
    const iso = time.toISOString();

    series.push({
      time: iso,
      hourLabel: time.toLocaleTimeString([], { hour: "numeric" }),
      temperature: lerp(prev.point.temperature, next.point.temperature, t),
      weatherId: nearest.weatherId,
      humidity: lerp(prev.point.humidity, next.point.humidity, t),
      uvIndex: lerp(prev.point.uvIndex, next.point.uvIndex, t),
      windSpeed: lerp(prev.point.windSpeed, next.point.windSpeed, t),
      windDirection: nearest.windDirection,
      precipitationProbability: lerp(prev.point.precipitationProbability, next.point.precipitationProbability, t),
      precipitation: lerp(prev.point.precipitation, next.point.precipitation, t),
      isInterpolated: !isReal,
    });
  }
  return series;
}

interface WeatherDayDetailProps {
  instanceId: string;
  overrides?: WeatherOverrides;
}

// Always-available card (like Timer, Windy, etc.) rather than a modal you
// open/close — defaults to today's forecast, and remembers whichever day
// was last picked from the forecast bar until the user picks another. Fetches
// its own data independently (not assumed to share a WeatherBox elsewhere),
// so it works whether it's the "detail" variant of a weather widget on its
// own or opened from a compact WeatherBox's day-detail dialog.
export default function WeatherDayDetail({ instanceId, overrides }: WeatherDayDetailProps): React.ReactElement {
  useWeatherData(instanceId, overrides);
  const { data, selectedDay, lat, lon } = useWeatherInstance(instanceId);
  const clockTime = useWeatherStore((state) => state.clockTime);
  const tickClock = useWeatherStore((state) => state.tickClock);
  // Hooks must run unconditionally on every render, so these come before the
  // early "no data yet" returns below rather than after.
  const [activeMetricKey, setActiveMetricKey] = useState<MetricKey>("humidity");
  const [selectedHourTime, setSelectedHourTime] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(tickClock, 10 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [tickClock]);

  if (!data) {
    return (
      <div className="weather-detail-panel">
        <p className="weather-detail-empty">Loading weather…</p>
      </div>
    );
  }

  const resolved = resolveWeather(data, clockTime);
  const unit: "imperial" | "metric" = resolved.unitLabel === "F" ? "imperial" : "metric";
  const day = selectedDay?.day
    ?? resolved.forecastDays.find((d) => d.dayName === "Today")
    ?? resolved.forecastDays[0];

  if (!day) {
    return (
      <div className="weather-detail-panel">
        <p className="weather-detail-empty">Forecast unavailable.</p>
      </div>
    );
  }

  const samples = buildHourlySeries(day.hourly);
  const windUnit = unit === "imperial" ? "mph" : "km/h";
  const windMax = unit === "imperial" ? 35 : 55;
  const uvLat = lat ?? 40;
  const uvLon = lon ?? -95;
  const metrics: MetricDefinition[] = [
    {
      key: "humidity",
      label: "Humidity",
      max: 100,
      getValue: (hour) => hour.humidity,
      format: (hour) => formatNumber(hour.humidity, "%"),
    },
    {
      key: "uv",
      label: "UV Index (est.)",
      max: 11,
      getValue: (hour) => estimateUVIndex(uvLat, uvLon, hour),
      format: (hour) => `${Math.round(estimateUVIndex(uvLat, uvLon, hour))}`,
    },
    {
      key: "wind",
      label: "Wind",
      max: windMax,
      getValue: (hour) => hour.windSpeed,
      format: (hour) => formatNumber(hour.windSpeed, ` ${windUnit}`),
    },
    {
      key: "precipitation",
      label: "Precipitation",
      max: 100,
      getValue: (hour) => hour.precipitationProbability,
      format: (hour) => formatNumber(hour.precipitationProbability, "%"),
    },
  ];

  const activeMetric = metrics.find((metric) => metric.key === activeMetricKey) ?? metrics[0];
  const selectedHour = samples.find((hour) => hour.time === selectedHourTime) ?? null;
  const sceneCoverage = selectedHour ? getOpenWeatherCoverage(selectedHour.weatherId ?? 800) : day.coverage;
  const scenePhase    = selectedHour ? estimatePhaseFromHour(selectedHour) : "day";
  const sceneCloudStyle = selectedHour
    ? getOpenWeatherVisualProfile(selectedHour.weatherId ?? 800).cloudStyle
    : day.cloudStyle;

  return (
    <div className="weather-detail-panel">
      <div className="weather-detail-shader" aria-hidden="true">
        <VolumetricCloudscape
          coverage={sceneCoverage}
          phase={scenePhase}
          cloudStyle={sceneCloudStyle}
        />
      </div>
      <div className="weather-detail-content">
        {samples.length > 0 ? (
          <>
            <div className="weather-detail-hours">
              {samples.map((hour) => {
                const value = activeMetric.getValue(hour);
                const height = `${Math.max(6, Math.min(((value ?? 0) / activeMetric.max) * 100, 100))}%`;
                const color = getScaleColor(activeMetric.key, value, activeMetric.max);
                const isSelected = hour.time === selectedHourTime;

                return (
                  <button
                    key={hour.time}
                    type="button"
                    className="weather-detail-hour-col"
                    data-active={isSelected}
                    data-interpolated={hour.isInterpolated}
                    aria-pressed={isSelected}
                    title={hour.isInterpolated ? "Estimated between forecast points" : "Forecast data point"}
                    onClick={() => setSelectedHourTime(isSelected ? null : hour.time)}
                  >
                    <span className="weather-detail-hour-label">{hour.hourLabel}</span>
                    <ConditionIcon weatherId={hour.weatherId} className="weather-detail-hour-icon" />
                    <span className="weather-detail-hour-temp">{formatNumber(hour.temperature, "°")}</span>
                    {activeMetric.key === "wind" ? (
                      <span className="weather-detail-hour-wind" aria-hidden="true">
                        <WindArrow
                          fromDegrees={hour.windDirection ?? 0}
                          className="weather-detail-hour-wind-arrow"
                        />
                      </span>
                    ) : (
                      <span className="weather-detail-hour-bar" aria-hidden="true">
                        <span className="weather-detail-hour-bar-fill" style={{ height, background: color }} />
                      </span>
                    )}
                    <span className="weather-detail-hour-value">{activeMetric.format(hour)}</span>
                  </button>
                );
              })}
            </div>
            <div className="weather-detail-metric-tabs" role="tablist">
              {metrics.map((metric) => (
                <button
                  key={metric.key}
                  type="button"
                  role="tab"
                  aria-selected={metric.key === activeMetricKey}
                  className="weather-detail-metric-tab"
                  data-active={metric.key === activeMetricKey}
                  onClick={() => setActiveMetricKey(metric.key)}
                >
                  {metric.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="weather-detail-empty">Hourly forecast unavailable for this day.</p>
        )}
      </div>
    </div>
  );
}
