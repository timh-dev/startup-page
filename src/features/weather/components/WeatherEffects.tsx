import React, { useMemo } from "react";
import VolumetricCloudscape from "@/features/media/components/VolumetricCloudscape";
import type { CloudCoverage, CloudStyle, PrecipitationStyle, WeatherPhase, WeatherVisualProfile } from "@/features/weather/types/weather";

export function RainDrops({
  intensity = 0.5,
  style = "rain",
  wind = 0,
}: {
  intensity?: number;
  style?: PrecipitationStyle;
  wind?: number;
}): React.ReactElement {
  const drops = useMemo(() => {
    const count = Math.round(28 + intensity * 80);
    return Array.from({ length: count }, (_, idx) => {
      // Depth simulation: ~30% of drops are "close" (shorter, wider, faster, more opaque)
      const isClose = idx % 3 === 0;
      const baseLen  = style === "drizzle" ? 5 + Math.random() * 8
                     : style === "heavy-rain" ? 18 + Math.random() * 32
                     : 12 + Math.random() * 20;
      const height   = isClose ? baseLen * 0.6 : baseLen;
      const rawWidth = style === "drizzle" ? 0.5
                     : style === "heavy-rain" ? 1.5 + Math.random() * 0.8
                     : 0.8 + Math.random() * 0.6;
      const width    = isClose ? rawWidth * 1.6 : rawWidth;
      const baseOp   = style === "freezing-rain" ? 0.52 : 0.18 + intensity * 0.36;
      const opacity  = isClose ? Math.min(0.82, baseOp * 1.5) : baseOp;
      const baseDur  = (style === "drizzle" ? 1.4 : 0.68) - intensity * 0.32 + Math.random() * 0.38;
      const duration = `${Math.max(0.18, isClose ? baseDur * 0.7 : baseDur)}s`;
      return {
        left:     `${Math.random() * 102}%`,
        top:      `-${Math.random() * 22}%`,
        height:   `${height}px`,
        width:    `${width}px`,
        opacity,
        duration,
        delay:    `${Math.random() * 2.2}s`,
        isClose,
      };
    });
  }, [intensity, style]);

  const skew = style === "shower-rain" || style === "heavy-rain" ? wind * -18 : wind * -9;
  const blurFilter = style === "drizzle" ? "blur(0.4px)" : style === "heavy-rain" ? "blur(0.15px)" : "none";

  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none weather-rain-layer weather-rain-${style}`}
      style={{ filter: blurFilter }}
    >
      {drops.map((d, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: d.left,
            top: d.top,
            height: d.height,
            width: d.width,
            opacity: d.opacity,
            background: style === "freezing-rain"
              ? "linear-gradient(180deg, rgba(191,219,254,0.9) 0%, rgba(219,234,254,0.5) 100%)"
              : d.isClose
                ? "linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(200,220,255,0.4) 100%)"
                : "linear-gradient(180deg, rgba(255,255,255,0.75) 0%, rgba(200,220,255,0.2) 100%)",
            transform: `skewX(${skew}deg)`,
            animation: `weather-rain-fall ${d.duration} linear infinite`,
            animationDelay: d.delay,
          }}
        />
      ))}
      {/* Splash marks at the bottom for moderate+ rain */}
      {intensity > 0.35 && style !== "drizzle" && <RainSplash intensity={intensity} wind={wind} />}
    </div>
  );
}

function RainSplash({ intensity, wind }: { intensity: number; wind: number }) {
  const splashes = useMemo(
    () => Array.from({ length: Math.round(12 + intensity * 22) }, () => ({
      left:  `${Math.random() * 100}%`,
      width: `${3 + Math.random() * 5}px`,
      delay: `${Math.random() * 1.4}s`,
      dur:   `${0.6 + Math.random() * 0.6}s`,
    })),
    [intensity]
  );
  return (
    <>
      {splashes.map((s, i) => (
        <div
          key={i}
          className="absolute bottom-[2%] h-[1.5px] rounded-full opacity-0"
          style={{
            left: s.left,
            width: s.width,
            background: "rgba(255,255,255,0.55)",
            transform: `skewX(${wind * -8}deg)`,
            animation: `weather-rain-splash ${s.dur} ease-out infinite`,
            animationDelay: s.delay,
          }}
        />
      ))}
    </>
  );
}

export function SnowFlakes({
  heavy = false,
  style = "snow",
  wind = 0,
}: {
  heavy?: boolean;
  style?: PrecipitationStyle;
  wind?: number;
}): React.ReactElement {
  const flakes = useMemo(() => {
    const count = heavy ? 72 : 38;
    return Array.from({ length: count }, (_, idx) => {
      // Three depth tiers: close (idx%3==0), mid, distant
      const tier    = idx % 3; // 0=close, 1=mid, 2=far
      const sizeBase = style === "sleet" ? 1.5 + Math.random() * 1.5
                     : tier === 0 ? 4 + Math.random() * (heavy ? 5 : 3.5)
                     : tier === 1 ? 2.5 + Math.random() * (heavy ? 3 : 2)
                     : 1 + Math.random() * 1.5;
      const size = `${sizeBase}px`;
      const opacity = style === "sleet" ? 0.55 + Math.random() * 0.3
                    : tier === 0 ? 0.72 + Math.random() * 0.24
                    : tier === 1 ? 0.48 + Math.random() * 0.28
                    : 0.28 + Math.random() * 0.22;
      // Close flakes fall faster, distant slower
      const speedMult = tier === 0 ? 0.7 : tier === 1 ? 1.0 : 1.5;
      const baseDur   = heavy ? 2.4 + Math.random() * 2.0 : 4.0 + Math.random() * 4.0;
      const duration  = `${baseDur * speedMult}s`;
      // Close flakes drift more
      const swayAmp   = tier === 0 ? 14 + Math.random() * 8
                      : tier === 1 ? 8 + Math.random() * 6
                      : 3 + Math.random() * 4;
      const swayDur   = `${3 + Math.random() * 4}s`;
      return {
        left:     `${Math.random() * 102}%`,
        top:      `-${Math.random() * 12}%`,
        size,
        opacity,
        duration,
        delay:    `${Math.random() * (heavy ? 3 : 6)}s`,
        swayAmp,
        swayDur,
        tier,
        blur:     tier === 0 ? "none" : tier === 1 ? "blur(0.3px)" : "blur(0.6px)",
      };
    });
  }, [heavy, style]);

  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none ${heavy ? "weather-heavy-snow" : ""} weather-snow-${style}`}
    >
      {flakes.map((f, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: f.left,
            top: f.top,
            width: f.size,
            height: f.size,
            opacity: f.opacity,
            filter: f.blur,
            // Outer sway wrapper — drifts horizontally, compensates for wind
            animation: `weather-snow-sway ${f.swayDur} ease-in-out infinite alternate`,
            animationDelay: f.delay,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              animation: `weather-snow-fall ${f.duration} linear infinite`,
              animationDelay: f.delay,
              transform: `translateX(${wind * -12}px)`,
            }}
          />
        </div>
      ))}
    </div>
  );
}

