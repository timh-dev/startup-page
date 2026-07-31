import { useEffect } from "react";
import { readSettings } from "@/lib/settings";
import { getOrRequestLocation } from "@/lib/geolocation";
import { useWeatherStore } from "@/features/weather/stores/weatherStore";
import { getOpenWeatherCondition, formatWeatherDescription } from "@/features/weather/utils";
import type { WeatherData } from "@/features/weather/types/weather";

const WEATHER_TTL_MS = 10 * 60 * 1000;

interface OWCurrentResponse {
  cod: number;
  weather: Array<{ id: number; main: string; description: string }>;
  main: { temp: number; humidity: number };
  wind?: { speed: number; deg: number; gust?: number };
  clouds?: { all: number };
  visibility?: number;
  rain?: { "1h"?: number; "3h"?: number };
  snow?: { "1h"?: number; "3h"?: number };
  sys: { sunrise: number; sunset: number };
  name: string;
  dt: number;
}

interface OWForecastItem {
  dt_txt: string;
  main: { temp: number; temp_min: number; temp_max: number; humidity: number };
  weather: Array<{ id: number; main: string; description: string }>;
  wind: { speed: number; deg: number };
  pop: number;
  rain?: { "3h": number };
  snow?: { "3h": number };
}

interface OWForecastResponse {
  cod: string;
  list: OWForecastItem[];
}

async function fetchWeather(
  lat: number,
  lon: number,
  key: string,
  unit: string
): Promise<{ data: WeatherData; location: string }> {
  const owUnit = unit === "imperial" ? "imperial" : "metric";

  const [currentRes, forecastRes] = await Promise.all([
    fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${key}&units=${owUnit}`),
    fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${key}&units=${owUnit}&cnt=40`),
  ]);

  if (currentRes.status === 401 || forecastRes.status === 401)
    throw new Error("Invalid API key — check your OpenWeather key in Settings");
  if (!currentRes.ok)
    throw new Error(`Weather request failed (${currentRes.status})`);
  if (!forecastRes.ok)
    throw new Error(`Forecast request failed (${forecastRes.status})`);

  const current  = (await currentRes.json())  as OWCurrentResponse;
  const forecast = (await forecastRes.json()) as OWForecastResponse;

  const w = current.weather?.[0];
  if (!w) throw new Error("Unexpected weather response format");

  const sunriseIso = new Date(current.sys.sunrise * 1000).toISOString();
  const sunsetIso  = new Date(current.sys.sunset  * 1000).toISOString();
  const isDay      = current.dt >= current.sys.sunrise && current.dt < current.sys.sunset ? 1 : 0;

  // Group 3h forecast slots by date
  const dayMap = new Map<string, OWForecastItem[]>();
  for (const item of forecast.list) {
    const date = item.dt_txt.slice(0, 10);
    if (!dayMap.has(date)) dayMap.set(date, []);
    dayMap.get(date)!.push(item);
  }

  const days = [...dayMap.entries()].slice(0, 5);
  const dailyTime:     string[] = [];
  const dailyMax:      number[] = [];
  const dailyMin:      number[] = [];
  const dailyPrecip:   number[] = [];
  const dailySunrise:  string[] = [];
  const dailySunset:   string[] = [];
  const dailyWeatherId:   number[] = [];
  const dailyDescription: string[] = [];

  days.forEach(([date, items], idx) => {
    dailyTime.push(date);
    dailyMax.push(Math.max(...items.map((i) => i.main.temp_max ?? i.main.temp)));
    dailyMin.push(Math.min(...items.map((i) => i.main.temp_min ?? i.main.temp)));
    dailyPrecip.push(Math.round(Math.max(...items.map((i) => i.pop)) * 100));
    dailySunrise.push(idx === 0 ? sunriseIso : "");
    dailySunset.push(idx === 0 ? sunsetIso  : "");

    // Representative condition for the day: OpenWeather condition ids run
    // most-severe-first (2xx thunderstorm ... 800 clear ... 80x clouds), so
    // the lowest id among the day's 3h buckets is the "worst" — matches how
    // most weather apps summarize a day (if a storm is possible, lead with it).
    const worst = items.reduce((best, item) => {
      const id = item.weather?.[0]?.id;
      return id != null && id < (best?.weather?.[0]?.id ?? Infinity) ? item : best;
    }, items[0]);
    dailyWeatherId.push(worst?.weather?.[0]?.id ?? 800);
    dailyDescription.push(formatWeatherDescription(worst?.weather?.[0]?.description ?? worst?.weather?.[0]?.main));
  });

  const hourlyTime:      string[] = [];
  const hourlyTemp:      number[] = [];
  const hourlyWeatherId: number[] = [];
  const hourlyHumidity:  number[] = [];
  const hourlyWind:      number[] = [];
  const hourlyWindDir:   number[] = [];
  const hourlyPrecipPct: number[] = [];
  const hourlyPrecip:    number[] = [];

  for (const item of forecast.list) {
    hourlyTime.push(item.dt_txt.replace(" ", "T"));
    hourlyTemp.push(item.main.temp);
    hourlyWeatherId.push(item.weather?.[0]?.id ?? 800);
    hourlyHumidity.push(item.main.humidity);
    hourlyWind.push(item.wind?.speed ?? 0);
    hourlyWindDir.push(item.wind?.deg ?? 0);
    hourlyPrecipPct.push(Math.round(item.pop * 100));
    hourlyPrecip.push(item.rain?.["3h"] ?? item.snow?.["3h"] ?? 0);
  }

  const weatherData: WeatherData = {
    source: "OpenWeather",
    unit,
    current: {
      temperature_2m:   current.main.temp,
      weather_code:     w.id,
      is_day:           isDay,
      cloud_cover:      current.clouds?.all,
      visibility:       current.visibility,
      wind_speed:       current.wind?.speed,
      wind_gust:        current.wind?.gust,
      precipitation_1h: current.rain?.["1h"] ?? current.snow?.["1h"],
    },
    daily: {
      time:                          dailyTime,
      temperature_2m_max:            dailyMax,
      temperature_2m_min:            dailyMin,
      precipitation_probability_max: dailyPrecip,
      sunrise:                       dailySunrise,
      sunset:                        dailySunset,
      weather_code:                  dailyWeatherId,
      description:                   dailyDescription,
    },
    hourly: {
      time:                      hourlyTime,
      temperature_2m:            hourlyTemp,
      weather_code:              hourlyWeatherId,
      relative_humidity_2m:      hourlyHumidity,
      uv_index:                  [],
      wind_speed_10m:            hourlyWind,
      wind_direction_10m:        hourlyWindDir,
      precipitation_probability: hourlyPrecipPct,
      precipitation:             hourlyPrecip,
    },
    openWeather: {
      id:          w.id,
      weather:     getOpenWeatherCondition(w.id, w.main),
      description: formatWeatherDescription(w.description || w.main),
      temperature: current.main.temp,
    },
  };

  return { data: weatherData, location: current.name };
}

