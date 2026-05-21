import React from "react";
import VolumetricCloudscape from "@/features/media/components/VolumetricCloudscape";
import type { ForecastDay, HourlyForecastPoint } from "@/features/weather/types/weather";

type MetricKey = "humidity" | "uv" | "wind" | "precipitation";

interface MetricDefinition {
  key: MetricKey;
  label: string;
  max: number;
  color: string;
  getValue: (hour: HourlyForecastPoint) => number | null;
  format: (hour: HourlyForecastPoint) => string;
  marker?: (hour: HourlyForecastPoint) => React.ReactNode;
}

function getWindCompass(degrees: number | null): string {
  if (degrees === null) return "--";
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round(degrees / 45) % directions.length];
}

function formatNumber(value: number | null, suffix = ""): string {
  if (value === null || !Number.isFinite(value)) return "--";
  return `${Math.round(value)}${suffix}`;
}

function WindArrow({ degrees, color }: { degrees: number; color: string }): React.ReactElement {
  return (
    <svg
      className="weather-wind-dir-arrow"
      viewBox="0 0 10 14"
      aria-hidden="true"
      style={{ transform: `rotate(${degrees}deg)`, color }}
    >
      <path d="M5 0.5 L9.5 7 H6.3 V13.5 H3.7 V7 H0.5 Z" fill="currentColor" />
    </svg>
  );
}

function mixColor(from: [number, number, number], to: [number, number, number], amount: number): string {
  const value = Math.max(0, Math.min(amount, 1));
  const channels = from.map((channel, index) => Math.round(channel + (to[index] - channel) * value));
  return `rgb(${channels[0]} ${channels[1]} ${channels[2]})`;
}

function getUVColor(uv: number): string {
  const n = Math.max(0, Math.min(uv / 11, 1));
  if (n < 0.27) return mixColor([187, 247, 208], [253, 224, 71], n / 0.27);
  if (n < 0.55) return mixColor([253, 224, 71], [251, 146, 60], (n - 0.27) / 0.28);
  return mixColor([251, 146, 60], [244, 114, 182], (n - 0.55) / 0.45);
}

