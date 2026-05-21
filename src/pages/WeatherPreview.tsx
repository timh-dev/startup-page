import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { HiArrowLeft } from "react-icons/hi2";
import { WeatherBox } from "@/features/weather/components/WeatherBox";
import type { WeatherCondition, WeatherData } from "@/features/weather/types/weather";

const CONDITION_OPTIONS: Array<{
  group: string;
  id: number;
  main: WeatherCondition;
  description: string;
}> = [
  { group: "Thunderstorm", id: 200, main: "Thunderstorm", description: "Thunderstorm with light rain" },
  { group: "Thunderstorm", id: 201, main: "Thunderstorm", description: "Thunderstorm with rain" },
  { group: "Thunderstorm", id: 202, main: "Thunderstorm", description: "Thunderstorm with heavy rain" },
  { group: "Thunderstorm", id: 210, main: "Thunderstorm", description: "Light thunderstorm" },
  { group: "Thunderstorm", id: 211, main: "Thunderstorm", description: "Thunderstorm" },
  { group: "Thunderstorm", id: 212, main: "Thunderstorm", description: "Heavy thunderstorm" },
  { group: "Thunderstorm", id: 221, main: "Thunderstorm", description: "Ragged thunderstorm" },
  { group: "Thunderstorm", id: 230, main: "Thunderstorm", description: "Thunderstorm with light drizzle" },
  { group: "Thunderstorm", id: 231, main: "Thunderstorm", description: "Thunderstorm with drizzle" },
  { group: "Thunderstorm", id: 232, main: "Thunderstorm", description: "Thunderstorm with heavy drizzle" },
  { group: "Drizzle", id: 300, main: "Drizzle", description: "Light intensity drizzle" },
  { group: "Drizzle", id: 301, main: "Drizzle", description: "Drizzle" },
  { group: "Drizzle", id: 302, main: "Drizzle", description: "Heavy intensity drizzle" },
  { group: "Drizzle", id: 310, main: "Drizzle", description: "Light intensity drizzle rain" },
  { group: "Drizzle", id: 311, main: "Drizzle", description: "Drizzle rain" },
  { group: "Drizzle", id: 312, main: "Drizzle", description: "Heavy intensity drizzle rain" },
  { group: "Drizzle", id: 313, main: "Drizzle", description: "Shower rain and drizzle" },
  { group: "Drizzle", id: 314, main: "Drizzle", description: "Heavy shower rain and drizzle" },
  { group: "Drizzle", id: 321, main: "Drizzle", description: "Shower drizzle" },
  { group: "Rain", id: 500, main: "Rain", description: "Light rain" },
  { group: "Rain", id: 501, main: "Rain", description: "Moderate rain" },
  { group: "Rain", id: 502, main: "Rain", description: "Heavy intensity rain" },
  { group: "Rain", id: 503, main: "Rain", description: "Very heavy rain" },
  { group: "Rain", id: 504, main: "Rain", description: "Extreme rain" },
  { group: "Rain", id: 511, main: "Rain", description: "Freezing rain" },
  { group: "Rain", id: 520, main: "Rain", description: "Light intensity shower rain" },
  { group: "Rain", id: 521, main: "Rain", description: "Shower rain" },
  { group: "Rain", id: 522, main: "Rain", description: "Heavy intensity shower rain" },
  { group: "Rain", id: 531, main: "Rain", description: "Ragged shower rain" },
  { group: "Snow", id: 600, main: "Snow", description: "Light snow" },
  { group: "Snow", id: 601, main: "Snow", description: "Snow" },
  { group: "Snow", id: 602, main: "Snow", description: "Heavy snow" },
  { group: "Snow", id: 611, main: "Snow", description: "Sleet" },
  { group: "Snow", id: 612, main: "Snow", description: "Light shower sleet" },
  { group: "Snow", id: 613, main: "Snow", description: "Shower sleet" },
  { group: "Snow", id: 615, main: "Snow", description: "Light rain and snow" },
  { group: "Snow", id: 616, main: "Snow", description: "Rain and snow" },
  { group: "Snow", id: 620, main: "Snow", description: "Light shower snow" },
  { group: "Snow", id: 621, main: "Snow", description: "Shower snow" },
  { group: "Snow", id: 622, main: "Snow", description: "Heavy shower snow" },
  { group: "Atmosphere", id: 701, main: "Fog", description: "Mist" },
  { group: "Atmosphere", id: 711, main: "Fog", description: "Smoke" },
  { group: "Atmosphere", id: 721, main: "Fog", description: "Haze" },
  { group: "Atmosphere", id: 731, main: "Fog", description: "Sand/dust whirls" },
  { group: "Atmosphere", id: 741, main: "Fog", description: "Fog" },
  { group: "Atmosphere", id: 751, main: "Fog", description: "Sand" },
  { group: "Atmosphere", id: 761, main: "Fog", description: "Dust" },
  { group: "Atmosphere", id: 762, main: "Fog", description: "Volcanic ash" },
  { group: "Atmosphere", id: 771, main: "Fog", description: "Squalls" },
  { group: "Atmosphere", id: 781, main: "Fog", description: "Tornado" },
  { group: "Clear", id: 800, main: "Clear", description: "Clear sky" },
  { group: "Clouds", id: 801, main: "Clouds", description: "Few clouds" },
  { group: "Clouds", id: 802, main: "Clouds", description: "Scattered clouds" },
  { group: "Clouds", id: 803, main: "Clouds", description: "Broken clouds" },
  { group: "Clouds", id: 804, main: "Clouds", description: "Overcast clouds" },
];

const PREVIEW_DATE = "2026-06-15";
const MS_PER_HOUR = 60 * 60 * 1000;

