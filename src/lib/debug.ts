// The dashboard debugger: pretend it's another time or another place, and
// every time- and place-aware card follows (clock, solar chart, weather, air
// quality, globe).
//
// Time is an offset from the real clock, so it keeps running from the moment
// you pick. Only the cards read it (via debugNow): sync timestamps, caches and
// sign-in tokens keep the real clock, which shifting would break.
//
// Stored on this device only; never synced or exported.
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface DebugLocation {
  label: string;
  latitude: number;
  longitude: number;
  /** IANA time zone, so clocks show the place's local time. */
  timeZone?: string;
}

/** Places that make good tests: polar day/night, the equator, the far side. */
export const DEBUG_PLACES: DebugLocation[] = [
  { label: "Chicago", latitude: 41.88, longitude: -87.63, timeZone: "America/Chicago" },
  { label: "Utqiaġvik, Alaska", latitude: 71.29, longitude: -156.79, timeZone: "America/Anchorage" },
  { label: "Reykjavík", latitude: 64.15, longitude: -21.94, timeZone: "Atlantic/Reykjavik" },
  { label: "Quito", latitude: -0.18, longitude: -78.47, timeZone: "America/Guayaquil" },
  { label: "London", latitude: 51.51, longitude: -0.13, timeZone: "Europe/London" },
  { label: "Tokyo", latitude: 35.68, longitude: 139.69, timeZone: "Asia/Tokyo" },
  { label: "Sydney", latitude: -33.87, longitude: 151.21, timeZone: "Australia/Sydney" },
  { label: "Cape Town", latitude: -33.92, longitude: 18.42, timeZone: "Africa/Johannesburg" },
];

interface DebugState {
  panelOpen: boolean;
  /** Milliseconds added to the real clock. */
  timeOffsetMs: number;
  location: DebugLocation | null;
  setPanelOpen: (open: boolean) => void;
  /** Show this moment (time runs on from it), or null for the real time. */
  setTime: (moment: Date | null) => void;
  setLocation: (location: DebugLocation | null) => void;
  reset: () => void;
}

export const useDebugStore = create<DebugState>()(
  persist(
    (set) => ({
      panelOpen: false,
      timeOffsetMs: 0,
      location: null,
      setPanelOpen: (panelOpen) => set({ panelOpen }),
      setTime: (moment) => set({ timeOffsetMs: moment ? moment.getTime() - Date.now() : 0 }),
      setLocation: (location) => set({ location }),
      reset: () => set({ timeOffsetMs: 0, location: null }),
    }),
    { name: "startup-page.debug" },
  ),
);

/** "Now" for the cards: the real clock, shifted by the debugger. */
export function debugNow(): Date {
  return new Date(Date.now() + useDebugStore.getState().timeOffsetMs);
}

export function debugNowMs(): number {
  return Date.now() + useDebugStore.getState().timeOffsetMs;
}

/** The debugger's location, if one is set. */
export function debugLocation(): DebugLocation | null {
  return useDebugStore.getState().location;
}

/** The time zone the cards should show: the debug place's, else the browser's. */
export function debugTimeZone(): string | undefined {
  return useDebugStore.getState().location?.timeZone;
}

export function isDebugging(state: Pick<DebugState, "timeOffsetMs" | "location">) {
  return Math.abs(state.timeOffsetMs) > 1000 || state.location !== null;
}

export interface WallClock {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Offset from UTC in hours at this moment. */
  offsetHours: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/** Local date and time at a moment, in a time zone (the browser's if omitted). */
export function wallClock(date: Date, timeZone?: string): WallClock {
  if (!timeZone) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hours: date.getHours(),
      minutes: date.getMinutes(),
      seconds: date.getSeconds(),
      offsetHours: -date.getTimezoneOffset() / 60,
    };
  }
  let format = formatters.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(timeZone, format);
  }
  const parts = Object.fromEntries(format.formatToParts(date).map((part) => [part.type, part.value]));
  const clock = {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hours: Number(parts.hour) % 24,
    minutes: Number(parts.minute),
    seconds: Number(parts.second),
  };
  const asUtc = Date.UTC(clock.year, clock.month - 1, clock.day, clock.hours, clock.minutes, clock.seconds);
  return { ...clock, offsetHours: Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60_000) / 60 };
}

/** The moment when the clock on the wall in a time zone reads this date and time. */
export function fromWallClock(year: number, month: number, day: number, hours: number, minutes: number, timeZone?: string): Date {
  if (!timeZone) return new Date(year, month - 1, day, hours, minutes);
  const guess = Date.UTC(year, month - 1, day, hours, minutes);
  // One correction step handles the zone's offset (and DST at the guess).
  const offset = wallClock(new Date(guess), timeZone).offsetHours;
  const moment = guess - offset * 3_600_000;
  const settled = wallClock(new Date(moment), timeZone).offsetHours;
  return new Date(guess - settled * 3_600_000);
}
