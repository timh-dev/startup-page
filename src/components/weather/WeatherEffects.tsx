import React, { useMemo } from "react";
import VolumetricCloudscape from "@/components/VolumetricCloudscape";
import type { CloudCoverage, WeatherPhase } from "./types";

export function RainDrops(): React.ReactElement {
  const drops = useMemo(
    () =>
      Array.from({ length: 40 }, () => ({
        left:     `${Math.random() * 100}%`,
        top:      `-${Math.random() * 20}%`,
        height:   `${12 + Math.random() * 18}px`,
        duration: `${0.6 + Math.random() * 0.4}s`,
        delay:    `${Math.random() * 2}s`,
      })),
    []
  );
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {drops.map((d, i) => (
        <div
          key={i}
          className="absolute w-[1px] bg-white/20 rounded-full"
          style={{
            left: d.left, top: d.top, height: d.height,
            animation: `weather-rain-fall ${d.duration} linear infinite`,
            animationDelay: d.delay,
          }}
        />
      ))}
    </div>
  );
}

export function SnowFlakes({ heavy = false }: { heavy?: boolean }): React.ReactElement {
  const flakes = useMemo(
    () =>
      Array.from({ length: heavy ? 68 : 34 }, () => {
        const size = `${2 + Math.random() * (heavy ? 5 : 3)}px`;
        return {
          left:     `${Math.random() * 100}%`,
          top:      `-${Math.random() * 10}%`,
          width: size, height: size,
          opacity:  0.42 + Math.random() * (heavy ? 0.5 : 0.34),
          duration: `${heavy ? 1.9 : 3.2 + Math.random() * 3.4}s`,
          delay:    `${Math.random() * (heavy ? 2.5 : 5)}s`,
        };
      }),
    [heavy]
  );
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${heavy ? "weather-heavy-snow" : ""}`}>
      {flakes.map((f, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white/60"
          style={{
            left: f.left, top: f.top, width: f.width, height: f.height, opacity: f.opacity,
            animation: `weather-snow-fall ${f.duration} linear infinite`,
            animationDelay: f.delay,
          }}
        />
      ))}
    </div>
  );
}

export function Stars(): React.ReactElement {
  const stars = useMemo(
    () =>
      Array.from({ length: 220 }, () => {
        const sizeValue =
          Math.random() < 0.78 ? 0.38 + Math.random() * 0.62 : 1 + Math.random() * 0.85;
        const size = `${sizeValue}px`;
        return {
          left:     `${Math.random() * 100}%`,
          top:      `${Math.random() * 86}%`,
          width: size, height: size,
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
            left: s.left, top: s.top, width: s.width, height: s.height, opacity: s.opacity,
            animation: `weather-star-twinkle ${s.duration} ease-in-out infinite`,
            animationDelay: s.delay,
          }}
        />
      ))}
    </div>
  );
}

export function FogLayer(): React.ReactElement {
  return <div className="weather-fog-layer absolute inset-0 overflow-hidden pointer-events-none" />;
}

export function Lightning(): React.ReactElement {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-white/0" style={{ animation: "weather-lightning 4s ease-in-out infinite" }} />
      <div className="absolute inset-0 bg-white/0" style={{ animation: "weather-lightning 7s ease-in-out infinite", animationDelay: "2s" }} />
    </div>
  );
}

interface CloudLayersProps {
  coverage: CloudCoverage;
  phase: WeatherPhase;
}

export function CloudLayers({ coverage, phase }: CloudLayersProps): React.ReactElement {
  return <VolumetricCloudscape coverage={coverage} phase={phase} />;
}