export function Stars(): React.ReactElement {
  const stars = useMemo(
    () =>
      Array.from({ length: 220 }, () => {
        const sizeValue = Math.random() < 0.78 ? 0.38 + Math.random() * 0.62 : 1 + Math.random() * 0.85;
        return {
          left:     `${Math.random() * 100}%`,
          top:      `${Math.random() * 86}%`,
          size:     `${sizeValue}px`,
          opacity:  0.36 + Math.random() * 0.58,
          duration: `${2 + Math.random() * 3}s`,
          delay:    `${Math.random() * 3}s`,
        };
      }),
    []
  );
  return (
    <div className="weather-stars-layer absolute inset-0 z-[8] overflow-hidden pointer-events-none">
      {stars.map((s, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: s.left, top: s.top,
            width: s.size, height: s.size,
            opacity: s.opacity,
            animation: `weather-star-twinkle ${s.duration} ease-in-out infinite`,
            animationDelay: s.delay,
          }}
        />
      ))}
    </div>
  );
}

/** Layered fog/mist bands that roll and drift */
export function FogMistLayer({ intensity = 0.5, style = "fog" }: { intensity?: number; style?: "fog" | "mist" }) {
  const layers = useMemo(() => {
    const count = style === "fog" ? 6 : 4;
    return Array.from({ length: count }, (_, i) => {
      const yPos = i / (count - 1); // 0=bottom, 1=top
      return {
        // fog concentrates at bottom; mist spreads more evenly
        opacity:   style === "fog"
          ? (1 - yPos * 0.7) * intensity * (0.4 + Math.random() * 0.3)
          : (0.3 + (1 - yPos) * 0.4) * intensity * (0.3 + Math.random() * 0.2),
        height:    `${14 + Math.random() * 18}%`,
        bottom:    `${yPos * 68}%`,
        blurR:     `${style === "fog" ? 18 + i * 4 : 12 + i * 3}px`,
        dur:       `${22 + i * 8 + Math.random() * 10}s`,
        delay:     `${Math.random() * -16}s`,
        dir:       i % 2 === 0 ? 1 : -1,
      };
    });
  }, [intensity, style]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {layers.map((l, i) => (
        <div
          key={i}
          className="absolute inset-x-[-10%]"
          style={{
            bottom: l.bottom,
            height: l.height,
            opacity: l.opacity,
            background: style === "fog"
              ? "linear-gradient(180deg, transparent 0%, rgba(220,228,238,0.9) 40%, rgba(220,228,238,0.9) 60%, transparent 100%)"
              : "linear-gradient(180deg, transparent 0%, rgba(235,240,245,0.7) 40%, rgba(235,240,245,0.7) 60%, transparent 100%)",
            filter: `blur(${l.blurR})`,
            animation: `weather-fog-roll-${l.dir > 0 ? "fwd" : "rev"} ${l.dur} ease-in-out infinite alternate`,
            animationDelay: l.delay,
          }}
        />
      ))}
    </div>
  );
}

