import { describe, expect, it } from "vitest";
import {
  formatHourLabel,
  formatWeatherDescription,
  getCloudCoverRange,
  getCloudFraction,
  getConditionCategory,
  getEffectiveWind,
  getOpenWeatherCondition,
  getOpenWeatherCoverage,
  getOpenWeatherVisualProfile,
  resolveWeather,
} from "./utils";
import type { WeatherData } from "./types/weather";

describe("getConditionCategory", () => {
  it("passes through a recognized condition", () => {
    expect(getConditionCategory("Rain")).toBe("Rain");
  });

  it("falls back to Clouds for an unrecognized condition string", () => {
    expect(getConditionCategory("Tornado")).toBe("Clouds");
  });
});

describe("getOpenWeatherCondition", () => {
  it("maps OpenWeather condition id ranges to a category", () => {
    expect(getOpenWeatherCondition(211, "")).toBe("Thunderstorm");
    expect(getOpenWeatherCondition(301, "")).toBe("Drizzle");
    expect(getOpenWeatherCondition(501, "")).toBe("Rain");
    expect(getOpenWeatherCondition(601, "")).toBe("Snow");
    expect(getOpenWeatherCondition(741, "")).toBe("Fog");
    expect(getOpenWeatherCondition(800, "")).toBe("Clear");
    expect(getOpenWeatherCondition(803, "")).toBe("Clouds");
  });

  it("falls back to the weatherMain category for an id below every known range (< 200)", () => {
    // Every id >= 200 is covered by a range or the >800/===800 checks, so only
    // ids under 200 (unmapped) actually reach the weatherMain fallback.
    expect(getOpenWeatherCondition(100, "Rain")).toBe("Rain");
    expect(getOpenWeatherCondition(0, "Snow")).toBe("Snow");
  });
});

describe("getOpenWeatherCoverage", () => {
  it("maps thunderstorm and drizzle ids to storm/full", () => {
    expect(getOpenWeatherCoverage(211)).toBe("storm");
    expect(getOpenWeatherCoverage(301)).toBe("full");
  });

  it("distinguishes heavy rain (storm) from light rain (full)", () => {
    expect(getOpenWeatherCoverage(500)).toBe("full");
    expect(getOpenWeatherCoverage(504)).toBe("storm");
  });

  it("maps clear sky to none and scattered/broken clouds to partly/full", () => {
    expect(getOpenWeatherCoverage(800)).toBe("none");
    expect(getOpenWeatherCoverage(802)).toBe("partly");
    expect(getOpenWeatherCoverage(804)).toBe("full");
  });

  it("defaults to none for an unmapped id", () => {
    expect(getOpenWeatherCoverage(1)).toBe("none");
  });
});

describe("getCloudCoverRange / getCloudFraction", () => {
  it("returns the documented plausible range for the canonical cloud ids", () => {
    expect(getCloudCoverRange(800)).toEqual([0, 0.08]);
    expect(getCloudCoverRange(804)).toEqual([0.85, 1]);
  });

  it("clamps a reported percentage into the condition's plausible range", () => {
    // 804 (overcast) implies 85-100% regardless of a stray low reported value.
    expect(getCloudFraction(804, 10)).toBe(0.85);
    expect(getCloudFraction(804, 95)).toBeCloseTo(0.95);
  });

  it("uses the range midpoint when no percentage is reported", () => {
    expect(getCloudFraction(800, null)).toBeCloseTo(0.04);
  });

  it("falls back to the reported percentage alone (0-1) when there's no weatherId", () => {
    expect(getCloudFraction(undefined, 50)).toBeCloseTo(0.5);
    expect(getCloudFraction(undefined, undefined)).toBeCloseTo(0.5); // documented default of 50%
  });
});

describe("getEffectiveWind", () => {
  const visual = getOpenWeatherVisualProfile(800); // windIntensity 0.1

  it("falls back to the visual profile's own wind when no speed is reported", () => {
    expect(getEffectiveWind(visual, undefined, "metric")).toBeCloseTo(Math.max(visual.windIntensity, 0.04));
  });

  it("converts imperial (mph) wind speed before scaling", () => {
    const metric = getEffectiveWind(visual, 20, "metric"); // 20 m/s
    const imperial = getEffectiveWind(visual, 20 / 0.44704, "imperial"); // same real speed in mph
    expect(imperial).toBeCloseTo(metric, 5);
  });

  it("clamps into [0.04, 1]", () => {
    expect(getEffectiveWind(visual, 0, "metric")).toBeGreaterThanOrEqual(0.04);
    expect(getEffectiveWind(visual, 1000, "metric")).toBeLessThanOrEqual(1);
  });
});

