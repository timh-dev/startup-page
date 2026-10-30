import React from "react";
import { hasFrostedCard, useDayFocusStore, useFocusedDay } from "@/features/weather/stores/dayFocusStore";
import { useActiveDashboard } from "@/features/dashboard/useDashboard";
import type { ResolvedWeather } from "@/features/weather/types/weather";

interface WeatherForecastPanelProps {
  resolved: ResolvedWeather;
  /** The place this card shows (see placeKey); the frosted card for it follows the picked day. */
  place: string;
}

/**
 * The days ahead. Picking one shows it on the frosted weather card for the
 * same place (picking it again, or today, goes back). With no frosted card
 * on the dashboard there's nothing to show it on, so the days can't be picked.
 */
export function WeatherForecastPanel({ resolved, place }: WeatherForecastPanelProps): React.ReactElement {
  const { forecastDays, rangeMin, rangeSpan } = resolved;
  const focused = useFocusedDay(place);
  const setDay = useDayFocusStore((state) => state.setDay);
  const linked = hasFrostedCard(useActiveDashboard().widgets, place);

  return (
    <div className="weather-forecast relative z-10 flex items-center justify-between">
      {forecastDays.map((day) => {
        const rangeLeft  = ((day.low - rangeMin) / rangeSpan) * 100;
        const rangeWidth = Math.max(((day.high - day.low) / rangeSpan) * 100, 8);
        const isToday = day.dayName === "Today";
        const isSelected = focused === day.date;
        // Today is picked back by clicking it while another day shows.
        const pickable = linked && (isToday ? focused != null : true);

        return (
          <button
            key={day.date}
            type="button"
            className="weather-forecast-day flex min-w-0 flex-1 flex-col items-center"
            onClick={() => setDay(place, isSelected || isToday ? null : day.date)}
            disabled={!pickable}
            aria-pressed={linked ? isSelected : undefined}
            title={linked ? (isSelected ? "Back to today" : `Show ${day.dayName} on the frosted weather card`) : undefined}
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
