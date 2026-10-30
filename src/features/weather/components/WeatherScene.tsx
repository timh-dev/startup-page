import React from "react";
import {
  PrecipitationLayer,
  Stars,
  AtmosphereLayer,
  LightningStorm,
} from "./WeatherEffects";
import AuroraLights from "@/features/media/components/AuroraLights";
import VolumetricCloudscape from "@/features/media/components/VolumetricCloudscape";
import type { CloudStyle, PrecipitationStyle, ResolvedWeather } from "@/features/weather/types/weather";

interface WeatherSceneProps {
  resolved: ResolvedWeather;
  condition: string;
  locationLabel?: string;
}

export function WeatherScene({ resolved, condition, locationLabel }: WeatherSceneProps): React.ReactElement {
  const { phase, dayTime, isHeavySnow, cloudFraction, cloudDensity, windEffective, clockHour } = resolved;
  const { visual } = resolved;

  const showClearSky   = condition === "Clear";
  const showRain       = visual.precipitationStyle === "rain" || visual.precipitationStyle === "drizzle" || visual.precipitationStyle === "heavy-rain" || visual.precipitationStyle === "shower-rain" || visual.precipitationStyle === "freezing-rain";
  const showSnowFlakes = visual.precipitationStyle === "snow" || visual.precipitationStyle === "heavy-snow" || visual.precipitationStyle === "sleet";
  const showThunder    = condition === "Thunderstorm";
  const showAurora     = resolved.showAurora;
  // Stars peek through whenever the night sky is less than ~60% covered
  const showStars      = !dayTime && cloudFraction < 0.6 && condition !== "Thunderstorm";

  // Compute sky props once — single VolumetricCloudscape stays mounted across condition
  // changes so the shader is compiled exactly once and never recompiled mid-session.
  const skyStyle: CloudStyle = showClearSky ? "clear" : visual.cloudStyle;
  const skyFog =
    visual.atmosphereStyle === "fog"  ? visual.atmosphereIntensity :
    visual.atmosphereStyle === "mist" ? visual.atmosphereIntensity * 0.45 :
    0;
  const snowStyle: PrecipitationStyle = isHeavySnow ? "heavy-snow" : visual.precipitationStyle;

  return (
    <>
      {/* z-[2]: single always-mounted WebGL sky — shader compiles once, never recompiled */}
      <div className="absolute inset-0 z-[2] pointer-events-none">
        <VolumetricCloudscape
          coverage={cloudFraction}
          phase={phase}
          cloudStyle={skyStyle}
          fogIntensity={skyFog}
          density={cloudDensity}
          windSpeed={windEffective}
          lightningIntensity={showThunder ? visual.lightningIntensity : 0}
          hour={clockHour}
          // Text is real HTML on top (WeatherCurrentPanel), crisp at any
          // resolution; the shader no longer knocks labels out of the sky.
          locationLabel=""
          temperatureLabel=""
          conditionLabel=""
        />
      </div>

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
          "--weather-wind": windEffective,
        } as React.CSSProperties}
      />

      {/* z-[5]: particle / overlay effects above the WebGL canvas */}
      <div className="absolute inset-0 z-[5] overflow-hidden pointer-events-none">
        <AtmosphereLayer visual={visual} />
        {showRain       && <PrecipitationLayer style={visual.precipitationStyle} intensity={visual.precipitationIntensity} wind={windEffective} />}
        {showSnowFlakes && <PrecipitationLayer style={snowStyle} intensity={Math.max(visual.precipitationIntensity, isHeavySnow ? 0.85 : 0)} wind={windEffective} />}
        {showThunder    && <LightningStorm intensity={visual.lightningIntensity} />}
        {showStars      && <Stars />}
      </div>
    </>
  );
}
