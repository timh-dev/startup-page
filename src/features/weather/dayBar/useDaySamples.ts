import React from "react";

import { useWeatherData, type WeatherOverrides } from "@/features/weather/hooks/useWeatherData";
import { useWeatherInstance } from "@/features/weather/stores/weatherStore";
import { useSettingsStore } from "@/features/settings/stores";
import { getOrRequestLocation } from "@/lib/geolocation";
import { useDebugStore } from "@/lib/debug";
import { openMeteoAllowed, openMeteoUrl } from "@/lib/openMeteo";
import { historyKey, rememberSamples, samplesFromOpenMeteo, samplesFromOpenWeather, withHistory, type OpenMeteoHourly } from "./sources";
import type { HourSample } from "./timeline";

// The frosted card's day of weather. Open-Meteo, where this build may use it,
// has every hour of today including those past. Otherwise it's OpenWeather's
// forecast (which only looks ahead), with earlier hours filled in from what
// it said on earlier visits today.

const OPEN_METEO_TTL_MS = 15 * 60_000;
const openMeteoCache = new Map<string, { at: number; samples: Promise<HourSample[]> }>();

function fetchOpenMeteo(latitude: number, longitude: number, unit: string): Promise<HourSample[]> {
  const key = `${latitude.toFixed(2)},${longitude.toFixed(2)},${unit}`;
  const cached = openMeteoCache.get(key);
  if (cached && Date.now() - cached.at < OPEN_METEO_TTL_MS) return cached.samples;
  const url = openMeteoUrl("forecast", {
    latitude,
    longitude,
    hourly: "temperature_2m,weather_code,cloud_cover,precipitation,precipitation_probability,wind_speed_10m",
    past_days: 1,
    forecast_days: 7,
    timeformat: "unixtime",
    wind_speed_unit: "ms",
    temperature_unit: unit === "metric" ? "celsius" : "fahrenheit",
  });
  if (!url) return Promise.reject(new Error("Open-Meteo isn't available here"));
  const samples = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`Open-Meteo request failed (${res.status})`);
      return res.json() as Promise<{ hourly: OpenMeteoHourly }>;
    })
    .then((json) => samplesFromOpenMeteo(json.hourly, Date.now()));
  // A failure isn't kept, so the next try fetches again.
  samples.catch(() => openMeteoCache.delete(key));
  openMeteoCache.set(key, { at: Date.now(), samples });
  return samples;
}

/** Where the card is: as OpenWeather resolved it, else the same order it uses (debugger, card, settings, browser). */
function usePlace(overrides: WeatherOverrides, fetched: { lat: number | null; lon: number | null }) {
  const debugPlace = useDebugStore((state) => state.location);
  const settingsLat = useSettingsStore((state) => state.settings.latitude) as number | undefined;
  const settingsLon = useSettingsStore((state) => state.settings.longitude) as number | undefined;
  const [browser, setBrowser] = React.useState<{ latitude: number; longitude: number } | null>(null);

  const known =
    debugPlace
      ? { latitude: debugPlace.latitude, longitude: debugPlace.longitude }
      : overrides.lat != null && overrides.lon != null
        ? { latitude: overrides.lat, longitude: overrides.lon }
        : fetched.lat != null && fetched.lon != null
          ? { latitude: fetched.lat, longitude: fetched.lon }
          : settingsLat && settingsLon
            ? { latitude: Number(settingsLat), longitude: Number(settingsLon) }
            : null;

  // Only asked for when Open-Meteo would use it and nothing else says where.
  React.useEffect(() => {
    if (known || !openMeteoAllowed) return undefined;
    let cancelled = false;
    void getOrRequestLocation().then((coords) => {
      if (!cancelled && coords) setBrowser({ latitude: coords.lat, longitude: coords.lon });
    });
    return () => {
      cancelled = true;
    };
  }, [known]);

  return known ?? browser;
}

export interface DaySamples {
  samples: HourSample[] | null;
  place: { latitude: number; longitude: number } | null;
  unit: "imperial" | "metric";
  /** Why there's nothing to show (no OpenWeather key and no Open-Meteo, say). */
  error: string | null;
}

export function useDaySamples(instanceId: string, overrides: WeatherOverrides): DaySamples {
  useWeatherData(instanceId, overrides);
  const { data, error, lat, lon } = useWeatherInstance(instanceId);
  const settingsUnits = useSettingsStore((state) => state.settings.units) as string | undefined;
  const unit: "imperial" | "metric" = (overrides.units ?? data?.unit ?? settingsUnits) === "metric" ? "metric" : "imperial";
  const place = usePlace(overrides, { lat, lon });

  const [openMeteo, setOpenMeteo] = React.useState<{ key: string; samples: HourSample[] } | null>(null);
  const [openMeteoFailed, setOpenMeteoFailed] = React.useState(false);
  const placeId = place ? historyKey(place.latitude, place.longitude, unit) : null;
  React.useEffect(() => {
    if (!openMeteoAllowed || !place || !placeId) return undefined;
    let cancelled = false;
    const load = () =>
      fetchOpenMeteo(place.latitude, place.longitude, unit)
        .then((samples) => {
          if (cancelled) return;
          setOpenMeteo({ key: placeId, samples });
          setOpenMeteoFailed(false);
        })
        // Falls back to OpenWeather below.
        .catch(() => !cancelled && setOpenMeteoFailed(true));
    void load();
    const timer = window.setInterval(load, OPEN_METEO_TTL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId]);

  // OpenWeather: remember each forecast, so today's past hours fill in later.
  const owKey = data && lat != null && lon != null ? historyKey(lat, lon, data.unit) : null;
  const owSamples = React.useMemo(() => (data ? samplesFromOpenWeather(data) : null), [data]);
  React.useEffect(() => {
    if (owKey && owSamples?.length) rememberSamples(owKey, owSamples, Date.now());
  }, [owKey, owSamples]);

  if (openMeteo && openMeteo.key === placeId) return { samples: openMeteo.samples, place, unit, error: null };
  if (owKey && owSamples) return { samples: withHistory(owKey, owSamples), place: place ?? { latitude: lat!, longitude: lon! }, unit, error: null };
  // While Open-Meteo may still answer, OpenWeather's complaint (no key, say) isn't the last word.
  return { samples: null, place, unit, error: openMeteoAllowed && !openMeteoFailed ? null : error };
}