describe("formatWeatherDescription", () => {
  it("capitalizes the first letter", () => {
    expect(formatWeatherDescription("light rain")).toBe("Light rain");
  });

  it("falls back to a generic label when no description is given", () => {
    expect(formatWeatherDescription(undefined)).toBe("Current conditions");
    expect(formatWeatherDescription("")).toBe("Current conditions");
  });
});

describe("formatHourLabel", () => {
  it("formats a valid ISO time and returns empty string for an invalid one", () => {
    expect(formatHourLabel("2024-06-15T14:00:00.000Z")).not.toBe("");
    expect(formatHourLabel("not-a-date")).toBe("");
  });
});

describe("resolveWeather (integration)", () => {
  function makeData(overrides: Partial<WeatherData> = {}): WeatherData {
    return {
      source: "OpenWeather",
      unit: "imperial",
      current: { temperature_2m: 72, cloud_cover: 10, wind_speed: 5 },
      daily: {
        time: ["2024-06-15"],
        temperature_2m_max: [80],
        temperature_2m_min: [60],
        precipitation_probability_max: [0],
        weather_code: [800],
        description: ["Clear sky"],
        sunrise: ["2024-06-15T06:00:00.000Z"],
        sunset: ["2024-06-15T20:00:00.000Z"],
      },
      hourly: { time: [] },
      openWeather: { id: 800, weather: "Clear", description: "clear sky", temperature: 72 },
      ...overrides,
    };
  }

  it("resolves a clear midday sky as daytime with the Clear condition", () => {
    const noon = new Date("2024-06-15T12:00:00.000Z").getTime();
    const resolved = resolveWeather(makeData(), noon);
    expect(resolved.condition).toBe("Clear");
    expect(resolved.dayTime).toBe(true);
    expect(resolved.coverage).toBe("none");
    expect(resolved.temperature).toBe(72);
  });

  it("resolves the same data at night as not-daytime", () => {
    const midnight = new Date("2024-06-15T23:30:00.000Z").getTime();
    const resolved = resolveWeather(makeData(), midnight);
    expect(resolved.dayTime).toBe(false);
  });

  it("builds one forecastDay per daily entry with rounded highs/lows", () => {
    const noon = new Date("2024-06-15T12:00:00.000Z").getTime();
    const resolved = resolveWeather(makeData(), noon);
    expect(resolved.forecastDays).toHaveLength(1);
    expect(resolved.forecastDays[0]).toMatchObject({ dayName: "Today", high: 80, low: 60, condition: "Clear" });
  });

  it("derives rangeMin/rangeMax/rangeSpan from the forecast's highs and lows", () => {
    const noon = new Date("2024-06-15T12:00:00.000Z").getTime();
    const resolved = resolveWeather(
      makeData({
        daily: {
          time: ["2024-06-15", "2024-06-16"],
          temperature_2m_max: [80, 90],
          temperature_2m_min: [60, 50],
          precipitation_probability_max: [0, 0],
          weather_code: [800, 800],
          description: ["", ""],
          sunrise: ["2024-06-15T06:00:00.000Z", "2024-06-16T06:00:00.000Z"],
          sunset: ["2024-06-15T20:00:00.000Z", "2024-06-16T20:00:00.000Z"],
        },
      }),
      noon,
    );
    expect(resolved.rangeMin).toBe(50);
    expect(resolved.rangeMax).toBe(90);
    expect(resolved.rangeSpan).toBe(40);
  });

  it("falls back to a generic overcast profile when there's no OpenWeather payload", () => {
    const noon = new Date("2024-06-15T12:00:00.000Z").getTime();
    const resolved = resolveWeather(makeData({ openWeather: undefined }), noon);
    expect(resolved.coverage).toBe("none"); // no `ow` -> coverage falls back to "none" per resolveWeather
    expect(resolved.description).toBe("Current conditions");
  });
});
