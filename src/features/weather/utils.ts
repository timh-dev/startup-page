import {
  OPEN_METEO_CODES,
  CONDITION_GRADIENTS,
  SHADER_COLORS,
  DAY_NAMES,
} from "./constants";
import type {
  WeatherCondition,
  CloudCoverage,
  WeatherData,
  ForecastDay,
  ResolvedWeather,
  TimeKey,
} from "./types";

export function getConditionCategory(weather: string): WeatherCondition {
  if (weather in CONDITION_GRADIENTS) return weather as WeatherCondition;
  return "Clouds";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getTimePhase(data: WeatherData, currentTime = Date.now()): number {
  const sunrise = data.daily?.sunrise?.[0] ? new Date(data.daily.sunrise[0]).getTime() : null;
  const sunset  = data.daily?.sunset?.[0]  ? new Date(data.daily.sunset[0]).getTime()  : null;
  const sunriseWindow     = 90  * 60 * 1000;
  const sunsetLeadWindow  = 150 * 60 * 1000;
  const sunsetTrailWindow = 120 * 60 * 1000;

  if (sunrise && currentTime < sunrise) {
    return currentTime >= sunrise - sunriseWindow
      ? 2 - clamp((currentTime - (sunrise - sunriseWindow)) / sunriseWindow, 0, 1)
      : 2;
  }
  if (sunrise && currentTime < sunrise + sunriseWindow) {
    return 1 - clamp((currentTime - sunrise) / sunriseWindow, 0, 1);
  }
  if (sunset && currentTime < sunset) {
    return currentTime >= sunset - sunsetLeadWindow
      ? clamp((currentTime - (sunset - sunsetLeadWindow)) / sunsetLeadWindow, 0, 1)
      : 0;
  }
  if (sunset && currentTime < sunset + sunsetTrailWindow) {
    return 1 + clamp((currentTime - sunset) / sunsetTrailWindow, 0, 1);
  }
  if (sunrise && sunset) {
    return currentTime < sunrise || currentTime >= sunset ? 2 : 0;
  }
  return data.current?.is_day === 0 ? 2 : 0;
}

export function getOpenWeatherCondition(weatherId: number, weatherMain: string): WeatherCondition {
  if (weatherId >= 200 && weatherId < 300) return "Thunderstorm";
  if (weatherId >= 300 && weatherId < 400) return "Drizzle";
  if (weatherId >= 500 && weatherId < 600) return "Rain";
  if (weatherId >= 600 && weatherId < 700) return "Snow";
  if (weatherId >= 700 && weatherId < 800) return "Fog";
  if (weatherId === 800) return "Clear";
  if (weatherId > 800) return "Clouds";
  return getConditionCategory(weatherMain);
}

/** Maps each OpenWeather condition ID to the best cloud coverage for the 3-D sim. */
export function getOpenWeatherCoverage(weatherId: number): CloudCoverage {
  // 2xx Thunderstorm
  if (weatherId >= 200 && weatherId < 300) return "storm";

  // 3xx Drizzle — always overcast
  if (weatherId >= 300 && weatherId < 400) return "full";

  // 5xx Rain
  if (weatherId === 500 || weatherId === 520) return "full";               // light / light showers
  if (weatherId === 502 || weatherId === 503 || weatherId === 504) return "storm"; // heavy / very heavy / extreme
  if (weatherId === 522 || weatherId === 531) return "storm";              // heavy shower / ragged
  if (weatherId >= 500 && weatherId < 600) return "full";                  // remaining moderate rain

  // 6xx Snow
  if (weatherId === 602 || weatherId === 622) return "storm";              // heavy snow / heavy shower snow
  if (weatherId >= 600 && weatherId < 700) return "full";

  // 7xx Atmosphere
  if (weatherId === 771 || weatherId === 781) return "storm";              // squall / tornado
  if (weatherId === 701 || weatherId === 721) return "partly";             // mist / haze
  if (weatherId >= 700 && weatherId < 800) return "full";                  // smoke, dust, fog, ash …

  // 800 Clear
  if (weatherId === 800) return "none";

  // 80x Clouds
  if (weatherId === 801 || weatherId === 802) return "partly";             // few / scattered
  if (weatherId === 803 || weatherId === 804) return "full";               // broken / overcast

  return "none";
}

/** Maps each Open-Meteo WMO code to the best cloud coverage for the 3-D sim. */
export function getOpenMeteoCoverage(weatherCode: number): CloudCoverage {
  if (weatherCode === 0 || weatherCode === 1) return "none";
  if (weatherCode === 2) return "partly";
  if (weatherCode === 3) return "full";
  if (weatherCode === 45 || weatherCode === 48) return "full";             // fog
  if (weatherCode === 51 || weatherCode === 53 || weatherCode === 55) return "full"; // drizzle
  if (weatherCode === 56 || weatherCode === 57) return "full";             // freezing drizzle
  if (weatherCode === 61 || weatherCode === 63) return "full";             // slight / moderate rain
  if (weatherCode === 65 || weatherCode === 67) return "storm";            // heavy rain
  if (weatherCode === 71 || weatherCode === 73 || weatherCode === 77) return "full"; // snow
  if (weatherCode === 75) return "storm";                                   // heavy snow
  if (weatherCode === 80 || weatherCode === 81) return "full";             // rain showers
  if (weatherCode === 82) return "storm";                                   // violent showers
  if (weatherCode === 85) return "full";                                    // slight snow showers
  if (weatherCode === 86) return "storm";                                   // heavy snow showers
  if (weatherCode === 95) return "storm";                                   // thunderstorm
  if (weatherCode === 96 || weatherCode === 99) return "storm";            // thunderstorm + hail
  return "none";
}

export function formatWeatherDescription(description: string | undefined): string {
  if (!description) return "Current conditions";
  return description.charAt(0).toUpperCase() + description.slice(1);
}

export function resolveWeather(
  data: WeatherData,
  clockTime: number
): ResolvedWeather {
  const weatherCode = data.current?.weather_code ?? 3;
  const ow = data.openWeather;
  const mapped = ow ?? OPEN_METEO_CODES[weatherCode] ?? { weather: "Clouds" as WeatherCondition, description: "Current conditions" };

  const condition = getConditionCategory(mapped.weather);
  const timePhase = getTimePhase(data, clockTime);
  const dayTime   = timePhase < 1.5;
  const timeKey: TimeKey = dayTime ? "day" : "night";

  const coverage: CloudCoverage = ow
    ? getOpenWeatherCoverage(ow.id)
    : getOpenMeteoCoverage(weatherCode);

  // For the VolumetricCloudscape phase prop
  const phase = coverage === "storm" ? "storm" : timePhase;

  const gradient     = CONDITION_GRADIENTS[condition]?.[timeKey] ?? CONDITION_GRADIENTS.Clouds.day;
  const shaderColors = SHADER_COLORS[condition]?.[timeKey]       ?? SHADER_COLORS.Clouds.day;

  const isHeavySnow = ow
    ? [602, 622].includes(ow.id)
    : [75, 86].includes(weatherCode);

  const shaderOpacity = condition === "Clear" && dayTime ? "opacity-[0.12]" : "opacity-[0.3]";

  // Dark text for bright daytime skies; light text at night and for dark-sky conditions
  const darkText =
    dayTime &&
    condition !== "Thunderstorm" &&
    condition !== "Rain" &&
    condition !== "Drizzle";

  const textColor      = darkText ? "text-slate-800" : "text-white";
  const textColorMuted = darkText ? "text-slate-600" : "text-white/70";

  const temperature = Math.round(ow?.temperature ?? data.current?.temperature_2m ?? 0);
  const unitLabel   = data.unit === "imperial" ? "F" : "C";
  const description = mapped.description;

  // Forecast
  const highs   = data.daily?.temperature_2m_max ?? [];
  const lows    = data.daily?.temperature_2m_min ?? [];
  const dates   = data.daily?.time ?? [];
  const precips = data.daily?.precipitation_probability_max ?? [];

  const forecastDays: ForecastDay[] = dates.map((date, i) => ({
    date,
    dayName: i === 0 ? "Today" : DAY_NAMES[new Date(date + "T00:00:00").getDay()],
    high: Math.round(highs[i] ?? 0),
    low:  Math.round(lows[i]  ?? highs[i] ?? 0),
    precip: precips[i] ?? 0,
  }));

  const allTemps = [...lows, ...highs].filter(Number.isFinite);
  const rangeMin  = allTemps.length ? Math.min(...allTemps) : 0;
  const rangeMax  = allTemps.length ? Math.max(...allTemps) : 1;
  const rangeSpan = Math.max(rangeMax - rangeMin, 1);

  return {
    condition,
    coverage,
    phase,
    timePhase,
    dayTime,
    timeKey,
    temperature,
    unitLabel,
    description,
    gradient,
    shaderColors,
    shaderOpacity,
    darkText,
    textColor,
    textColorMuted,
    isHeavySnow,
    forecastDays,
    rangeMin,
    rangeMax,
    rangeSpan,
  };
}
