import React, { useEffect } from "react";
import { useWeatherStore } from "@/features/weather/stores/weatherStore";
import { useWeatherData } from "@/features/weather/hooks/useWeatherData";
import { resolveWeather } from "@/features/weather/utils";
import { WeatherScene } from "./WeatherScene";
import { WeatherCurrentPanel } from "./WeatherCurrentPanel";
import { WeatherForecastPanel } from "./WeatherForecastPanel";
import type { WeatherData } from "@/features/weather/types/weather";

interface WeatherBoxProps {
  data?: WeatherData;
  error?: string | null;
  location?: string;
  clockTime?: number;
}

interface WeatherBoxContentProps {
  data: WeatherData | null;
  error: string | null;
  location: string;
  clockTime: number;
}

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

function WeatherBoxContent({
  data,
  error,
  location,
  clockTime,
}: WeatherBoxContentProps): React.ReactElement {
  if (error) return <ErrorState message={error} />;
  if (!data)  return <LoadingState />;

  const resolved = resolveWeather(data, clockTime);
  const { condition, gradient } = resolved;
  const source = data.source ?? "Open-Meteo";
  const horizonGlowOpacity = resolved.horizonGlow * (resolved.timePhase <= 1 ? 0.28 : 0.34);

  return (
    <div
      className={`weather-widget group/weather relative isolate flex h-full w-full flex-col rounded-[inherit] overflow-hidden bg-gradient-to-br ${gradient}`}
      data-condition={condition}
      style={{ backgroundImage: resolved.skyGradient }}
    >
      <WeatherScene resolved={resolved} condition={condition} />
      <div
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ backgroundColor: `rgba(0, 0, 0, ${resolved.skyDarkness})` }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-[-20%] bottom-[-28%] z-[7] h-[60%]"
        style={{
          background: `radial-gradient(ellipse at center, rgba(255, 176, 84, ${horizonGlowOpacity}) 0%, rgba(226, 82, 75, ${horizonGlowOpacity * 0.58}) 34%, rgba(55, 65, 140, ${horizonGlowOpacity * 0.28}) 58%, transparent 76%)`,
        }}
        aria-hidden="true"
      />
      <WeatherCurrentPanel resolved={resolved} location={location} source={source} condition={condition} />
      <WeatherForecastPanel resolved={resolved} />
    </div>
  );
}

function LiveWeatherBox(): React.ReactElement {
  const { data, error, location, clockTime, tickClock } = useWeatherStore();
  useWeatherData();

  useEffect(() => {
    const timer = window.setInterval(tickClock, 10 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [tickClock]);

  return <WeatherBoxContent data={data} error={error} location={location} clockTime={clockTime} />;
}

export function WeatherBox(props: WeatherBoxProps = {}): React.ReactElement {
  if (!props.data) return <LiveWeatherBox />;

  return (
    <WeatherBoxContent
      data={props.data}
      error={props.error ?? null}
      location={props.location ?? "Weather"}
      clockTime={props.clockTime ?? Date.now()}
    />
  );
}
