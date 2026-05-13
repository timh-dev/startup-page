import React, { useEffect } from "react";
import { useWeatherStore } from "@/features/weather/stores/weatherStore";
import { useWeatherData } from "@/features/weather/hooks/useWeatherData";
import { resolveWeather } from "@/features/weather/utils";
import { WeatherScene } from "./WeatherScene";
import { WeatherCurrentPanel } from "./WeatherCurrentPanel";
import { WeatherForecastPanel } from "./WeatherForecastPanel";

function LoadingState(): React.ReactElement {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-[inherit] bg-muted/30">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
    </div>
  );
}

function ErrorState({ message }: { message: string }): React.ReactElement {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center rounded-[inherit] bg-muted/50 p-4 text-center text-muted-foreground">
      <p className="text-sm font-medium">Weather unavailable</p>
      <p className="mt-1 text-xs opacity-70">{message}</p>
    </div>
  );
}

export function WeatherBox(): React.ReactElement {
  const { data, error, location, clockTime, tickClock } = useWeatherStore();
  useWeatherData();

  useEffect(() => {
    const timer = window.setInterval(tickClock, 10 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [tickClock]);

  if (error) return <ErrorState message={error} />;
  if (!data)  return <LoadingState />;

  const resolved = resolveWeather(data, clockTime);
  const { condition, gradient } = resolved;
  const source = data.source ?? "Open-Meteo";

  return (
    <div
      className={`weather-widget group/weather relative isolate flex h-full w-full flex-col rounded-[inherit] overflow-hidden bg-gradient-to-br ${gradient}`}
      data-condition={condition}
    >
      <WeatherScene resolved={resolved} condition={condition} />
      <WeatherCurrentPanel resolved={resolved} location={location} source={source} condition={condition} />
      <WeatherForecastPanel resolved={resolved} />
    </div>
  );
}
