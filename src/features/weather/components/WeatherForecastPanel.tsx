import React from "react";
import { useWeatherStore, useWeatherInstance } from "@/features/weather/stores/weatherStore";
import type { ResolvedWeather } from "@/features/weather/types/weather";

interface WeatherForecastPanelProps {
  resolved: ResolvedWeather;
  instanceId: string;
}

export function WeatherForecastPanel({ resolved, instanceId }: WeatherForecastPanelProps): React.ReactElement {
  const { forecastDays, rangeMin, rangeSpan, unitLabel } = resolved;
  const { selectedDay } = useWeatherInstance(instanceId);
  const openWeatherCard = useWeatherStore((state) => state.openWeatherCard);
  const unit = unitLabel === "F" ? "imperial" : "metric";

  return (
    <div className="weather-forecast relative z-10 flex items-center justify-between">
      {forecastDays.map((day) => {
        const rangeLeft  = ((day.low - rangeMin) / rangeSpan) * 100;
        const rangeWidth = Math.max(((day.high - day.low) / rangeSpan) * 100, 8);
        const isSelected = selectedDay?.day.date === day.date;

        return (
          <button
            key={day.date}
            type="button"
            className="weather-forecast-day flex min-w-0 flex-1 flex-col items-center"
            onClick={() => openWeatherCard(instanceId, isSelected ? null : { day, unit })}
            aria-expanded={isSelected}
          >
            <span className="weather-forecast-name font-medium">{day.dayName}</span>
            <div className="weather-range-track">
              <span
                className="weather-range-fill"
                style={{
                  left:  `${rangeLeft}%`,
                  width: `${Math.min(rangeWidth, 100 - rangeLeft)}%`,
                }}
              />
            </div>
            <span className="weather-forecast-temp font-semibold">
              <span className="weather-forecast-low">{day.low}°</span>
              <span>{day.high}°</span>
            </span>
            <span className="weather-forecast-precip">
              {day.precip > 0 ? `${day.precip}%` : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
