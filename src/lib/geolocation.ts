import { readSettings, writeSettings } from "@/lib/settings";
import { useSettingsStore } from "@/features/settings/stores";

export interface Coords {
  lat: number;
  lon: number;
}

// Several widgets (weather, air quality, solar graph, the Windy iframe
// preset) each want a lat/lon when the user hasn't set one in Settings.
// Before this, every one of them independently called
// navigator.geolocation.getCurrentPosition and threw the result away after
// using it once — so the browser's location prompt fired repeatedly and
// Settings' Latitude/Longitude fields never actually got filled in.
//
// This is the single place that happens now: if settings.latitude/longitude
// are already set, resolve with those immediately. Otherwise request the
// browser's location at most once per app session (concurrent callers share
// the same in-flight request) and persist it to settings on success, so
// every consumer — including the Settings dialog — converges on it without
// asking again.
let inFlight: Promise<Coords | null> | null = null;

export function getOrRequestLocation(): Promise<Coords | null> {
  const settings = readSettings() as Record<string, unknown>;
  const lat = settings.latitude as number | undefined;
  const lon = settings.longitude as number | undefined;
  if (lat && lon) return Promise.resolve({ lat, lon });

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }

  if (!inFlight) {
    inFlight = new Promise<Coords | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords: Coords = { lat: position.coords.latitude, lon: position.coords.longitude };
          const current = readSettings() as Record<string, unknown>;
          if (!current.latitude || !current.longitude) {
            void writeSettings({ ...current, latitude: coords.lat, longitude: coords.lon }).then(() => {
              useSettingsStore.getState().reloadSettings();
            });
          }
          resolve(coords);
        },
        () => resolve(null),
        { timeout: 8000, maximumAge: 600000 },
      );
    }).finally(() => {
      inFlight = null;
    });
  }

  return inFlight;
}
