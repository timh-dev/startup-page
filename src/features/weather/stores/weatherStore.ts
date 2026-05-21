import { create } from "zustand";
import type { ForecastDay, WeatherData } from "@/features/weather/types/weather";

export interface SelectedWeatherDay {
  day: ForecastDay;
  unit: "imperial" | "metric";
  mode: "bars" | "lines";
}

interface WeatherStore {
  data: WeatherData | null;
  error: string | null;
  location: string;
  clockTime: number;
  selectedDay: SelectedWeatherDay | null;
  setData: (data: WeatherData) => void;
  setError: (error: string) => void;
  setLocation: (location: string) => void;
  setSelectedDay: (selectedDay: SelectedWeatherDay | null) => void;
  tickClock: () => void;
}

export const useWeatherStore = create<WeatherStore>((set) => ({
  data: null,
  error: null,
  location: "Weather",
  clockTime: Date.now(),
  selectedDay: null,
  setData:     (data)     => set({ data }),
  setError:    (error)    => set({ error }),
  setLocation: (location) => set({ location }),
  setSelectedDay: (selectedDay) => set({ selectedDay }),
  tickClock:   ()         => set({ clockTime: Date.now() }),
}));
