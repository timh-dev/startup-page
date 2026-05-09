import React from "react";
import { NeuroNoise } from "@paper-design/shaders-react";
import VolumetricCloudscape from "@/components/VolumetricCloudscape";
import { CONDITION_GRADIENTS, SHADER_COLORS } from "@/components/weather/constants";

const PREVIEW_DATA = [
  { title: "Sunny", condition: "Clear", time: "day", phase: 0, coverage: "none", temp: 78, desc: "Clear sky", location: "Los Angeles" },
  { title: "Late Afternoon", condition: "Clear", time: "day", phase: 0.45, coverage: "none", temp: 74, desc: "Clear sky", location: "Los Angeles" },
  { title: "Mostly Clear Night", condition: "Clear", time: "night", phase: 2, coverage: "none", temp: 62, desc: "Clear night", location: "Los Angeles" },
  { title: "Partly Cloudy Day", condition: "Clouds", time: "day", phase: 0, coverage: "partly", temp: 67, desc: "Partly cloudy", location: "Chicago" },
  { title: "Cloudy Day", condition: "Clouds", time: "day", phase: 0, coverage: "full", temp: 55, desc: "Overcast", location: "Seattle" },
  { title: "Partly Cloudy Sunset", condition: "Clouds", time: "day", phase: 1, coverage: "partly", temp: 64, desc: "Partly cloudy", location: "Phoenix" },
  { title: "Cloudy Dusk", condition: "Clouds", time: "night", phase: 1.45, coverage: "full", temp: 56, desc: "Cloudy", location: "Santa Fe" },
  { title: "Partly Cloudy Night", condition: "Clouds", time: "night", phase: 2, coverage: "partly", temp: 48, desc: "Partly cloudy", location: "Seattle" },
  { title: "Cloudy Night", condition: "Clouds", time: "night", phase: 2, coverage: "full", temp: 46, desc: "Overcast", location: "Portland" },
  { title: "Rain Clouds", condition: "Rain", time: "day", phase: 0, coverage: "full", temp: 50, desc: "Moderate rain", location: "Portland" },
  { title: "Night Rain", condition: "Rain", time: "night", phase: 2, coverage: "full", temp: 44, desc: "Heavy rain", location: "Portland" },
  { title: "Storm Clouds", condition: "Thunderstorm", time: "day", phase: "storm", coverage: "storm", temp: 68, desc: "Thunderstorm", location: "Dallas" },
  { title: "Night Storm", condition: "Thunderstorm", time: "night", phase: "storm", coverage: "storm", temp: 61, desc: "Thunderstorm with hail", location: "Dallas" },
  { title: "Snow", condition: "Snow", time: "day", phase: "day", coverage: "none", temp: 30, desc: "Slight snow", location: "Denver" },
  { title: "Heavy Snow", condition: "Snow", time: "day", phase: "day", coverage: "none", heavySnow: true, temp: 24, desc: "Heavy snow", location: "Denver" },
  { title: "Fog", condition: "Fog", time: "day", phase: "day", coverage: "none", temp: 52, desc: "Fog", location: "San Francisco" },
];

const FORECAST = [
  { day: "Today", high: 55, low: 42, precip: 20 },
  { day: "Tue", high: 58, low: 44, precip: 0 },
  { day: "Wed", high: 52, low: 39, precip: 45 },
  { day: "Thu", high: 61, low: 47, precip: 10 },
  { day: "Fri", high: 64, low: 51, precip: 0 },
];

function RainDrops() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 40 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-[1px] bg-white/20 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `-${Math.random() * 20}%`,
            height: `${12 + Math.random() * 18}px`,
            animation: `weather-rain-fall ${0.6 + Math.random() * 0.4}s linear infinite`,
            animationDelay: `${Math.random() * 2}s`,
          }}
        />
      ))}
    </div>
  );
}