export interface WeatherOverrides {
  lat?: number | null;
  lon?: number | null;
  units?: "imperial" | "metric";
  apiKey?: string | null;
}

export function useWeatherData(instanceId: string, overrides: WeatherOverrides = {}): void {
  const setData = useWeatherStore((state) => state.setData);
  const setError = useWeatherStore((state) => state.setError);
  const setLocation = useWeatherStore((state) => state.setLocation);
  const setCoords = useWeatherStore((state) => state.setCoords);
  const setLastFetchedAt = useWeatherStore((state) => state.setLastFetchedAt);

  // Overrides are a fresh object every render from the registry wrapper, so
  // depend on their primitive fields rather than the object identity.
  const overrideLat = overrides.lat;
  const overrideLon = overrides.lon;
  const overrideUnits = overrides.units;
  const overrideApiKey = overrides.apiKey;

  useEffect(() => {
    const instance = useWeatherStore.getState().instances[instanceId];
    if (instance?.lastFetchedAt && Date.now() - instance.lastFetchedAt < WEATHER_TTL_MS && instance.data) return;

    const settings = readSettings() as Record<string, unknown>;
    const unit = overrideUnits || (settings.unit as string) || (settings.units as string) || "imperial";
    const key = (overrideApiKey || (settings.openWeatherCredential as string) || "").trim();

    if (!key) {
      setError(instanceId, "Add your OpenWeather API key in this widget's settings");
      return;
    }

    async function load(lat: number, lon: number): Promise<void> {
      try {
        const { data: weatherData, location } = await fetchWeather(lat, lon, key, unit);
        setData(instanceId, weatherData);
        setLastFetchedAt(instanceId, Date.now());
        setLocation(instanceId, location);
        setCoords(instanceId, lat, lon);
      } catch (err) {
        setError(instanceId, (err as Error).message || "Could not load weather");
      }
    }

    const lat = overrideLat ?? (settings.latitude as number | undefined);
    const lon = overrideLon ?? (settings.longitude as number | undefined);

    if (lat && lon) {
      void load(lat, lon);
      return;
    }

    void getOrRequestLocation().then((coords) => {
      if (coords) {
        void load(coords.lat, coords.lon);
      } else {
        setError(instanceId, "Location unavailable — set coordinates in this widget's settings");
      }
    });
  }, [instanceId, overrideLat, overrideLon, overrideUnits, overrideApiKey, setData, setError, setLocation, setCoords, setLastFetchedAt]);
}
