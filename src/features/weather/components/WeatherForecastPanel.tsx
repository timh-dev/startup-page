import React from "react";
import { useWeatherStore } from "@/features/weather/stores/weatherStore";
import type { ResolvedWeather } from "@/features/weather/types/weather";

interface WeatherForecastPanelProps {
  resolved: ResolvedWeather;
}

export function WeatherForecastPanel({ resolved }: WeatherForecastPanelProps): React.ReactElement {
  const { forecastDays, rangeMin, rangeSpan, unitLabel } = resolved;
  const { selectedDay, setSelectedDay } = useWeatherStore();
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
            onClick={() => setSelectedDay(
              isSelected
                ? { day, unit, mode: selectedDay?.mode === "bars" ? "lines" : "bars" }
                : { day, unit, mode: "bars" }
            )}
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