function ClearSky({ phase }) {
  return <VolumetricCloudscape coverage="none" phase={phase} />;
}

function FogLayer() {
  return (
    <div className="weather-fog-layer absolute inset-0 overflow-hidden pointer-events-none" />
  );
}

function SnowFlakes({ heavy = false }) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${heavy ? "weather-heavy-snow" : ""}`}>
      {Array.from({ length: heavy ? 68 : 34 }).map((_, i) => {
        const size = `${2 + Math.random() * (heavy ? 5 : 3)}px`;

        return (
        <div
          key={i}
          className="absolute rounded-full bg-white/60"
          style={{
            left: `${Math.random() * 100}%`,
            top: `-${Math.random() * 10}%`,
            width: size,
            height: size,
            opacity: 0.42 + Math.random() * (heavy ? 0.5 : 0.34),
            animation: `weather-snow-fall ${heavy ? 1.9 : 3.2 + Math.random() * 3.4}s linear infinite`,
            animationDelay: `${Math.random() * (heavy ? 2.5 : 5)}s`,
          }}
        />
        );
      })}
    </div>
  );
}

function Stars() {
  return (
    <div className="weather-stars-layer absolute inset-0 z-[8] overflow-hidden pointer-events-none">
      {Array.from({ length: 220 }).map((_, i) => {
        const sizeValue = Math.random() < 0.78
          ? 0.38 + Math.random() * 0.62
          : 1 + Math.random() * 0.85;
        const size = `${sizeValue}px`;

        return (
        <div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 86}%`,
            width: size,
            height: size,
            opacity: 0.36 + Math.random() * 0.58,
            animation: `weather-star-twinkle ${2 + Math.random() * 3}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 3}s`,
          }}
        />
        );
      })}
    </div>
  );
}

function Lightning() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute inset-0 bg-white/0"
        style={{ animation: "weather-lightning 4s ease-in-out infinite" }}
      />
      <div
        className="absolute inset-0 bg-white/0"
        style={{ animation: "weather-lightning 7s ease-in-out infinite", animationDelay: "2s" }}
      />
    </div>
  );
}

function CloudLayers({ coverage = "full", phase = "day" }) {
  return <VolumetricCloudscape coverage={coverage} phase={phase} />;
}

