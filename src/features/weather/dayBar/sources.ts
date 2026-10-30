import type { WeatherData } from "@/features/weather/types/weather";
import type { HourSample, Obscured, Precip } from "./timeline";

// Turning each weather source into the day bar's hourly samples.

// ---- OpenWeather -------------------------------------------------------------

/** OpenWeather condition ids (https://openweathermap.org/weather-conditions) to precipitation. */
export function owPrecip(id: number): Precip {
  if (id >= 200 && id < 300) return "storm";
  if (id >= 300 && id < 400) return "drizzle";
  if (id === 511 || (id >= 611 && id <= 616)) return "sleet";
  if (id >= 500 && id < 600) return "rain";
  if (id >= 600 && id < 700) return "snow";
  return "none";
}

export function owObscured(id: number): Obscured {
  if (id === 701 || id === 741) return "fog";
  if (id === 711 || id === 762) return "smoke";
  if (id >= 700 && id < 800) return "haze";
  return "none";
}

/** Cloud cover implied by a condition, for when the amount itself is missing. */
function owCloud(id: number): number {
  if (id === 800) return 0;
  if (id === 801) return 0.2;
  if (id === 802) return 0.45;
  if (id === 803) return 0.75;
  if (id >= 200 && id < 800) return id >= 700 ? 0.5 : 1;
  return 1;
}

/** Wind in the data's unit (mph imperial, m/s metric) to m/s. */
const toMetersPerSecond = (speed: number, unit: string) => (unit === "imperial" ? speed * 0.44704 : speed);

/**
 * The 3-hourly forecast and the latest reading as samples. Rain amounts
 * come per 3 hours, so they're spread over them.
 */
export function samplesFromOpenWeather(data: WeatherData): HourSample[] {
  const hourly = data.hourly ?? {};
  const times = hourly.time ?? [];
  const samples: HourSample[] = times.map((time, i) => {
    const id = hourly.weather_code?.[i] ?? 800;
    const cloud = hourly.cloud_cover?.[i];
    const precip = owPrecip(id);
    return {
      time: new Date(time).getTime(),
      temp: hourly.temperature_2m?.[i] ?? null,
      cloud: cloud != null && Number.isFinite(cloud) ? cloud / 100 : owCloud(id),
      precip,
      rate: precip === "none" ? 0 : (hourly.precipitation?.[i] ?? 0) / 3,
      chance: precip === "none" ? 0 : (hourly.precipitation_probability?.[i] ?? 100) / 100,
      obscured: owObscured(id),
      wind: toMetersPerSecond(hourly.wind_speed_10m?.[i] ?? 0, data.unit),
    };
  });

  const current = data.current;
  if (current?.time && current.temperature_2m != null) {
    const id = current.weather_code ?? 800;
    const precip = owPrecip(id);
    samples.push({
      time: new Date(current.time).getTime(),
      temp: current.temperature_2m,
      cloud: current.cloud_cover != null ? current.cloud_cover / 100 : owCloud(id),
      precip,
      rate: precip === "none" ? 0 : Math.max(current.precipitation_1h ?? 0, 0.5),
      chance: precip === "none" ? 0 : 1,
      obscured: owObscured(id),
      wind: toMetersPerSecond(current.wind_speed ?? 0, data.unit),
    });
  }
  return samples.filter((sample) => Number.isFinite(sample.time)).sort((a, b) => a.time - b.time);
}

// ---- Open-Meteo ----------------------------------------------------------------

/** WMO weather codes (as Open-Meteo sends them) to precipitation. */
export function wmoPrecip(code: number): Precip {
  if (code >= 95) return "storm";
  if (code === 56 || code === 57 || code === 66 || code === 67) return "sleet";
  if (code >= 51 && code <= 55) return "drizzle";
  if ((code >= 61 && code <= 65) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  return "none";
}

export interface OpenMeteoHourly {
  time: number[];
  temperature_2m: Array<number | null>;
  weather_code: Array<number | null>;
  cloud_cover: Array<number | null>;
  precipitation: Array<number | null>;
  precipitation_probability: Array<number | null>;
  wind_speed_10m: Array<number | null>;
}

/** Open-Meteo's hourly data (unix-second times, wind in m/s) as samples. */
export function samplesFromOpenMeteo(hourly: OpenMeteoHourly, now: number): HourSample[] {
  return hourly.time.map((seconds, i) => {
    const time = seconds * 1000;
    const code = hourly.weather_code[i] ?? 0;
    const precip = wmoPrecip(code);
    // Hours already past happened: their chance is a certainty.
    const chance = precip === "none" ? 0 : time <= now ? 1 : (hourly.precipitation_probability[i] ?? 100) / 100;
    return {
      time,
      temp: hourly.temperature_2m[i],
      cloud: (hourly.cloud_cover[i] ?? 0) / 100,
      precip,
      rate: hourly.precipitation[i] ?? 0,
      chance,
      obscured: code === 45 || code === 48 ? "fog" : "none",
      wind: hourly.wind_speed_10m[i] ?? 0,
    };
  });
}

// ---- today's history -----------------------------------------------------------

const HISTORY_KEY = "startup-page.weather-history";
/** Long enough to cover today from midnight, whenever it's read. */
const KEEP_MS = 30 * 3_600_000;

type History = Record<string, HourSample[]>;

function readHistory(): History {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Remembers what a source said, so hours already past still have weather
 * after the forecast has moved on (OpenWeather's free forecast only looks
 * ahead). The latest word on each moment wins. Kept per place and unit, for
 * a day and a bit.
 */
export function rememberSamples(key: string, samples: HourSample[], now: number) {
  const history = readHistory();
  const byTime = new Map((history[key] ?? []).map((sample) => [sample.time, sample]));
  for (const sample of samples) byTime.set(sample.time, sample);
  history[key] = [...byTime.values()].filter((sample) => sample.time >= now - KEEP_MS).sort((a, b) => a.time - b.time);
  for (const other of Object.keys(history)) {
    if (!history[other].some((sample) => sample.time >= now - KEEP_MS)) delete history[other];
  }
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Storage full or private mode: the past just stays unknown.
  }
}

/** The fresh samples, with remembered ones filling the time before them. */
export function withHistory(key: string, fresh: HourSample[]): HourSample[] {
  const earliest = fresh.length ? fresh[0].time : Infinity;
  const earlier = (readHistory()[key] ?? []).filter((sample) => sample.time < earliest);
  return [...earlier, ...fresh];
}

/** The history's key for a place and unit. */
export function historyKey(latitude: number, longitude: number, unit: string) {
  return `${latitude.toFixed(2)},${longitude.toFixed(2)},${unit}`;
}