function getPreviewTemperature(condition: WeatherCondition): number {
  if (condition === "Clear") return 78;
  if (condition === "Clouds") return 70;
  if (condition === "Rain" || condition === "Drizzle" || condition === "Thunderstorm") return 64;
  if (condition === "Snow") return 28;
  return 55;
}

function makeHourlyPreview(): WeatherData["hourly"] {
  const time: string[] = [];
  const relative_humidity_2m: number[] = [];
  const uv_index: number[] = [];
  const wind_speed_10m: number[] = [];
  const wind_direction_10m: number[] = [];
  const precipitation_probability: number[] = [];
  const precipitation: number[] = [];

  for (let day = 0; day < 4; day += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      const date = new Date(`${PREVIEW_DATE}T00:00:00`);
      date.setDate(date.getDate() + day);
      date.setHours(hour, 0, 0, 0);
      const daylight = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
      const rainWave = Math.max(0, Math.sin((hour + day * 3) / 3));

      time.push(date.toISOString().slice(0, 16));
      relative_humidity_2m.push(Math.round(48 + (1 - daylight) * 28 + rainWave * 16));
      uv_index.push(Number((daylight * (7 - day * 0.6)).toFixed(1)));
      wind_speed_10m.push(Math.round(6 + Math.sin(hour / 2 + day) * 3 + day * 1.5));
      wind_direction_10m.push((hour * 18 + day * 55) % 360);
      precipitation_probability.push(Math.round(rainWave * 55));
      precipitation.push(Number((rainWave * 0.04).toFixed(2)));
    }
  }

  return {
    time,
    relative_humidity_2m,
    uv_index,
    wind_speed_10m,
    wind_direction_10m,
    precipitation_probability,
    precipitation,
  };
}

function makePreviewWeather(conditionId: number): WeatherData {
  const selected = CONDITION_OPTIONS.find((option) => option.id === conditionId) ?? CONDITION_OPTIONS[0];
  const temperature = getPreviewTemperature(selected.main);

  return {
    source: "OpenWeather",
    unit: "imperial",
    current: {
      temperature_2m: temperature,
      weather_code: 3,
      is_day: 1,
    },
    daily: {
      time: ["2026-06-15", "2026-06-16", "2026-06-17", "2026-06-18"],
      temperature_2m_max: [temperature + 4, temperature + 2, temperature + 6, temperature + 1],
      temperature_2m_min: [temperature - 12, temperature - 10, temperature - 9, temperature - 13],
      precipitation_probability_max: selected.main === "Clear" ? [5, 8, 4, 10] : [45, 60, 35, 50],
      sunrise: ["2026-06-15T06:00:00"],
      sunset: ["2026-06-15T20:00:00"],
    },
    hourly: makeHourlyPreview(),
    openWeather: {
      id: selected.id,
      weather: selected.main,
      description: selected.description,
      temperature,
    },
  };
}

function getClockTime(hour: number): number {
  return new Date(`${PREVIEW_DATE}T00:00:00`).getTime() + hour * MS_PER_HOUR;
}

function formatPreviewHour(hour: number): string {
  const totalMinutes = Math.round(hour * 60);
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const hour12 = hours % 12 || 12;
  const suffix = hours < 12 ? "AM" : "PM";
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export default function WeatherPreviewPage() {
  const [conditionId, setConditionId] = useState(802);
  const [previewHour, setPreviewHour] = useState(12);
  const previewData = useMemo(() => makePreviewWeather(conditionId), [conditionId]);
  const clockTime = useMemo(() => getClockTime(previewHour), [previewHour]);
  const groups = Array.from(new Set(CONDITION_OPTIONS.map((option) => option.group)));

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="fixed top-6 left-6 z-[10000]">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
        >
          <HiArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 p-6">
        <div className="flex w-full max-w-xl flex-wrap items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/10 p-3 text-white backdrop-blur-sm">
          <label className="flex min-w-44 flex-1 flex-col gap-1 text-xs font-medium uppercase tracking-wide text-white/60">
            Conditions
            <select
              value={conditionId}
              onChange={(event) => setConditionId(Number(event.target.value))}
              className="rounded-lg border border-white/15 bg-neutral-950 px-3 py-2 text-sm font-medium normal-case text-white outline-none transition focus:border-white/40"
            >
              {groups.map((group) => (
                <optgroup key={group} label={group}>
                  {CONDITION_OPTIONS.filter((option) => option.group === group).map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.id} - {option.description}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="flex min-w-64 flex-[1.6] flex-col gap-2 text-xs font-medium uppercase tracking-wide text-white/60">
            <span className="flex items-center justify-between gap-3">
              <span>Time of day</span>
              <span className="text-sm font-semibold normal-case text-white">{formatPreviewHour(previewHour)}</span>
            </span>
            <input
              type="range"
              min="0"
              max="24"
              step="0.25"
              value={previewHour}
              onChange={(event) => setPreviewHour(Number(event.target.value))}
              className="h-2 w-full cursor-pointer accent-amber-300"
            />
            <span className="flex justify-between text-[0.65rem] normal-case tracking-normal text-white/45">
              <span>12 AM</span>
              <span>6 AM</span>
              <span>12 PM</span>
              <span>6 PM</span>
              <span>12 AM</span>
            </span>
          </label>
        </div>
        <div className="h-[min(74vh,34rem)] w-[min(92vw,42rem)] overflow-hidden rounded-3xl shadow-2xl shadow-black/40">
          <WeatherBox data={previewData} location="Weather Preview" clockTime={clockTime} />
        </div>
      </div>
    </div>
  );
}
