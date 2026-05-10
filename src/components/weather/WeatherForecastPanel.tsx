import React from "react";
import type { ResolvedWeather } from "./types";

interface WeatherForecastPanelProps {
  resolved: ResolvedWeather;
}

export function WeatherForecastPanel({ resolved }: WeatherForecastPanelProps): React.ReactElement {
  const { forecastDays, rangeMin, rangeSpan } = resolved;

  return (
    <div className="weather-forecast relative z-10 flex items-center justify-between">
      {forecastDays.map((day) => {
        const rangeLeft  = ((day.low - rangeMin) / rangeSpan) * 100;
        const rangeWidth = Math.max(((day.high - day.low) / rangeSpan) * 100, 8);

        return (
          <div key={day.date} className="weather-forecast-day flex min-w-0 flex-1 flex-col items-center">
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
              <span>{day.high}°</span>
              <span className="weather-forecast-low">{day.low}°</span>
            </span>
            <span className="weather-forecast-precip">
              {day.precip > 0 ? `${day.precip}%` : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
