// A day of weather as the day bar reads it: hourly samples from any source
// (OpenWeather's 3-hour forecast, Open-Meteo's hourly data, readings saved
// earlier today), and what the weather is at any moment between them.

export type Precip = "none" | "drizzle" | "rain" | "storm" | "snow" | "sleet";
export type Obscured = "none" | "fog" | "haze" | "smoke";

/** One reading or forecast point. */
export interface HourSample {
  /** The moment, in ms. */
  time: number;
  temp: number | null;
  /** Cloud cover, 0–1. */
  cloud: number;
  precip: Precip;
  /** Precipitation rate in mm/h (0 when none or unknown). */
  rate: number;
  /** Chance of the precipitation, 0–1 (1 for a reading). */
  chance: number;
  obscured: Obscured;
  /** Wind speed in m/s. */
  wind: number;
}

/** The weather at one moment. `known` is false where there's no data near it. */
export interface Conditions {
  temp: number | null;
  cloud: number;
  precip: Precip;
  /** How heavy the precipitation is, 0–1. */
  intensity: number;
  chance: number;
  obscured: Obscured;
  /** How thick the fog or haze is, 0–1. */
  obscuredAmount: number;
  /** Wind, 0 (calm) to 1 (a gale). */
  wind: number;
  known: boolean;
}

const HOUR = 3_600_000;
/** A point counts for this long either side of it; past that, the weather isn't known. */
const REACH = 3 * HOUR;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** mm/h to 0–1: drizzle ~0.3, light rain ~0.45, moderate ~0.7, heavy (10 mm/h+) 1. */
export function rateToIntensity(precip: Precip, rate: number): number {
  if (precip === "none") return 0;
  return clamp01(0.3 + (0.7 * Math.log1p(Math.max(0, rate))) / Math.log1p(10));
}

const PRECIP_RANK: Record<Precip, number> = { none: 0, drizzle: 1, rain: 2, sleet: 2, snow: 2, storm: 3 };

export const UNKNOWN: Conditions = {
  temp: null,
  cloud: 0,
  precip: "none",
  intensity: 0,
  chance: 0,
  obscured: "none",
  obscuredAmount: 0,
  wind: 0,
  known: false,
};

function conditionsOf(sample: HourSample): Conditions {
  return {
    temp: sample.temp,
    cloud: sample.cloud,
    precip: sample.precip,
    intensity: rateToIntensity(sample.precip, sample.rate),
    chance: sample.precip === "none" ? 0 : sample.chance,
    obscured: sample.obscured,
    obscuredAmount: sample.obscured === "none" ? 0 : 1,
    wind: clamp01(sample.wind / 17),
    known: true,
  };
}

/**
 * The weather at `time`, eased between the samples either side. Rain and
 * fog fade in and out across the gap rather than switching on, so a shower
 * in one 3-hour slot reads as a shower, not a block.
 */
export function conditionsAt(samples: HourSample[], time: number): Conditions {
  let prev: HourSample | null = null;
  let next: HourSample | null = null;
  for (const sample of samples) {
    if (sample.time <= time && (!prev || sample.time > prev.time)) prev = sample;
    if (sample.time >= time && (!next || sample.time < next.time)) next = sample;
  }
  if (prev && time - prev.time > REACH) prev = null;
  if (next && next.time - time > REACH) next = null;
  if (!prev && !next) return UNKNOWN;
  if (!prev || !next || prev === next) return conditionsOf((prev ?? next)!);

  const t = (time - prev.time) / (next.time - prev.time);
  const a = conditionsOf(prev);
  const b = conditionsOf(next);
  const precip = PRECIP_RANK[b.precip] > PRECIP_RANK[a.precip] ? b.precip : a.precip;
  const obscured = b.obscured !== "none" && a.obscured === "none" ? b.obscured : a.obscured !== "none" ? a.obscured : b.obscured;
  return {
    temp: a.temp != null && b.temp != null ? lerp(a.temp, b.temp, t) : a.temp ?? b.temp,
    cloud: lerp(a.cloud, b.cloud, t),
    precip,
    intensity: lerp(a.intensity, b.intensity, t),
    chance: lerp(a.chance, b.chance, t),
    obscured,
    obscuredAmount: lerp(a.obscuredAmount, b.obscuredAmount, t),
    wind: lerp(a.wind, b.wind, t),
    known: true,
  };
}

// ---- the day ---------------------------------------------------------------

