import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import WeatherFrostedCard from "./WeatherFrostedCard";
import { localIsoTime } from "@/features/weather/hooks/useWeatherData";
import type { WeatherData } from "@/features/weather/types/weather";
import { historyKey, rememberSamples, samplesFromOpenMeteo, samplesFromOpenWeather, withHistory } from "@/features/weather/dayBar/sources";

// jsdom has no ResizeObserver; the bar only uses it to size its canvases.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const HOUR = 3_600_000;
const now = new Date(2026, 9, 29, 20, 0).getTime();

function openWeather(): WeatherData {
  const times = [1, 4, 7, 10].map((h) => now + h * HOUR);
  return {
    source: "OpenWeather",
    unit: "imperial",
    current: { time: localIsoTime(now), temperature_2m: 58, weather_code: 800, is_day: 0, wind_speed: 10, cloud_cover: 0 },
    daily: { time: ["2026-10-29"] },
    hourly: {
      time: times.map(localIsoTime),
      temperature_2m: [56, 53, 51, 50],
      weather_code: [802, 501, 500, 804],
      precipitation: [0, 6, 1.5, 0],
      precipitation_probability: [0, 80, 40, 0],
      wind_speed_10m: [10, 12, 8, 6],
      cloud_cover: [40, 100, 90, NaN],
    },
  };
}

describe("samples from OpenWeather", () => {
  it("reads the reading and the 3-hourly forecast: cloud, rain per hour, chance, wind in m/s", () => {
    const samples = samplesFromOpenWeather(openWeather());
    expect(samples).toHaveLength(5);
    expect(samples[0]).toMatchObject({ time: now, temp: 58, cloud: 0, precip: "none", chance: 0 });
    expect(samples[0].wind).toBeCloseTo(4.47, 1);
    expect(samples[2]).toMatchObject({ precip: "rain", rate: 2, chance: 0.8, cloud: 1 });
    // No cloud amount: the condition stands in (804 is overcast).
    expect(samples[4].cloud).toBe(1);
  });
});

describe("samples from Open-Meteo", () => {
  it("maps WMO codes, and treats past rain as certain", () => {
    const samples = samplesFromOpenMeteo(
      {
        time: [now / 1000 - 3600, now / 1000 + 3600, now / 1000 + 7200],
        temperature_2m: [55, 54, 53],
        weather_code: [61, 95, 45],
        cloud_cover: [100, 100, 80],
        precipitation: [1.2, 4, 0],
        precipitation_probability: [30, 70, 0],
        wind_speed_10m: [3, 9, 1],
      },
      now,
    );
    expect(samples.map((s) => s.precip)).toEqual(["rain", "storm", "none"]);
    expect(samples[0].chance).toBe(1);
    expect(samples[1].chance).toBe(0.7);
    expect(samples[2].obscured).toBe("fog");
  });
});

describe("today's history", () => {
  beforeEach(() => localStorage.clear());

  it("fills hours before the fresh forecast with what an earlier one said, latest word winning", () => {
    const key = historyKey(41.88, -87.63, "imperial");
    const base = { cloud: 0, precip: "none" as const, rate: 0, chance: 0, obscured: "none" as const, wind: 2 };
    rememberSamples(key, [{ ...base, time: now - 6 * HOUR, temp: 40 }, { ...base, time: now - 3 * HOUR, temp: 45 }], now - 6 * HOUR);
    rememberSamples(key, [{ ...base, time: now - 3 * HOUR, temp: 47 }], now - 3 * HOUR);
    const merged = withHistory(key, [{ ...base, time: now, temp: 58 }]);
    expect(merged.map((s) => s.temp)).toEqual([40, 47, 58]);
  });

  it("forgets other places once they're old", () => {
    const base = { cloud: 0, precip: "none" as const, rate: 0, chance: 0, obscured: "none" as const, wind: 2, temp: 50 };
    rememberSamples("old", [{ ...base, time: now - 40 * HOUR }], now - 40 * HOUR);
    rememberSamples("new", [{ ...base, time: now }], now);
    expect(Object.keys(JSON.parse(localStorage.getItem("startup-page.weather-history")!))).toEqual(["new"]);
  });
});

describe("WeatherFrostedCard", () => {
  it("draws the day from fixed data, leading with the rain to come", () => {
    render(<WeatherFrostedCard data={openWeather()} clockTime={now} />);
    expect(document.querySelector(".day-card-headline")?.textContent).toMatch(/^Rain /);
    expect(screen.getByRole("slider")).toBeTruthy();
  });
});
