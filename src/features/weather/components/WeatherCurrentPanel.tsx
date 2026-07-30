import React from "react";
import { useWeatherStore } from "@/features/weather/stores/weatherStore";
import type { ResolvedWeather } from "@/features/weather/types/weather";

interface WeatherCurrentPanelProps {
  resolved: ResolvedWeather;
  location: string;
  source: string;
  condition: string;
  instanceId: string;
}

export function WeatherCurrentPanel({
  resolved,
  location,
  source,
  condition,
  instanceId,
}: WeatherCurrentPanelProps): React.ReactElement {
  const { temperature, unitLabel, description } = resolved;
  const openWeatherCard = useWeatherStore((state) => state.openWeatherCard);

  return (
    <button
      type="button"
      className="weather-current relative z-10 flex min-h-0 flex-1 flex-col justify-between"
      data-condition={condition}
      onClick={() => openWeatherCard(instanceId, null)}
      aria-label="Open weather details"
    >
      <div className="relative z-10 flex min-h-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="weather-location truncate font-semibold uppercase">
            {location}
          </p>
          <p className="weather-temp font-bold tracking-tight">
            {temperature}°
          </p>
        </div>
        <div className="min-w-0 text-right">
          <p className="weather-desc truncate font-medium">
            {description}
          </p>
          <p className="weather-meta truncate">
            °{unitLabel} · {source}
          </p>
        </div>
      </div>
    </button>
  );
}
