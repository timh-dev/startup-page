import React from "react";
import type { ResolvedWeather } from "@/features/weather/types/weather";

interface WeatherCurrentPanelProps {
  resolved: ResolvedWeather;
  location: string;
  source: string;
  condition: string;
}

export function WeatherCurrentPanel({
  resolved,
  location,
  source,
  condition,
}: WeatherCurrentPanelProps): React.ReactElement {
  const { temperature, unitLabel, description, darkText } = resolved;
  const primary: React.CSSProperties = { color: darkText ? "rgb(30 41 59)" : "white" };
  const muted: React.CSSProperties   = { color: darkText ? "rgb(71 85 105)" : "rgba(255,255,255,0.7)" };

  return (
    <div
      className="weather-current relative z-10 flex min-h-0 flex-1 flex-col justify-between"
      data-condition={condition}
    >
      <div className="relative z-10 flex min-h-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="weather-location truncate font-semibold uppercase" style={muted}>
            {location}
          </p>
          <p className="weather-temp font-bold tracking-tight" style={primary}>
            {temperature}°
          </p>
        </div>
        <div className="min-w-0 text-right">
          <p className="weather-desc truncate font-medium" style={primary}>
            {description}
          </p>
          <p className="weather-meta truncate" style={muted}>
            °{unitLabel} · {source}
          </p>
        </div>
      </div>
    </div>
  );
}