function WeatherCard({ condition, time, phase, coverage, heavySnow, temp, desc, location }) {
  const gradient = CONDITION_GRADIENTS[condition]?.[time];
  const shaderColors = SHADER_COLORS[condition]?.[time];
  const darkText = time === "day" && condition !== "Thunderstorm" && condition !== "Rain" && condition !== "Drizzle";
  const textColor = darkText ? "text-slate-800" : "text-white";
  const textColorMuted = darkText ? "text-slate-600" : "text-white/70";
  const shaderOpacity = condition === "Clear" && time === "day" ? "opacity-[0.12]" : "opacity-[0.3]";
  const rangeMin = Math.min(...FORECAST.map((f) => f.low), ...FORECAST.map((f) => f.high));
  const rangeMax = Math.max(...FORECAST.map((f) => f.low), ...FORECAST.map((f) => f.high));
  const rangeSpan = Math.max(rangeMax - rangeMin, 1);

  return (
    <div className="weather-widget isolate flex aspect-[16/9] min-h-40 w-full flex-col overflow-hidden rounded-lg shadow-lg">
      {/* Top section */}
      <div className={`relative flex flex-1 flex-col justify-between bg-gradient-to-br ${gradient} p-4`}>
        {/* z-[1]: NeuroNoise texture blend */}
        <div className={`absolute inset-0 z-[1] ${shaderOpacity} mix-blend-soft-light pointer-events-none`}>
          <NeuroNoise
            colorFront={shaderColors[0]}
            colorMid={shaderColors[1]}
            colorBack={shaderColors[2]}
            speed={0.5}
            scale={1.5}
            brightness={0.7}
            contrast={0.5}
            style={{ width: "100%", height: "100%" }}
          />
        </div>

        {/* z-[2]: WebGL sky/cloud canvas */}
        {condition === "Clear" && (
          <div className="absolute inset-0 z-[2] pointer-events-none">
            <ClearSky phase={phase} />
          </div>
        )}
        {coverage !== "none" && condition !== "Snow" && (
          <div className="absolute inset-0 z-[2] pointer-events-none">
            <CloudLayers coverage={coverage} phase={phase || time} />
          </div>
        )}
        {condition === "Snow" && (
          <div className="absolute inset-0 z-[2] pointer-events-none">
            <CloudLayers coverage={heavySnow ? "storm" : "full"} phase={heavySnow ? "storm" : phase || time} />
          </div>
        )}

        {/* z-[5]: Particle/overlay effects above the WebGL canvas */}
        <div className="absolute inset-0 z-[5] overflow-hidden pointer-events-none">
          {condition === "Rain" && <RainDrops />}
          {condition === "Snow" && <SnowFlakes heavy={heavySnow} />}
          {condition === "Fog" && <FogLayer />}
          {condition === "Thunderstorm" && <><RainDrops /><Lightning /></>}
          {((condition === "Clear" && time === "night") || (condition === "Clouds" && time === "night" && coverage === "partly")) && <Stars />}
        </div>

        {/* Content */}
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-widest ${textColorMuted}`}>
              {location}
            </p>
            <p className={`mt-1 text-4xl font-bold tracking-tight ${textColor}`}>
              {temp}°
            </p>
          </div>
          <div className="text-right">
            <p className={`text-sm font-medium ${textColor}`}>{desc}</p>
            <p className={`mt-0.5 text-[10px] ${textColorMuted}`}>°F · Open-Meteo</p>
          </div>
        </div>
        <div />
      </div>

      {/* Bottom forecast */}
      <div className="weather-forecast flex items-center justify-between bg-black/90">
        {FORECAST.map((f) => {
          const rangeLeft = ((f.low - rangeMin) / rangeSpan) * 100;
          const rangeWidth = Math.max(((f.high - f.low) / rangeSpan) * 100, 8);

          return (
          <div key={f.day} className="weather-forecast-day flex min-w-0 flex-1 flex-col items-center">
            <span className="weather-forecast-name font-medium text-white/60">{f.day}</span>
            <div className="weather-range-track">
              <span
                className="weather-range-fill"
                style={{
                  left: `${rangeLeft}%`,
                  width: `${Math.min(rangeWidth, 100 - rangeLeft)}%`,
                }}
              />
            </div>
            <span className="weather-forecast-temp font-semibold text-white">
              <span>{f.high}°</span>
              <span className="weather-forecast-low">{f.low}°</span>
            </span>
            <span className="weather-forecast-precip text-blue-300">{f.precip > 0 ? `${f.precip}%` : ""}</span>
          </div>
          );
        })}
      </div>
    </div>
  );
}

export default function WeatherPreview() {
  return (
    <div className="min-h-screen overflow-auto bg-neutral-950 px-6 pb-10 pt-24 sm:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Weather Preview</h1>
          <p className="mt-1 text-sm text-white/55">Cloud coverage and color by condition and time of day.</p>
        </div>
        <div className="flex gap-2 text-[11px] font-medium uppercase tracking-wider text-white/45">
          <span>None</span>
          <span>Partly</span>
          <span>Full</span>
          <span>Storm</span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {PREVIEW_DATA.map((item, i) => (
          <div key={i}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-white/80">{item.title}</p>
              <p className="shrink-0 text-[11px] uppercase tracking-wider text-white/40">
                {typeof item.phase === "number" ? item.phase.toFixed(2) : item.phase} · {item.coverage}
              </p>
            </div>
            <WeatherCard {...item} />
          </div>
        ))}
      </div>
    </div>
  );
}
