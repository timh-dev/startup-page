import React from "react";
import {
  RainDrops,
  SnowFlakes,
  Stars,
  FogLayer,
  Lightning,
  CloudLayers,
} from "./WeatherEffects";
import VolumetricCloudscape from "@/features/media/components/VolumetricCloudscape";
import type { ResolvedWeather } from "@/features/weather/types/weather";

interface WeatherSceneProps {
  resolved: ResolvedWeather;
  condition: string;
}

export function WeatherScene({ resolved, condition }: WeatherSceneProps): React.ReactElement {
  const { coverage, phase, timePhase, dayTime, isHeavySnow } = resolved;

  const showClearSky   = condition === "Clear";
  const showClouds     = coverage !== "none" && condition !== "Clear" && condition !== "Snow";
  const showRain       = condition === "Rain" || condition === "Drizzle";
  const showSnowClouds = condition === "Snow";
  const showSnowFlakes = condition === "Snow";
  const showFog        = condition === "Fog";
  const showThunder    = condition === "Thunderstorm";
  const showStars      =
    (condition === "Clear" && !dayTime) ||
    (condition === "Clouds" && !dayTime && coverage === "partly");

  return (
    <>
      {/* z-[2]: WebGL sky/cloud simulation — GPU layer pinned below particle effects */}
      {showClearSky && (
        <div className="absolute inset-0 z-[2] pointer-events-none">
          <VolumetricCloudscape coverage="none" phase={timePhase} />
        </div>
      )}
      {showClouds && (
        <div className="absolute inset-0 z-[2] pointer-events-none">
          <CloudLayers coverage={coverage} phase={phase} />
        </div>
      )}
      {showSnowClouds && (
        <div className="absolute inset-0 z-[2] pointer-events-none">
          <CloudLayers coverage={isHeavySnow ? "storm" : "full"} phase={isHeavySnow ? "storm" : timePhase} />
        </div>
      )}

      {/* z-[5]: Particle/overlay effects rendered above the WebGL canvas */}
      <div className="absolute inset-0 z-[5] overflow-hidden pointer-events-none">
        {showRain       && <RainDrops />}
        {showSnowFlakes && <SnowFlakes heavy={isHeavySnow} />}
        {showFog        && <FogLayer />}
        {showThunder    && <><RainDrops /><Lightning /></>}
        {showStars      && <Stars />}
      </div>
    </>
  );
}
