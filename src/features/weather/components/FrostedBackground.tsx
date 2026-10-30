import React from "react";

// The frosted weather card's moving backdrop under its glass: a sun glow,
// drifting cloud, gusts, rain or snow, or a clear night sky.

export type FrostedCategory = "sunny" | "cloudy" | "windy" | "rainy" | "snowy";

// Deterministic (index-based, not Math.random()) so first render is stable —
// same technique the source design's own generator script used.
function makeDrops(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    left: `${(3 + (i * 4.7) % 95).toFixed(1)}%`,
    delay: `${(-(i * 0.13) % 1.6).toFixed(2)}s`,
    duration: `${(1.5 + ((i * 7) % 5) * 0.14).toFixed(2)}s`,
  }));
}

function makeFlakes(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    left: `${(3 + (i * 6.1) % 94).toFixed(1)}%`,
    delay: `${(-(i * 0.6) % 8).toFixed(2)}s`,
    duration: `${(9 + ((i * 3) % 5) * 1.1).toFixed(2)}s`,
  }));
}

function makeGusts() {
  return [10, 30, 48, 66, 84].map((top, i) => ({
    top: `${top}%`,
    delay: `${(-(i * 0.85)).toFixed(2)}s`,
    duration: `${(2.8 + i * 0.4).toFixed(2)}s`,
  }));
}

const DROPS = makeDrops(22);
const FLAKES = makeFlakes(18);
const GUSTS = makeGusts();

export function FrostedBackground({ category, night }: { category: FrostedCategory; night: boolean }): React.ReactElement {
  if (category === "sunny" && night) {
    return (
      <>
        <div className="weather-v2-bg-base weather-v2-bg-night-base" />
        <div className="weather-v2-bg-night-stars" />
        <div className="weather-v2-bg-night-moon" />
      </>
    );
  }

  if (category === "sunny") {
    return (
      <>
        <div className="weather-v2-bg-base weather-v2-bg-sunny-base" />
        <div className="weather-v2-bg-sunny-wash" />
        <div className="weather-v2-bg-sunny-glow-outer" />
        <div className="weather-v2-bg-sunny-glow-core" />
      </>
    );
  }

  if (category === "cloudy") {
    return (
      <>
        <div className="weather-v2-bg-base weather-v2-bg-cloudy-base" />
        <div className="weather-v2-bg-cloudy-drift weather-v2-bg-cloudy-drift-a" />
        <div className="weather-v2-bg-cloudy-drift weather-v2-bg-cloudy-drift-b" />
      </>
    );
  }

  if (category === "windy") {
    return (
      <>
        <div className="weather-v2-bg-base weather-v2-bg-windy-base" />
        {GUSTS.map((gust, index) => (
          <span
            key={index}
            className="weather-v2-gust"
            style={{ top: gust.top, animationDelay: gust.delay, animationDuration: gust.duration }}
          />
        ))}
      </>
    );
  }

  if (category === "rainy") {
    return (
      <>
        <div className="weather-v2-bg-base weather-v2-bg-rainy-base" />
        {DROPS.map((drop, index) => (
          <span
            key={index}
            className="weather-v2-raindrop"
            style={{ left: drop.left, animationDelay: drop.delay, animationDuration: drop.duration }}
          />
        ))}
      </>
    );
  }

  return (
    <>
      <div className="weather-v2-bg-base weather-v2-bg-snowy-base" />
      {FLAKES.map((flake, index) => (
        <span
          key={index}
          className="weather-v2-snowflake"
          style={{ left: flake.left, animationDelay: flake.delay, animationDuration: flake.duration }}
        />
      ))}
    </>
  );
}
