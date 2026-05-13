import { useEffect } from "react";
import { readSettings } from "@/lib/settings";
import { useWeatherStore } from "@/features/weather/stores/weatherStore";
import { getOpenWeatherCondition, formatWeatherDescription } from "@/features/weather/utils";
import type { WeatherData } from "@/features/weather/types/weather";

async function fetchOpenMeteo(lat: number, lon: number, unit: string): Promise<Partial<WeatherData>> {
  const tempUnit = unit === "imperial" ? "fahrenheit" : "celsius";
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,weather_code,is_day` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset` +
    `&temperature_unit=${tempUnit}&timezone=auto&forecast_days=5`;
  const res  = await fetch(url);
  const json = (await res.json()) as Partial<WeatherData>;
  if (!res.ok) throw new Error("Open-Meteo request failed");
  return json;
}

async function fetchOpenWeather(
  lat: number,
  lon: number,
  key: string,
  unit: string
): Promise<{ weather: WeatherData["openWeather"]; location: string | null }> {
  const owUnit = unit === "imperial" ? "imperial" : "metric";
  const res    = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${key}&units=${owUnit}`
  );
  const owData = (await res.json()) as {
    weather?: Array<{ id: number; main: string; description: string }>;
    main?: { temp: number };
    name?: string;
    cod?: number;
  };
  const owWeather = owData.weather?.[0];
  const owTemp    = owData.main?.temp;
  if (!res.ok || !owWeather || !Number.isFinite(owTemp)) return { weather: undefined, location: null };
  return {
    weather: {
      id: owWeather.id,
      weather: getOpenWeatherCondition(owWeather.id, owWeather.main),
      description: formatWeatherDescription(owWeather.description || owWeather.main),
      temperature: owTemp!,
    },
    location: owData.name ?? null,
  };
}

async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`
    );
    const data = (await res.json()) as {
      address?: { city?: string; town?: string };
      display_name?: string;
    };
    return data.address?.city ?? data.address?.town ?? data.display_name?.split(",")[0] ?? null;
  } catch {
    return null;
  }
}

export function useWeatherData(): void {
  const { setData, setError, setLocation } = useWeatherStore();

  useEffect(() => {
    const settings = readSettings() as Record<string, unknown>;
    const unit: string = (settings.unit as string) || (settings.units as string) || "imperial";
    const key: string  = (settings.openWeatherCredential as string) ?? "";

    async function load(lat: number, lon: number): Promise<void> {
      try {
        const base = await fetchOpenMeteo(lat, lon, unit);
        let merged: WeatherData = { ...base, unit, source: "Open-Meteo" } as WeatherData;
        let resolvedLocation: string | null = null;

        if (key) {
          try {
            const { weather: owWeather, location: owLoc } = await fetchOpenWeather(lat, lon, key, unit);
            if (owWeather) {
              merged = { ...merged, source: "OpenWeather", openWeather: owWeather };
              resolvedLocation = owLoc;
            }
          } catch { /* fallback to Open-Meteo */ }
        }

        if (!resolvedLocation) {
          resolvedLocation = await reverseGeocode(lat, lon);
        }

        setData(merged);
        setLocation(resolvedLocation ?? `${Number(lat).toFixed(2)}, ${Number(lon).toFixed(2)}`);
      } catch (err) {
        setError((err as Error).message || "Could not load forecast");
      }
    }

    const lat = settings.latitude as number | undefined;
    const lon = settings.longitude as number | undefined;

    if (lat && lon) {
      void load(lat, lon);
      return;
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => void load(pos.coords.latitude, pos.coords.longitude),
        () => setError("Location unavailable — set coordinates in settings")
      );
    } else {
      setError("Geolocation not supported");
    }
  }, [setData, setError, setLocation]);
}
