import React from "react";
import { useDayFocusStore, useFocusedDay } from "@/features/weather/stores/dayFocusStore";
import type { ResolvedWeather } from "@/features/weather/types/weather";

interface WeatherCurrentPanelProps {
  resolved: ResolvedWeather;
  location: string;
  source: string;
  condition: string;
  /** The place this card shows (see placeKey). */
  place: string;
}

export function WeatherCurrentPanel({
  resolved,
  location,
  source,
  condition,
  place,
}: WeatherCurrentPanelProps): React.ReactElement {
  const { temperature, unitLabel, description } = resolved;
  // While the frosted card shows another day, this goes back to today.
  const focused = useFocusedDay(place);
  const setDay = useDayFocusStore((state) => state.setDay);
  const Panel = focused ? "button" : "div";

  return (
    <Panel
      {...(focused ? { type: "button" as const, onClick: () => setDay(place, null), title: "Back to today", "aria-label": "Show today on the frosted weather card" } : {})}
      className="weather-current relative z-10 flex min-h-0 flex-1 flex-col justify-between"
      data-condition={condition}
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
    </Panel>
  );
}
