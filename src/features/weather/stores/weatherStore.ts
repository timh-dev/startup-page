import { create } from "zustand";
import type { WeatherData } from "@/features/weather/types/weather";

interface WeatherStore {
  data: WeatherData | null;
  error: string | null;
  location: string;
  clockTime: number;
  setData: (data: WeatherData) => void;
  setError: (error: string) => void;
  setLocation: (location: string) => void;
  tickClock: () => void;
}

export const useWeatherStore = create<WeatherStore>((set) => ({
  data: null,
  error: null,
  location: "Weather",
  clockTime: Date.now(),
  setData:     (data)     => set({ data }),
  setError:    (error)    => set({ error }),
  setLocation: (location) => set({ location }),
  tickClock:   ()         => set({ clockTime: Date.now() }),
}));
