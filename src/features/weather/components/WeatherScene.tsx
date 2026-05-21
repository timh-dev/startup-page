import React from "react";
import {
  RainDrops,
  SnowFlakes,
  Stars,
  AtmosphereLayer,
  Lightning,
  CloudLayers,
} from "./WeatherEffects";
import AuroraLights from "@/features/media/components/AuroraLights";
import VolumetricCloudscape from "@/features/media/components/VolumetricCloudscape";
import type { ResolvedWeather } from "@/features/weather/types/weather";

interface WeatherSceneProps {
  resolved: ResolvedWeather;
  condition: string;
}

export function WeatherScene({ resolved, condition }: WeatherSceneProps): React.ReactElement {
  const { coverage, phase, timePhase, dayTime, isHeavySnow } = resolved;
  const { visual } = resolved;

  const showClearSky   = condition === "Clear";
  const showClouds     = coverage !== "none" && condition !== "Clear" && condition !== "Snow";
  const showRain       = visual.precipitationStyle === "rain" || visual.precipitationStyle === "drizzle" || visual.precipitationStyle === "heavy-rain" || visual.precipitationStyle === "shower-rain" || visual.precipitationStyle === "freezing-rain";
  const showSnowClouds = condition === "Snow";
  const showSnowFlakes = visual.precipitationStyle === "snow" || visual.precipitationStyle === "heavy-snow" || visual.precipitationStyle === "sleet";
  const showThunder    = condition === "Thunderstorm";
  const showAurora     = resolved.showAurora;
  const showStars      =
    (condition === "Clear" && !dayTime) ||
    (condition === "Clouds" && !dayTime && coverage === "partly");

  return (
    <>
      {/* z-[2]: WebGL sky/cloud simulation — GPU layer pinned below particle effects */}
      {showClearSky && (
        <div className="absolute inset-0 z-[2] pointer-events-none">
          <VolumetricCloudscape coverage="none" phase={timePhase} cloudStyle="clear" />
        </div>
      )}
      {showClouds && (
        <div className="absolute inset-0 z-[2] pointer-events-none">
          <CloudLayers
            coverage={coverage}
            phase={phase}
            cloudStyle={visual.cloudStyle}
            fogIntensity={
              visual.atmosphereStyle === "fog"  ? visual.atmosphereIntensity :
              visual.atmosphereStyle === "mist" ? visual.atmosphereIntensity * 0.45 :
              0
            }
          />
        </div>
      )}
      {showSnowClouds && (
        <div className="absolute inset-0 z-[2] pointer-events-none">
          <CloudLayers
            coverage={isHeavySnow ? "storm" : "full"}
            phase={isHeavySnow ? "storm" : timePhase}
            cloudStyle={visual.cloudStyle}
          />
        </div>
      )}
      {showAurora && (
        <div className="absolute inset-0 z-[4] pointer-events-none">
          <AuroraLights intensity={resolved.auroraIntensity} />
        </div>
      )}
      <div
        className={`weather-visual-grade weather-visual-grade-${visual.skyTint} absolute inset-0 z-[4] pointer-events-none`}
        style={{
          "--weather-visibility": visual.visibility,
          "--weather-wetness": visual.surfaceWetness,
          "--weather-wind": visual.windIntensity,
        } as React.CSSProperties}
      />

      {/* z-[5]: Particle/overlay effects rendered above the WebGL canvas */}
      <div className="absolute inset-0 z-[5] overflow-hidden pointer-events-none">
        <AtmosphereLayer visual={visual} />
        {showRain       && <RainDrops intensity={visual.precipitationIntensity} style={visual.precipitationStyle} wind={visual.windIntensity} />}
        {showSnowFlakes && <SnowFlakes heavy={isHeavySnow || visual.precipitationStyle === "heavy-snow"} style={visual.precipitationStyle} wind={visual.windIntensity} />}
        {showThunder    && <Lightning intensity={visual.lightningIntensity} />}
        {showStars      && <Stars />}
      </div>
    </>
  );
}
