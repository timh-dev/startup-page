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
  source: "OpenWeather" | "Open-Meteo";
  unit: string;
  current?: {
    temperature_2m?: number;
    weather_code?: number;
    is_day?: number;
  };
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
    sunrise?: string[];
    sunset?: string[];
  };
  hourly?: {
    time?: string[];
    relative_humidity_2m?: number[];
    uv_index?: number[];
    wind_speed_10m?: number[];
    wind_direction_10m?: number[];
    precipitation_probability?: number[];
    precipitation?: number[];
  };
  openWeather?: OpenWeatherCurrent;
}

export interface HourlyForecastPoint {
  time: string;
  hourLabel: string;
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
