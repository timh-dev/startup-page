import { create } from "zustand";
import type { ForecastDay, WeatherData } from "@/features/weather/types/weather";

export interface SelectedWeatherDay {
  day: ForecastDay;
  unit: "imperial" | "metric";
}

export interface WeatherInstanceState {
  data: WeatherData | null;
  error: string | null;
  location: string;
  lat: number | null;
  lon: number | null;
  lastFetchedAt: number | null;
  selectedDay: SelectedWeatherDay | null;
  /** Drives the "day detail" Dialog opened from the compact WeatherBox. */
  detailOpen: boolean;
}

const EMPTY_INSTANCE: WeatherInstanceState = {
  data: null,
  error: null,
  location: "Weather",
  lat: null,
  lon: null,
  lastFetchedAt: null,
  selectedDay: null,
  detailOpen: false,
};

interface WeatherStore {
  // Keyed by widget instance id — each weather widget fetches and caches
  // independently, so two instances with different locations never clobber
  // each other's data.
  instances: Record<string, WeatherInstanceState>;
  // Shared across every instance — just a ticking clock, no reason to
  // duplicate it per widget.
  clockTime: number;
  setData: (id: string, data: WeatherData) => void;
  setError: (id: string, error: string) => void;
  setLocation: (id: string, location: string) => void;
  setCoords: (id: string, lat: number, lon: number) => void;
  setLastFetchedAt: (id: string, time: number) => void;
  /** Sets which day to show (or null for "today") and opens the detail dialog. */
  openWeatherCard: (id: string, selectedDay?: SelectedWeatherDay | null) => void;
  closeWeatherCard: (id: string) => void;
  tickClock: () => void;
}

function withInstance(
  state: WeatherStore,
  id: string,
  patch: Partial<WeatherInstanceState>,
): Pick<WeatherStore, "instances"> {
  return {
    instances: {
      ...state.instances,
      [id]: { ...(state.instances[id] || EMPTY_INSTANCE), ...patch },
    },
  };
}

export const useWeatherStore = create<WeatherStore>((set) => ({
  instances: {},
  clockTime: Date.now(),
  setData: (id, data) => set((state) => withInstance(state, id, { data })),
  setError: (id, error) => set((state) => withInstance(state, id, { error })),
  setLocation: (id, location) => set((state) => withInstance(state, id, { location })),
  setCoords: (id, lat, lon) => set((state) => withInstance(state, id, { lat, lon })),
  setLastFetchedAt: (id, time) => set((state) => withInstance(state, id, { lastFetchedAt: time })),
  openWeatherCard: (id, selectedDay = null) =>
    set((state) => withInstance(state, id, { selectedDay, detailOpen: true })),
  closeWeatherCard: (id) => set((state) => withInstance(state, id, { detailOpen: false })),
  tickClock: () => set({ clockTime: Date.now() }),
}));

export function useWeatherInstance(id: string): WeatherInstanceState {
  return useWeatherStore((state) => state.instances[id] || EMPTY_INSTANCE);
}