export function AtmosphereLayer({ visual }: { visual: WeatherVisualProfile }): React.ReactElement {
  if (visual.atmosphereStyle === "none" && visual.surfaceWetness <= 0) return <></>;

  const isFogMist = visual.atmosphereStyle === "fog" || visual.atmosphereStyle === "mist";

  return (
    <>
      {isFogMist && (
        <FogMistLayer
          intensity={visual.atmosphereIntensity}
          style={visual.atmosphereStyle === "fog" ? "fog" : "mist"}
        />
      )}
      <div
        className={`weather-atmosphere-layer weather-atmosphere-${visual.atmosphereStyle} absolute inset-0 overflow-hidden pointer-events-none`}
        style={{
          "--weather-atmosphere-intensity": visual.atmosphereIntensity,
          "--weather-visibility": visual.visibility,
          "--weather-wetness": visual.surfaceWetness,
        } as React.CSSProperties}
      />
    </>
  );
}

export function Lightning({ intensity = 0.6 }: { intensity?: number }): React.ReactElement {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ opacity: 0.45 + intensity * 0.65 }}>
      <div className="absolute inset-0 bg-white/0" style={{ animation: `weather-lightning ${Math.max(2.4, 6 - intensity * 2.8)}s ease-in-out infinite` }} />
      <div className="absolute inset-0 bg-white/0" style={{ animation: `weather-lightning ${Math.max(3.8, 9 - intensity * 3)}s ease-in-out infinite`, animationDelay: "2s" }} />
    </div>
  );
}

interface CloudLayersProps {
  coverage: CloudCoverage;
  phase: WeatherPhase;
  cloudStyle?: CloudStyle;
  fogIntensity?: number;
}

export function CloudLayers({ coverage, phase, cloudStyle = "stratocumulus", fogIntensity = 0 }: CloudLayersProps): React.ReactElement {
  return <VolumetricCloudscape coverage={coverage} phase={phase} cloudStyle={cloudStyle} fogIntensity={fogIntensity} />;
}
