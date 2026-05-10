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
  openWeather?: OpenWeatherCurrent;
}

export interface ForecastDay {
  date: string;
  dayName: string;
  high: number;
  low: number;
  precip: number;
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
  shaderColors: [string, string, string];
  shaderOpacity: string;
  darkText: boolean;
  textColor: string;
  textColorMuted: string;
  isHeavySnow: boolean;
  forecastDays: ForecastDay[];
  rangeMin: number;
  rangeMax: number;
  rangeSpan: number;
}