function UVGradientBar({ samples }: { samples: HourlyForecastPoint[] }): React.ReactElement {
  if (!samples.length) return <div className="weather-uv-bar" />;

  const gradientStops = samples.map((h, i) => {
    const pct = samples.length > 1 ? (i / (samples.length - 1)) * 100 : 50;
    return `${getUVColor(h.uvIndex ?? 0)} ${pct.toFixed(1)}%`;
  }).join(", ");

  return (
    <div className="weather-uv-bar">
      <div className="weather-uv-track" style={{ background: `linear-gradient(90deg, ${gradientStops})` }}>
        {samples.map((h, i) => {
          const pct = samples.length > 1 ? (i / (samples.length - 1)) * 100 : 50;
          const transform =
            i === 0               ? "translateX(0.45em) translateY(-50%)" :
            i === samples.length - 1 ? "translateX(calc(-100% - 0.45em)) translateY(-50%)" :
                                    "translate(-50%, -50%)";
          return (
            <span
              key={h.time}
              className="weather-uv-num"
              style={{ left: `${pct}%`, transform }}
            >
              {h.uvIndex !== null ? Math.round(h.uvIndex) : "—"}
            </span>
          );
        })}
      </div>
    </div>
  );
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

function pickHourlySamples(hours: HourlyForecastPoint[]): HourlyForecastPoint[] {
  return hours.filter((_, index) => index % 3 === 0).slice(0, 8);
}

function buildLinePoints(samples: HourlyForecastPoint[], metric: MetricDefinition): string {
  if (samples.length <= 1) return "";
  return samples.map((hour, index) => {
    const value = metric.getValue(hour) ?? 0;
    const x = (index / (samples.length - 1)) * 100;
    const y = 100 - Math.max(0, Math.min(value / metric.max, 1)) * 100;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

interface WeatherDayDetailProps {
  day: ForecastDay;
  unit: "imperial" | "metric";
  mode?: "bars" | "lines";
  onClose?: () => void;
}

export default function WeatherDayDetail({
  day,
  unit,
  mode = "bars",
  onClose,
}: WeatherDayDetailProps): React.ReactElement {
  const samples = pickHourlySamples(day.hourly);
  const precipitationUnit = unit === "imperial" ? "in" : "mm";
  const windUnit = unit === "imperial" ? "mph" : "km/h";
  const windMax = unit === "imperial" ? 35 : 55;
  const metrics: MetricDefinition[] = [
    {
      key: "humidity",
      label: "Humidity",
      max: 100,
      color: "rgb(45 212 191)",
      getValue: (hour) => hour.humidity,
      format: (hour) => formatNumber(hour.humidity, "%"),
    },
    {
      key: "uv",
      label: "UV index",
      max: 11,
      color: "rgb(244 114 182)",
      getValue: (hour) => hour.uvIndex,
      format: (hour) => hour.uvIndex === null ? "--" : hour.uvIndex.toFixed(1),
    },
    {
      key: "wind",
      label: "Wind",
      max: windMax,
      color: "rgb(129 140 248)",
      getValue: (hour) => hour.windSpeed,
      format: (hour) => `${formatNumber(hour.windSpeed)} ${windUnit} ${getWindCompass(hour.windDirection)}`,
      marker: (hour) => hour.windDirection === null ? null : (
        <span className="weather-detail-wind-arrow" style={{ transform: `rotate(${hour.windDirection}deg)` }}>↑</span>
      ),
    },
    {
      key: "precipitation",
      label: "Precipitation",
      max: 100,
      color: "rgb(37 99 235)",
      getValue: (hour) => hour.precipitationProbability,
      format: (hour) => `${formatNumber(hour.precipitationProbability, "%")} ${hour.precipitation ? `${hour.precipitation}${precipitationUnit}` : ""}`,
    },
  ];

  return (
    <div className="weather-detail-panel">
      <div className="weather-detail-shader" aria-hidden="true">
        <VolumetricCloudscape coverage="partly" phase="night" cloudStyle="stratocumulus" />
      </div>
      <div className="weather-detail-content">
        <div className="weather-detail-header">
          <div>
            <h3>{day.dayName}</h3>
            <p>{day.low}° low · {day.high}° high · {day.precip}% precip · {mode === "bars" ? "bars" : "trend"}</p>
          </div>
          {onClose && <button type="button" onClick={onClose} aria-label="Close hourly forecast">x</button>}
        </div>
        {day.hourly.length > 0 ? (
          mode === "lines" ? (
            <div className="weather-detail-line-panel">
              <svg className="weather-detail-line-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Hourly weather metric trends">
                <line x1="0" y1="25" x2="100" y2="25" />
                <line x1="0" y1="50" x2="100" y2="50" />
                <line x1="0" y1="75" x2="100" y2="75" />
                {metrics.map((metric) => (
                  <polyline
                    key={metric.key}
                    points={buildLinePoints(samples, metric)}
                    style={{ stroke: metric.color }}
                  />
                ))}
              </svg>
              <div className="weather-detail-line-times">
                {samples.map((hour) => <span key={hour.time}>{hour.hourLabel}</span>)}
              </div>
              <div className="weather-detail-legend">
                {metrics.map((metric) => (
                  <span key={metric.key}>
                    <i style={{ background: metric.color }} />
                    {metric.label}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="weather-detail-table">
              <div className="weather-detail-time-axis">
                <span />
                {samples.map((hour) => <span key={hour.time}>{hour.hourLabel}</span>)}
              </div>
              {metrics.map((metric) => (
                <section key={metric.key} className="weather-detail-row" data-metric={metric.key}>
                  <h4>{metric.label}</h4>
                  {metric.key === "uv" ? (
                    <UVGradientBar samples={samples} />
                  ) : (
                    <div className="weather-detail-row-values">
                      {samples.map((hour) => {
                        const value = metric.getValue(hour);
                        const height = `${Math.max(6, Math.min(((value ?? 0) / metric.max) * 100, 100))}%`;
                        const color = getScaleColor(metric.key, value, metric.max);

                        return (
                          <div key={`${metric.key}-${hour.time}`} className="weather-detail-cell">
                            <span className="weather-detail-bar" aria-hidden="true">
                              <span
                                className="weather-detail-bar-fill"
                                style={{
                                  height,
                                  background: `linear-gradient(to top, color-mix(in oklab, ${color} 68%, black), ${color})`,
                                  boxShadow: `0 0 8px color-mix(in oklab, ${color} 40%, transparent), 0 -1px 6px color-mix(in oklab, ${color} 28%, transparent)`,
                                }}
                              />
                            </span>
                            <div className="weather-detail-label">
                              <span className="weather-detail-num">
                                {metric.key === "humidity"      && formatNumber(hour.humidity)}
                                {metric.key === "wind"          && formatNumber(hour.windSpeed)}
                                {metric.key === "precipitation" && formatNumber(hour.precipitationProbability)}
                              </span>
                              <span className="weather-detail-subtext">
                                {metric.key === "humidity" && "%"}
                                {metric.key === "wind" && (
                                  <>
                                    {hour.windDirection !== null && <WindArrow degrees={hour.windDirection} color={color} />}
                                    <span className="weather-detail-unit-text">{windUnit}</span>
                                    {hour.windDirection !== null && <span className="weather-detail-compass">{getWindCompass(hour.windDirection)}</span>}
                                  </>
                                )}
                                {metric.key === "precipitation" && "%"}
                              </span>
                              {metric.key === "precipitation" && hour.precipitation ? (
                                <span className="weather-detail-subtext weather-detail-precip-amt">{hour.precipitation}{precipitationUnit}</span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              ))}
            </div>
          )
        ) : (
          <p className="weather-detail-empty">Hourly forecast unavailable for this day.</p>
        )}
      </div>
    </div>
  );
}
