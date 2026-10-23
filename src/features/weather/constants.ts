import type { WeatherCondition } from "./types/weather";

export const CONDITION_GRADIENTS: Record<WeatherCondition, { day: string; night: string }> = {
  Clear:        { day: "from-sky-400 via-blue-500 to-blue-400",        night: "from-slate-950 via-indigo-950 to-slate-900" },
  Clouds:       { day: "from-slate-800 via-slate-900 to-gray-900",     night: "from-slate-800 via-slate-900 to-gray-900" },
  Rain:         { day: "from-slate-700 via-slate-800 to-gray-800",     night: "from-slate-950 via-gray-950 to-slate-900" },
  Drizzle:      { day: "from-slate-500 via-slate-600 to-gray-600",     night: "from-slate-900 via-gray-900 to-slate-950" },
  Snow:         { day: "from-white via-sky-50 to-blue-100",            night: "from-slate-800 via-blue-950 to-indigo-950" },
  Thunderstorm: { day: "from-gray-900 via-slate-800 to-purple-950",    night: "from-gray-950 via-slate-950 to-purple-950" },
  Fog:          { day: "from-gray-200 via-slate-300 to-gray-300",      night: "from-gray-800 via-slate-800 to-gray-700" },
};

export const SHADER_COLORS: Record<WeatherCondition, { day: [string, string, string]; night: [string, string, string] }> = {
  Clear:        { day: ["#38bdf8", "#0284c7", "#0ea5e9"], night: ["#1e1b4b", "#312e81", "#0f172a"] },
  Clouds:       { day: ["#475569", "#1f2937", "#111827"], night: ["#334155", "#1e293b", "#111827"] },
  Rain:         { day: ["#334155", "#1e293b", "#475569"], night: ["#0f172a", "#1e293b", "#020617"] },
  Drizzle:      { day: ["#475569", "#334155", "#64748b"], night: ["#1e293b", "#0f172a", "#334155"] },
  Snow:         { day: ["#e0f2fe", "#bae6fd", "#7dd3fc"], night: ["#1e3a5f", "#172554", "#1e293b"] },
  Thunderstorm: { day: ["#581c87", "#1f2937", "#374151"], night: ["#3b0764", "#111827", "#1e1b4b"] },
  Fog:          { day: ["#d1d5db", "#e5e7eb", "#9ca3af"], night: ["#374151", "#4b5563", "#334155"] },
};

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