/** Local midnight at the start of the day containing `time`. */
export function startOfDay(time: number): number {
  const d = new Date(time);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** The next local midnight (23 or 25 hours on a clock change). */
export function endOfDay(dayStart: number): number {
  const d = new Date(dayStart);
  d.setDate(d.getDate() + 1);
  return d.getTime();
}

/** The day's high and low from its samples, or null without any. */
export function highLow(samples: HourSample[], dayStart: number): { high: number; low: number } | null {
  const end = endOfDay(dayStart);
  const temps = samples.filter((s) => s.time >= dayStart && s.time <= end && s.temp != null).map((s) => s.temp!);
  return temps.length ? { high: Math.max(...temps), low: Math.min(...temps) } : null;
}

// ---- in words ----------------------------------------------------------------

const PRECIP_WORD: Record<Exclude<Precip, "none">, string> = {
  drizzle: "Drizzle",
  rain: "Rain",
  storm: "Storms",
  snow: "Snow",
  sleet: "Sleet",
};

const OBSCURED_WORD: Record<Exclude<Obscured, "none">, string> = { fog: "Fog", haze: "Haze", smoke: "Smoke" };

/** A short name for the weather at a moment ("Sunny", "Partly cloudy", "Rain"…). */
export function describe(conditions: Conditions, daylight: boolean): string {
  if (!conditions.known) return "No forecast";
  if (conditions.precip !== "none" && conditions.chance >= 0.3 && conditions.intensity > 0.2) return PRECIP_WORD[conditions.precip];
  if (conditions.obscured !== "none" && conditions.obscuredAmount >= 0.5) return OBSCURED_WORD[conditions.obscured];
  if (conditions.cloud >= 0.85) return "Overcast";
  if (conditions.cloud >= 0.55) return "Mostly cloudy";
  if (conditions.cloud >= 0.25) return "Partly cloudy";
  return daylight ? "Sunny" : "Clear";
}

const isWet = (label: string) => Object.values(PRECIP_WORD).includes(label);

/** "7 PM", to the nearest hour, for headlines. */
export function hourLabel(time: number): string {
  return new Date(Math.round(time / HOUR) * HOUR).toLocaleTimeString([], { hour: "numeric" });
}

/** "6–10 PM", or "11 AM–2 PM" across noon. */
export function rangeLabel(start: number, end: number): string {
  const from = hourLabel(start);
  const to = hourLabel(end);
  const meridiem = (label: string) => label.match(/\s?[AP]M$/i)?.[0];
  const shared = meridiem(from);
  return shared && shared === meridiem(to) ? `${from.slice(0, -shared.length)}–${to}` : `${from}–${to}`;
}

/** How clear a sky label is, clearest first: "until" when it clears, "from" when it clouds over. */
const CLEARNESS = ["Sunny", "Clear", "Partly cloudy", "Mostly cloudy", "Overcast", "Haze", "Smoke", "Fog"];
/** A later condition, mid-sentence. */
const LATER: Record<string, string> = { "Partly cloudy": "some cloud", "Mostly cloudy": "cloudy", Overcast: "overcast", Sunny: "sunny", Clear: "clear" };

interface Run {
  label: string;
  start: number;
  end: number;
  chance: number;
}

/**
 * The day as runs of one condition, sampled every 30 minutes. Stretches
 * under an hour (the in-between of easing from one sample to the next)
 * join the run after them, unless it's rain. With `splitDayNight`, "Sunny"
 * and "Clear" are separate runs; without, a clear run is named for its middle.
 */
export function runsOf(samples: HourSample[], from: number, to: number, isDaylight: (time: number) => boolean, splitDayNight = false): Run[] {
  let runs: Run[] = [];
  const push = (run: Run) => {
    const last = runs[runs.length - 1];
    if (last && last.label === run.label) {
      last.end = run.end;
      last.chance = Math.max(last.chance, run.chance);
    } else runs.push({ ...run });
  };
  for (let time = from; time < to; time += HOUR / 2) {
    const conditions = conditionsAt(samples, time);
    push({ label: describe(conditions, splitDayNight ? isDaylight(time) : true), start: time, end: Math.min(to, time + HOUR / 2), chance: conditions.chance });
  }

  const short = (run: Run) => run.end - run.start < HOUR && !isWet(run.label);
  while (runs.length > 1 && runs.some(short)) {
    const index = runs.findIndex(short);
    const merged = runs.slice();
    if (index < merged.length - 1) merged[index + 1] = { ...merged[index + 1], start: merged[index].start };
    else merged[index - 1] = { ...merged[index - 1], end: merged[index].end };
    merged.splice(index, 1);
    runs = [];
    merged.forEach(push);
  }

  if (splitDayNight) return runs;
  // "Sunny" at night reads "Clear".
  return runs.map((run) => (run.label === "Sunny" && !isDaylight((run.start + run.end) / 2) ? { ...run, label: "Clear" } : run));
}

/**
 * One line about the day, leading with what matters next: rain coming or
 * going, then a change in the sky, else how it stays. `now` is null for a
 * day other than today.
 */
export function headline(samples: HourSample[], dayStart: number, now: number | null, isDaylight: (time: number) => boolean): string {
  const dayEnd = endOfDay(dayStart);
  const from = now != null ? Math.max(dayStart, Math.floor(now / (HOUR / 2)) * (HOUR / 2)) : dayStart;
  const runs = runsOf(samples, from, dayEnd, isDaylight).filter((run) => run.label !== "No forecast");
  if (!runs.length) return "No forecast";
  const untilEnd = (run: Run) => run.end >= dayEnd;
  const span = (run: Run) => rangeLabel(run.start, run.end);
  const tonight = now != null && !isDaylight(now);

  const wet = runs.find((run) => isWet(run.label));
  if (wet) {
    const word = wet.label;
    if (wet === runs[0] && now != null) {
      const lead = wet.chance >= 0.6 ? word : `Chance of ${word.toLowerCase()}`;
      return untilEnd(wet) ? `${lead} through ${tonight ? "tonight" : "the day"}` : `${lead} until ${hourLabel(wet.end)}`;
    }
    if (wet === runs[0] && untilEnd(wet)) return `${word} all day`;
    if (untilEnd(wet)) return `${wet.chance >= 0.6 ? word : `Chance of ${word.toLowerCase()}`} from ${hourLabel(wet.start)}`;
    return wet.chance >= 0.6 ? `${word} likely ${span(wet)}` : `Chance of ${word.toLowerCase()} ${span(wet)}`;
  }

  const first = runs[0];
  if (runs.length === 1) {
    if (now == null) return first.label === "Sunny" ? "Sunny all day" : `${first.label} all day`;
    return `${first.label} ${tonight ? "tonight" : "the rest of the day"}`;
  }
  const next = runs[1];
  // Clearing up: "Fog until 10 AM". Clouding over: "Sunny, cloudy from 3 PM".
  if (CLEARNESS.indexOf(next.label) < CLEARNESS.indexOf(first.label)) return `${first.label} until ${hourLabel(first.end)}`;
  return `${first.label}, ${LATER[next.label] ?? next.label.toLowerCase()} from ${hourLabel(next.start)}`;
}

/** The whole day in a sentence, for screen readers and the tooltip. */
export function summary(samples: HourSample[], dayStart: number, isDaylight: (time: number) => boolean): string {
  const runs = runsOf(samples, dayStart, endOfDay(dayStart), isDaylight, true);
  return runs
    .map((run, index) => {
      const label = index === 0 ? run.label : run.label.toLowerCase();
      if (index === runs.length - 1) return `${label} ${index === 0 ? "all day" : `from ${hourLabel(run.start)}`}`;
      return `${label} until ${hourLabel(run.end)}`;
    })
    .join(", ")
    .concat(".");
}

/** One moment on the bar, in words: for hovering along it. */
export interface Moment {
  /** "3 PM", "3:15 PM": to the nearest quarter hour. */
  time: string;
  /** "Partly cloudy", "Rain"… */
  label: string;
  temp: number | null;
  /** The chance of rain or snow, else the wind if it's strong: "60% rain", "24 mph wind". */
  detail: string | null;
}

export function momentAt(samples: HourSample[], time: number, isDaylight: (time: number) => boolean, unit: string): Moment {
  const conditions = conditionsAt(samples, time);
  const quarter = 15 * 60_000;
  const rounded = new Date(Math.round(time / quarter) * quarter);
  const label = rounded.getMinutes() === 0 ? rounded.toLocaleTimeString([], { hour: "numeric" }) : rounded.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  let detail: string | null = null;
  if (conditions.precip !== "none" && conditions.intensity > 0.2 && conditions.chance >= 0.1) {
    detail = `${Math.round(conditions.chance * 100)}% ${PRECIP_WORD[conditions.precip].toLowerCase()}`;
  } else if (conditions.wind >= 0.45) {
    const metersPerSecond = conditions.wind * 17;
    detail = unit === "C" ? `${Math.round(metersPerSecond * 3.6)} km/h wind` : `${Math.round(metersPerSecond * 2.237)} mph wind`;
  }
  return { time: label, label: describe(conditions, isDaylight(time)), temp: conditions.temp, detail };
}
