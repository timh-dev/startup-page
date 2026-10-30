export type WeatherCondition =
  | "Clear"
  | "Clouds"
  | "Rain"
  | "Drizzle"
  | "Snow"
  | "Thunderstorm"
  | "Fog";

export type CloudCoverage = "none" | "partly" | "full" | "storm";
export type TimeKey = "day" | "night";
export type WeatherPhase = number | "storm";
export type CloudStyle =
  | "clear"
  | "cumulus"
  | "stratocumulus"
  | "stratus"
  | "nimbostratus"
  | "cumulonimbus"
  | "supercell";
export type PrecipitationStyle =
  | "none"
  | "drizzle"
  | "rain"
  | "heavy-rain"
  | "shower-rain"
  | "freezing-rain"
  | "snow"
  | "heavy-snow"
  | "sleet";
export type AtmosphereStyle =
  | "none"
  | "mist"
  | "smoke"
  | "haze"
  | "dust"
  | "sand"
  | "fog"
  | "ash"
  | "squall"
  | "tornado";

export interface OpenWeatherCurrent {
  id: number;
  weather: WeatherCondition;
  description: string;
  temperature: number;
}

export interface WeatherData {
  source: "OpenWeather";
  unit: string;
  current?: {
    /** When this reading was taken, as local time ("2026-10-29T19:40:00"). */
    time?: string;
    temperature_2m?: number;
    weather_code?: number;
    is_day?: number;
    /** Cloud cover percentage 0-100 (OpenWeather `clouds.all`) */
    cloud_cover?: number;
    /** Visibility in meters, max 10000 (OpenWeather `visibility`) */
    visibility?: number;
    /** Wind speed in the request's display unit (mph imperial / m/s metric) */
    wind_speed?: number;
    wind_gust?: number;
    /** Precipitation over the last hour in mm (OpenWeather `rain.1h` / `snow.1h`) */
    precipitation_1h?: number;
  };
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
    sunrise?: string[];
    sunset?: string[];
    /** OpenWeather condition id representing each day (worst-case among its 3h buckets) */
    weather_code?: number[];
    description?: string[];
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    weather_code?: number[];
    relative_humidity_2m?: number[];
    uv_index?: number[];
    wind_speed_10m?: number[];
    wind_direction_10m?: number[];
    precipitation_probability?: number[];
    precipitation?: number[];
    /** 1 in daylight, 0 at night (NaN when the source didn't say). */
    is_day?: number[];
    /** Cloud cover, 0–100 (NaN when the source didn't say). */
    cloud_cover?: number[];
  };
  openWeather?: OpenWeatherCurrent;
}

export interface HourlyForecastPoint {
  time: string;
  hourLabel: string;
  temperature: number | null;
  weatherId: number | null;
  humidity: number | null;
  uvIndex: number | null;
  windSpeed: number | null;
  windDirection: number | null;
  precipitationProbability: number | null;
  precipitation: number | null;
}

export interface ForecastDay {
  date: string;
  dayName: string;
  high: number;
  low: number;
  precip: number;
  weatherId: number;
  condition: WeatherCondition;
  description: string;
  cloudStyle: CloudStyle;
  coverage: CloudCoverage;
  hourly: HourlyForecastPoint[];
}

export interface WeatherVisualProfile {
  weatherId: number;
  cloudStyle: CloudStyle;
  precipitationStyle: PrecipitationStyle;
  atmosphereStyle: AtmosphereStyle;
  precipitationIntensity: number;
  atmosphereIntensity: number;
  lightningIntensity: number;
  windIntensity: number;
  visibility: number;
  surfaceWetness: number;
  skyTint: string;
  cloudContrast: number;
  promptKeywords: string[];
}

export interface ResolvedWeather {
  condition: WeatherCondition;
  coverage: CloudCoverage;
  phase: WeatherPhase;
  timePhase: number;
  /** Continuous cloud-sky fraction 0-1, from OpenWeather `clouds.all` clamped to the condition's plausible range */
  cloudFraction: number;
  /** Cloud optical thickness 0-1 — drives how dark/heavy the deck renders */
  cloudDensity: number;
  /** Wind 0-1 blending the visual profile with the reported wind speed */
  windEffective: number;
  /** Wall-clock hour 0-24 derived from clockTime (drives shader sun position; preview-safe) */
  clockHour: number;
  dayTime: boolean;
  timeKey: TimeKey;
  temperature: number;
  unitLabel: string;
  description: string;
  gradient: string;
  skyGradient: string;
  shaderColors: [string, string, string];
  shaderOpacity: string;
  skyDarkness: number;
  horizonGlow: number;
  showAurora: boolean;
  auroraIntensity: number;
  visual: WeatherVisualProfile;
  darkText: boolean;
  textColor: string;
  textColorMuted: string;
  isHeavySnow: boolean;
  forecastDays: ForecastDay[];
  rangeMin: number;
  rangeMax: number;
  rangeSpan: number;
}
