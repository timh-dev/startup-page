import React, { useEffect } from "react";
import { useWeatherStore, useWeatherInstance } from "@/features/weather/stores/weatherStore";
import { useWeatherData, type WeatherOverrides } from "@/features/weather/hooks/useWeatherData";
import { resolveWeather } from "@/features/weather/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { WeatherScene } from "./WeatherScene";
import { WeatherStatus } from "./WeatherStatus";
import { WeatherCurrentPanel } from "./WeatherCurrentPanel";
import { WeatherForecastPanel } from "./WeatherForecastPanel";
import WeatherFrostedCard from "./WeatherFrostedCard";
import type { WeatherData } from "@/features/weather/types/weather";
import { debugNowMs } from "@/lib/debug";

interface WeatherBoxProps {
  instanceId?: string;
  overrides?: WeatherOverrides;
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
  instanceId?: string;
}

function WeatherBoxContent({
  data,
  error,
  location,
  clockTime,
  instanceId,
}: WeatherBoxContentProps): React.ReactElement {
  if (error || !data) return <WeatherStatus error={error} instanceId={instanceId} />;

  const resolved = resolveWeather(data, clockTime);
  const { condition, gradient } = resolved;
  const source = data.source;
  const horizonGlowOpacity = resolved.horizonGlow * (resolved.timePhase <= 1 ? 0.28 : 0.34);

  return (
    <div
      className={`weather-widget group/weather relative isolate flex h-full w-full flex-col rounded-[inherit] overflow-hidden bg-gradient-to-br ${gradient}`}
      data-condition={condition}
      style={{ backgroundImage: resolved.skyGradient }}
    >
      <WeatherScene resolved={resolved} condition={condition} locationLabel={location} />
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
      <WeatherCurrentPanel resolved={resolved} location={location} source={source} condition={condition} instanceId={instanceId ?? ""} />
      <WeatherForecastPanel resolved={resolved} instanceId={instanceId ?? ""} />
    </div>
  );
}

function LiveWeatherBox({ instanceId, overrides }: { instanceId: string; overrides?: WeatherOverrides }): React.ReactElement {
  useWeatherData(instanceId, overrides);
  const { data, error, location, detailOpen } = useWeatherInstance(instanceId);
  const clockTime = useWeatherStore((state) => state.clockTime);
  const tickClock = useWeatherStore((state) => state.tickClock);
  const closeWeatherCard = useWeatherStore((state) => state.closeWeatherCard);

  useEffect(() => {
    const timer = window.setInterval(tickClock, 10 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [tickClock]);

  return (
    <>
      <WeatherBoxContent data={data} error={error} location={location} clockTime={clockTime} instanceId={instanceId} />
      <Dialog open={detailOpen} onOpenChange={(open) => !open && closeWeatherCard(instanceId)}>
        <DialogContent className="max-w-3xl">
          <div className="h-[24rem] w-full overflow-hidden rounded-2xl">
            <WeatherFrostedCard instanceId={instanceId} overrides={overrides} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function WeatherBox(props: WeatherBoxProps = {}): React.ReactElement {
  if (!props.data) return <LiveWeatherBox instanceId={props.instanceId ?? ""} overrides={props.overrides} />;

  return (
    <WeatherBoxContent
      data={props.data}
      error={props.error ?? null}
      location={props.location ?? "Weather"}
      clockTime={props.clockTime ?? debugNowMs()}
      instanceId={props.instanceId}
    />
  );
}
