import { create } from "zustand";

import type { WeatherOverrides } from "@/features/weather/hooks/useWeatherData";
import type { WidgetInstance } from "@/lib/dashboard-dimensions";

// The day the weather cards are showing, picked from the standard card's
// forecast and followed by the frosted card (and the detail card) for the
// same place. Not saved: it holds until clicked again, and a reload goes
// back to today.

/** Cards share a focus when they show the same place: their own coordinates, or the app's. */
export function placeKey(overrides: Pick<WeatherOverrides, "lat" | "lon"> = {}): string {
  return overrides.lat != null && overrides.lon != null ? `${overrides.lat.toFixed(2)},${overrides.lon.toFixed(2)}` : "app";
}

interface DayFocusStore {
  /** Picked day ("2026-10-31") by place; missing means today. */
  days: Record<string, string>;
  setDay: (place: string, date: string | null) => void;
}

export const useDayFocusStore = create<DayFocusStore>((set) => ({
  days: {},
  setDay: (place, date) =>
    set((state) => {
      const days = { ...state.days };
      if (date) days[place] = date;
      else delete days[place];
      return { days };
    }),
}));

/** The day picked for a place, or null for today. */
export function useFocusedDay(place: string): string | null {
  return useDayFocusStore((state) => state.days[place] ?? null);
}

type ConfigWithPlace = { lat?: number | null; lon?: number | null };

/** Whether a frosted weather card for `place` is among these cards (stacks included): only then can another day be picked. */
export function hasFrostedCard(widgets: WidgetInstance[], place: string): boolean {
  return widgets.some(
    (widget) =>
      (widget.type === "weatherV2" && placeKey(widget.config as ConfigWithPlace) === place) ||
      (Array.isArray(widget.items) && hasFrostedCard(widget.items, place)),
  );
}
