import React from "react";

import type { WeatherOverrides } from "@/features/weather/hooks/useWeatherData";
import { useWeatherStore } from "@/features/weather/stores/weatherStore";
import { placeKey, useDayFocusStore, useFocusedDay } from "@/features/weather/stores/dayFocusStore";
import type { WeatherData } from "@/features/weather/types/weather";
import { DayCard } from "@/features/weather/dayBar/DayCard";
import { samplesFromOpenWeather } from "@/features/weather/dayBar/sources";
import { startOfDay } from "@/features/weather/dayBar/timeline";
import { useDaySamples } from "@/features/weather/dayBar/useDaySamples";
import { debugNowMs } from "@/lib/debug";
import { WeatherStatus } from "./WeatherStatus";

// The frosted weather card: today (or the day picked on a standard weather
// card for the same place) as one frosted band of sky and weather, midnight
// to midnight. See dayBar/ for how the day is worked out and painted.

/** Now, to the minute (the debugger's time when it's set). */
function useMinuteClock(): number {
  const [now, setNow] = React.useState(() => debugNowMs());
  // The debugger moving time ticks the weather clock: follow it at once.
  const weatherClock = useWeatherStore((state) => state.clockTime);
  React.useEffect(() => setNow(debugNowMs()), [weatherClock]);
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(debugNowMs()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function FrostedLoading(): React.ReactElement {
  return (
    <div className="weather-v2-card weather-v2-state relative flex h-full w-full items-center justify-center overflow-hidden rounded-[inherit]">
      <div className="weather-v2-spinner" />
    </div>
  );
}

/** Where a sample day is drawn when the data doesn't say (the preview page). */
const PREVIEW_PLACE = { latitude: 41.88, longitude: -87.63 };

function LiveFrostedCard({ instanceId, overrides = {} }: { instanceId: string; overrides?: WeatherOverrides }): React.ReactElement {
  const { samples, place, unit, error } = useDaySamples(instanceId, overrides);
  const now = useMinuteClock();
  const placeId = placeKey(overrides);
  const focused = useFocusedDay(placeId);
  const setDay = useDayFocusStore((state) => state.setDay);

  if (!samples || !place) return error ? <WeatherStatus error={error} instanceId={instanceId} /> : <FrostedLoading />;

  // Another day, picked on a standard weather card for this place.
  const today = startOfDay(now);
  const picked = focused ? startOfDay(new Date(`${focused}T12:00:00`).getTime()) : null;
  const other = picked != null && picked > today ? picked : null;

  return (
    <DayCard
      samples={samples}
      dayStart={other ?? today}
      now={other ? null : now}
      place={place}
      unit={unit === "metric" ? "C" : "F"}
      dayName={other ? new Date(other).toLocaleDateString(undefined, { weekday: "long" }) : undefined}
      onBackToToday={other ? () => setDay(placeId, null) : undefined}
    />
  );
}

export interface WeatherFrostedCardProps {
  instanceId?: string;
  overrides?: WeatherOverrides;
  /** A fixed day of OpenWeather data to show instead of fetching (the weather preview page). */
  data?: WeatherData;
  clockTime?: number;
}

export default function WeatherFrostedCard(props: WeatherFrostedCardProps = {}): React.ReactElement {
  if (!props.data) return <LiveFrostedCard instanceId={props.instanceId ?? ""} overrides={props.overrides} />;
  const now = props.clockTime ?? debugNowMs();
  return (
    <DayCard
      samples={samplesFromOpenWeather(props.data)}
      dayStart={startOfDay(now)}
      now={now}
      place={PREVIEW_PLACE}
      unit={props.data.unit === "metric" ? "C" : "F"}
    />
  );
}
