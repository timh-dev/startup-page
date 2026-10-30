import type { Conditions } from "./timeline";

// The conditions the day bar has to tell apart, as typical cases. Shared by
// the colour checks (palette.test.ts) and the dev gallery.

const base: Conditions = {
  temp: 60,
  cloud: 0,
  precip: "none",
  intensity: 0,
  chance: 0,
  obscured: "none",
  obscuredAmount: 0,
  wind: 0.15,
  known: true,
};

export const CONDITION_CASES: Array<{ id: string; label: string; conditions: Conditions }> = [
  { id: "clear", label: "Clear", conditions: base },
  { id: "partly", label: "Partly cloudy", conditions: { ...base, cloud: 0.45 } },
  { id: "mostly", label: "Mostly cloudy", conditions: { ...base, cloud: 0.75 } },
  { id: "overcast", label: "Overcast", conditions: { ...base, cloud: 1 } },
  { id: "fog", label: "Fog", conditions: { ...base, cloud: 0.6, obscured: "fog", obscuredAmount: 1 } },
  { id: "haze", label: "Haze", conditions: { ...base, cloud: 0.1, obscured: "haze", obscuredAmount: 1 } },
  { id: "drizzle", label: "Drizzle", conditions: { ...base, cloud: 1, precip: "drizzle", intensity: 0.35, chance: 0.9 } },
  { id: "rain", label: "Rain", conditions: { ...base, cloud: 1, precip: "rain", intensity: 0.7, chance: 0.95 } },
  { id: "rain-chance", label: "30% chance of rain", conditions: { ...base, cloud: 0.8, precip: "rain", intensity: 0.5, chance: 0.3 } },
  { id: "storm", label: "Thunderstorms", conditions: { ...base, cloud: 1, precip: "storm", intensity: 0.9, chance: 0.9, wind: 0.6 } },
  { id: "snow", label: "Snow", conditions: { ...base, cloud: 1, precip: "snow", intensity: 0.6, chance: 0.9 } },
  { id: "sleet", label: "Sleet", conditions: { ...base, cloud: 1, precip: "sleet", intensity: 0.5, chance: 0.9 } },
  { id: "windy", label: "Clear and windy", conditions: { ...base, wind: 0.8 } },
];

/** Sun heights to judge each condition at: day, golden hour, sunset, blue hour, night. */
export const PHASES: Array<{ id: string; label: string; elevation: number }> = [
  { id: "day", label: "Day", elevation: 40 },
  { id: "golden", label: "Golden hour", elevation: 3 },
  { id: "sunset", label: "Sunset", elevation: -1.5 },
  { id: "blue", label: "Blue hour", elevation: -6 },
  { id: "night", label: "Night", elevation: -30 },
];

/**
 * Pairs that must look different at every phase: conditions someone could
 * act differently on. (Rain against a 30% chance of it is meant to be
 * close: the chance shows in the texture, patchy rather than solid.)
 */
export const MUST_DIFFER: Array<[string, string]> = [
  ["clear", "rain"],
  ["clear", "overcast"],
  ["clear", "snow"],
  ["overcast", "rain"],
  ["overcast", "fog"],
  ["overcast", "snow"],
  ["overcast", "drizzle"],
  ["drizzle", "rain"],
  ["rain", "storm"],
  ["rain", "snow"],
  ["fog", "snow"],
  ["partly", "overcast"],
];
