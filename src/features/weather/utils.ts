import {
  OPEN_METEO_CODES,
  CONDITION_GRADIENTS,
  SHADER_COLORS,
  DAY_NAMES,
} from "./constants";
import type {
  WeatherCondition,
  CloudCoverage,
  WeatherData,
  ForecastDay,
  HourlyForecastPoint,
  ResolvedWeather,
  TimeKey,
  WeatherVisualProfile,
} from "./types";

export function getConditionCategory(weather: string): WeatherCondition {
  if (weather in CONDITION_GRADIENTS) return weather as WeatherCondition;
  return "Clouds";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getTimePhase(data: WeatherData, currentTime = Date.now()): number {
  const sunrise = data.daily?.sunrise?.[0] ? new Date(data.daily.sunrise[0]).getTime() : null;
  const sunset  = data.daily?.sunset?.[0]  ? new Date(data.daily.sunset[0]).getTime()  : null;
  const twilightBand = 30 * 60 * 1000;
  const sunriseAfterglow = 45 * 60 * 1000;
  const sunsetLeadWindow = 45 * 60 * 1000;

  if (sunrise && currentTime < sunrise) {
    const astroDawn = sunrise - twilightBand * 3;
    const nauticalDawn = sunrise - twilightBand * 2;
    const civilDawn = sunrise - twilightBand;

    if (currentTime < astroDawn) return 2;
    if (currentTime < nauticalDawn) {
      return 2 - clamp((currentTime - astroDawn) / twilightBand, 0, 1) * 0.2;
    }
    if (currentTime < civilDawn) {
      return 1.8 - clamp((currentTime - nauticalDawn) / twilightBand, 0, 1) * 0.35;
    }
    return 1.45 - clamp((currentTime - civilDawn) / twilightBand, 0, 1) * 0.45;
  }
  if (sunrise && currentTime < sunrise + sunriseAfterglow) {
    return 1 - clamp((currentTime - sunrise) / sunriseAfterglow, 0, 1);
  }
  if (sunset && currentTime < sunset) {
    return currentTime >= sunset - sunsetLeadWindow
      ? clamp((currentTime - (sunset - sunsetLeadWindow)) / sunsetLeadWindow, 0, 1)
      : 0;
  }
  if (sunset) {
    const civilDusk = sunset + twilightBand;
    const nauticalDusk = sunset + twilightBand * 2;
    const astroDusk = sunset + twilightBand * 3;

    if (currentTime < civilDusk) {
      return 1 + clamp((currentTime - sunset) / twilightBand, 0, 1) * 0.45;
    }
    if (currentTime < nauticalDusk) {
      return 1.45 + clamp((currentTime - civilDusk) / twilightBand, 0, 1) * 0.35;
    }
    if (currentTime < astroDusk) {
      return 1.8 + clamp((currentTime - nauticalDusk) / twilightBand, 0, 1) * 0.2;
    }
    return 2;
  }
  if (sunrise && sunset) {
    return currentTime < sunrise || currentTime >= sunset ? 2 : 0;
  }
  return data.current?.is_day === 0 ? 2 : 0;
}

function getSkyDarkness(timePhase: number, condition: WeatherCondition): number {
  const base = timePhase <= 1
    ? timePhase * 0.2
    : 0.2 + (timePhase - 1) * 0.3;

  const conditionBoost =
    condition === "Thunderstorm" ? 0.12 :
    condition === "Rain" || condition === "Drizzle" ? 0.08 :
    condition === "Fog" ? 0.04 :
    0;

  return clamp(base + conditionBoost, 0, 0.58);
}

function getHorizonGlow(timePhase: number): number {
  return Math.max(0, 1 - Math.abs(timePhase - 1) / 0.8);
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}

function getAuroraIntensity(clockTime: number): number {
  const date = new Date(clockTime);
  const hour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;

  if (hour >= 21) return 0.72 + smoothstep(22, 22.5, hour) * 0.28;
  if (hour <= 2) return 1 - smoothstep(1.5, 2, hour) * 0.28;
  return 0;
}

// Seven stops aligned to the WebGL shader's phase breakpoints.
// Each tuple: [zenith, mid-sky, horizon] (rendered top-left → bottom-right at 135deg)
// Phases:  day(0.0) → golden(0.85) → sunset(1.0) → civil(1.18) → nautical(1.45) → astronomical(1.80) → night(2.0)
//
// Civil     = first 30 min after sunset / before sunrise. Sun 0-6° below horizon.
//             "Blue hour" in photography — Belt of Venus at horizon, deep blue above.
// Nautical  = 30-60 min offset. Sun 6-12° below. Horizon still visible for navigation.
//             Deep blue-indigo, no orange left, first planets visible.
// Astronomical = 60-90 min offset. Sun 12-18° below. Sky nearly dark; faint horizon glow only.
//             Most stars visible. Sky is navy to near-black.
type GradientStops = {
  day:          [string, string, string]; // phase 0.0  — midday
  golden:       [string, string, string]; // phase 0.85 — golden hour, sun near horizon
  sunset:       [string, string, string]; // phase 1.0  — sun at horizon, peak colour
  civil:        [string, string, string]; // phase 1.18 — civil twilight / blue hour
  nautical:     [string, string, string]; // phase 1.45 — nautical twilight
  astronomical: [string, string, string]; // phase 1.80 — astronomical twilight
  night:        [string, string, string]; // phase 2.0  — full astronomical night
};

const SKY_GRADIENT_COLORS: Record<WeatherCondition, GradientStops> = {
  Clear: {
    // [zenith, mid-sky, horizon]
    day:          ["#0c3a8a", "#0ea5e9", "#bae6fd"],  // deep cobalt → sky blue → pale horizon
    golden:       ["#1a1050", "#f97316", "#fcd34d"],  // indigo zenith → orange → warm amber
    sunset:       ["#4a1080", "#dc2626", "#fb923c"],  // deep purple → crimson → orange
    // Civil / blue hour: Belt of Venus at horizon (pink-mauve), deep cobalt above
    civil:        ["#09093a", "#1e3a8a", "#818cf8"],  // dark indigo → navy → periwinkle/mauve horizon
    // Nautical: deep blue horizon, near-black zenith, first stars
    nautical:     ["#05050f", "#0d1535", "#1a2d6a"],  // near-black → very dark navy
    // Astronomical: faintest blue trace at horizon, otherwise dark
    astronomical: ["#03040c", "#07091a", "#0d1428"],  // near-black with faint navy horizon
    night:        ["#020617", "#050f20", "#0d1b35"],  // deep night sky
  },
  Clouds: {
    day:          ["#1e2d3d", "#334155", "#64748b"],  // steel-gray overcast
    golden:       ["#1c1228", "#6b3518", "#a0602a"],  // muted purple-brown warmth
    sunset:       ["#2d1042", "#6b1a1a", "#803018"],  // dark purple-maroon
    // Civil: clouds kill the Belt of Venus — dark blue-gray replaces the colour
    civil:        ["#0d0d22", "#1a1f40", "#2d3660"],  // dark steel-blue
    nautical:     ["#07070f", "#0e1020", "#17202e"],  // near-black, cold steel
    astronomical: ["#040408", "#07080f", "#0e1018"],  // almost black
    night:        ["#020617", "#0a0a18", "#111827"],
  },
  Rain: {
    day:          ["#1a2535", "#273448", "#3d5066"],  // dark steel-blue overcast
    golden:       ["#181028", "#4a2818", "#6b3c18"],  // very muted, dark warm-gray
    sunset:       ["#1a0f28", "#3d1c18", "#5b2e10"],  // bruised dark
    // Civil under rain: cold and dark, thin orange-gray horizon
    civil:        ["#080818", "#10142a", "#1c2440"],  // dark charcoal-blue
    nautical:     ["#05050e", "#080a18", "#101520"],
    astronomical: ["#03030a", "#060810", "#0c1018"],
    night:        ["#020617", "#050a18", "#0f1624"],
  },
  Drizzle: {
    day:          ["#22303f", "#334155", "#556880"],  // medium steel-gray
    golden:       ["#1c1430", "#5c3820", "#826030"],  // muted amber-brown
    sunset:       ["#221030", "#542020", "#6e3820"],
    civil:        ["#0a0a1e", "#141838", "#202e4a"],  // dark navy-gray
    nautical:     ["#06060e", "#0c0e1e", "#14182a"],
    astronomical: ["#030308", "#06070e", "#0c0e16"],
    night:        ["#020617", "#080f1e", "#101828"],
  },
  Snow: {
    day:          ["#a8c8f0", "#d0e8f8", "#f0f8ff"],  // icy pale blue-white
    golden:       ["#d4c0e0", "#f0c898", "#f8dca8"],  // soft lilac/peach snowscape
    sunset:       ["#c0a0d8", "#e0a890", "#f0b890"],  // lavender to warm peach
    // Civil under snow: blue hour takes on an ethereal quality, snow glows faintly
    civil:        ["#4858a0", "#6878b8", "#9ab0d8"],  // cool periwinkle-blue (snow reflects sky)
    nautical:     ["#283558", "#344870", "#465c88"],  // dark slate-blue
    astronomical: ["#141e38", "#1c2848", "#263458"],  // very dark but snow scene stays bluer
    night:        ["#0f172a", "#172554", "#1e3a8a"],  // deep indigo — snow still glows moonlit
  },
  Thunderstorm: {
    day:          ["#111827", "#1f2937", "#374151"],  // very dark gray
    golden:       ["#181020", "#2e1818", "#402010"],  // near-black, bruised purple
    sunset:       ["#0f0818", "#1e0a10", "#2e1010"],
    civil:        ["#08080f", "#0f0f1e", "#181628"],  // near-black, eerie
    nautical:     ["#050508", "#08080e", "#0e0e16"],
    astronomical: ["#030306", "#05050a", "#08080e"],
    night:        ["#020617", "#030310", "#111827"],
  },
  Fog: {
    day:          ["#c8d0da", "#d8e0e8", "#eaeff4"],  // white/light silver-gray
    golden:       ["#c0b0b8", "#dcc898", "#ead8a8"],  // warm misty gold
    sunset:       ["#b8a0b0", "#d09080", "#e0a070"],  // warm peachy fog
    // Civil fog: the "blue hour fog" — hauntingly beautiful steel-blue
    civil:        ["#7080a0", "#8898b4", "#a0b0cc"],  // steel-blue fog, eerie glow
    nautical:     ["#485868", "#586878", "#6a7888"],  // dark gray fog, lit from below
    astronomical: ["#343c48", "#404850", "#4e5860"],  // very dark gray fog
    night:        ["#2a3848", "#384858", "#485868"],  // night fog, dark blue-gray
  },
};

// Phase breakpoints aligned to getTimePhase() civil/nautical/astronomical bands
const PHASE_STOPS = [0.0, 0.85, 1.0, 1.18, 1.45, 1.80, 2.0] as const;
const STOP_KEYS: (keyof GradientStops)[] = ["day", "golden", "sunset", "civil", "nautical", "astronomical", "night"];

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function mixHex(from: string, to: string, amount: number): string {
  const start = hexToRgb(from);
  const end = hexToRgb(to);
  const mixed = start.map((channel, index) => {
    const value = channel + (end[index] - channel) * amount;
    return Math.round(value).toString(16).padStart(2, "0");
  });
  return `#${mixed.join("")}`;
}

function getSkyGradient(condition: WeatherCondition, timePhase: number): string {
  const stops = SKY_GRADIENT_COLORS[condition] ?? SKY_GRADIENT_COLORS.Clouds;

  // Find the segment the current phase falls in
  let segIdx = PHASE_STOPS.length - 2;
  for (let i = 0; i < PHASE_STOPS.length - 1; i++) {
    if (timePhase <= PHASE_STOPS[i + 1]) { segIdx = i; break; }
  }

  const fromKey = STOP_KEYS[segIdx];
  const toKey   = STOP_KEYS[segIdx + 1];
  const t0 = PHASE_STOPS[segIdx], t1 = PHASE_STOPS[segIdx + 1];
  const raw = clamp((timePhase - t0) / (t1 - t0), 0, 1);
  // Smoothstep for natural easing between stops
  const smoothT = raw * raw * (3 - 2 * raw);

  const from = stops[fromKey];
  const to   = stops[toKey];
  const colors = from.map((c, i) => mixHex(c, to[i], smoothT));

  return `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 52%, ${colors[2]} 100%)`;
}

function formatHourLabel(time: string): string {
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric" });
}

function getHourlyForecast(data: WeatherData, date: string): HourlyForecastPoint[] {
  const times = data.hourly?.time ?? [];

  return times.reduce<HourlyForecastPoint[]>((hours, time, index) => {
    if (!time.startsWith(date)) return hours;

    hours.push({
      time,
      hourLabel: formatHourLabel(time),
      humidity: data.hourly?.relative_humidity_2m?.[index] ?? null,
      uvIndex: data.hourly?.uv_index?.[index] ?? null,
      windSpeed: data.hourly?.wind_speed_10m?.[index] ?? null,
      windDirection: data.hourly?.wind_direction_10m?.[index] ?? null,
      precipitationProbability: data.hourly?.precipitation_probability?.[index] ?? null,
      precipitation: data.hourly?.precipitation?.[index] ?? null,
    });

    return hours;
  }, []);
}

function makeVisualProfile(
  weatherId: number,
  overrides: Partial<WeatherVisualProfile>
): WeatherVisualProfile {
  return {
    weatherId,
    cloudStyle: "stratocumulus",
    precipitationStyle: "none",
    atmosphereStyle: "none",
    precipitationIntensity: 0,
    atmosphereIntensity: 0,
    lightningIntensity: 0,
    windIntensity: 0.15,
    visibility: 1,
    surfaceWetness: 0,
    skyTint: "neutral",
    cloudContrast: 0.5,
    promptKeywords: [],
    ...overrides,
  };
}

function getOpenWeatherVisualProfile(weatherId: number): WeatherVisualProfile {
  const thunderstormBase = {
    cloudStyle: "cumulonimbus" as const,
    precipitationStyle: "rain" as const,
    atmosphereStyle: "mist" as const,
    precipitationIntensity: 0.56,
    atmosphereIntensity: 0.26,
    lightningIntensity: 0.58,
    windIntensity: 0.58,
    visibility: 0.62,
    surfaceWetness: 0.72,
    skyTint: "blue-gray",
    cloudContrast: 0.86,
    promptKeywords: ["cumulonimbus", "electric", "wet reflections", "rain shafts"],
  };

  const profiles: Record<number, Partial<WeatherVisualProfile>> = {
    200: { ...thunderstormBase, precipitationIntensity: 0.34, lightningIntensity: 0.38, windIntensity: 0.42, visibility: 0.74, promptKeywords: ["light rain", "distant lightning", "cumulonimbus calvus"] },
    201: thunderstormBase,
    202: { ...thunderstormBase, cloudStyle: "supercell", precipitationStyle: "heavy-rain", precipitationIntensity: 1, lightningIntensity: 0.95, windIntensity: 0.9, visibility: 0.28, surfaceWetness: 1, cloudContrast: 1, promptKeywords: ["torrential rain", "anvil cloud", "white lightning flashes", "flooded surfaces"] },
    210: { ...thunderstormBase, precipitationStyle: "none", precipitationIntensity: 0.08, lightningIntensity: 0.32, windIntensity: 0.32, atmosphereIntensity: 0.12, visibility: 0.84, surfaceWetness: 0.15, promptKeywords: ["isolated storm cell", "developing cumulonimbus", "humid air"] },
    211: { ...thunderstormBase, precipitationIntensity: 0.62, lightningIntensity: 0.68, promptKeywords: ["classic thunderstorm", "cumulonimbus incus", "rolling thunder"] },
    212: { ...thunderstormBase, cloudStyle: "supercell", precipitationStyle: "heavy-rain", precipitationIntensity: 0.92, lightningIntensity: 1, windIntensity: 0.95, visibility: 0.36, skyTint: "green-gray", cloudContrast: 1, promptKeywords: ["supercell", "greenish sky", "rotating cloud base", "violent energy"] },
    221: { ...thunderstormBase, cloudStyle: "supercell", precipitationStyle: "shower-rain", precipitationIntensity: 0.62, lightningIntensity: 0.62, windIntensity: 0.72, visibility: 0.55, promptKeywords: ["ragged storm cells", "irregular rain bands", "turbulent layers"] },
    230: { ...thunderstormBase, precipitationStyle: "drizzle", precipitationIntensity: 0.28, atmosphereIntensity: 0.48, lightningIntensity: 0.34, visibility: 0.52, promptKeywords: ["misty thunderstorm", "fine drizzle", "blue gray haze"] },
    231: { ...thunderstormBase, precipitationStyle: "drizzle", precipitationIntensity: 0.38, atmosphereIntensity: 0.56, lightningIntensity: 0.46, visibility: 0.46, promptKeywords: ["embedded cumulonimbus", "wet haze", "drizzle storm"] },
    232: { ...thunderstormBase, precipitationStyle: "drizzle", precipitationIntensity: 0.48, atmosphereIntensity: 0.64, lightningIntensity: 0.56, visibility: 0.38, promptKeywords: ["heavy drizzle storm", "foggy lightning", "low visibility"] },

    300: { cloudStyle: "stratus", precipitationStyle: "drizzle", precipitationIntensity: 0.16, atmosphereStyle: "mist", atmosphereIntensity: 0.22, visibility: 0.82, surfaceWetness: 0.34, skyTint: "cool-gray", cloudContrast: 0.24, promptKeywords: ["light drizzle", "stratus", "muted lighting"] },
    301: { cloudStyle: "stratus", precipitationStyle: "drizzle", precipitationIntensity: 0.28, atmosphereStyle: "mist", atmosphereIntensity: 0.34, visibility: 0.74, surfaceWetness: 0.46, skyTint: "cool-gray", cloudContrast: 0.28, promptKeywords: ["steady mist rain", "low cloud ceiling", "diffuse light"] },
    302: { cloudStyle: "nimbostratus", precipitationStyle: "drizzle", precipitationIntensity: 0.46, atmosphereStyle: "mist", atmosphereIntensity: 0.52, visibility: 0.58, surfaceWetness: 0.72, skyTint: "cool-gray", cloudContrast: 0.34, promptKeywords: ["dense drizzle", "thick nimbostratus", "wet sheen"] },
    310: { cloudStyle: "nimbostratus", precipitationStyle: "drizzle", precipitationIntensity: 0.34, atmosphereStyle: "mist", atmosphereIntensity: 0.36, visibility: 0.68, surfaceWetness: 0.58, skyTint: "cool-gray", cloudContrast: 0.36, promptKeywords: ["drizzle rain mix", "windshield blur", "urban reflections"] },
    311: { cloudStyle: "nimbostratus", precipitationStyle: "drizzle", precipitationIntensity: 0.42, atmosphereStyle: "mist", atmosphereIntensity: 0.4, visibility: 0.64, surfaceWetness: 0.66, skyTint: "cool-gray", cloudContrast: 0.38, promptKeywords: ["drizzle rain", "solid overcast", "visible fine rain"] },
    312: { cloudStyle: "nimbostratus", precipitationStyle: "rain", precipitationIntensity: 0.58, atmosphereStyle: "mist", atmosphereIntensity: 0.46, visibility: 0.56, surfaceWetness: 0.78, skyTint: "cool-gray", cloudContrast: 0.42, promptKeywords: ["heavy drizzle rain", "wet reflections", "soft visibility"] },
    313: { cloudStyle: "nimbostratus", precipitationStyle: "shower-rain", precipitationIntensity: 0.5, atmosphereStyle: "mist", atmosphereIntensity: 0.42, windIntensity: 0.38, visibility: 0.62, surfaceWetness: 0.68, skyTint: "blue-gray", cloudContrast: 0.5, promptKeywords: ["showers and drizzle", "convective pockets", "variable visibility"] },
    314: { cloudStyle: "nimbostratus", precipitationStyle: "shower-rain", precipitationIntensity: 0.68, atmosphereStyle: "mist", atmosphereIntensity: 0.5, windIntensity: 0.46, visibility: 0.5, surfaceWetness: 0.82, skyTint: "blue-gray", cloudContrast: 0.58, promptKeywords: ["heavy shower drizzle", "dark patches", "uneven rain intensity"] },
    321: { cloudStyle: "stratus", precipitationStyle: "drizzle", precipitationIntensity: 0.24, atmosphereStyle: "mist", atmosphereIntensity: 0.24, windIntensity: 0.28, visibility: 0.78, surfaceWetness: 0.42, skyTint: "silver-gray", cloudContrast: 0.34, promptKeywords: ["passing drizzle bands", "broken stratus", "silver cloud edges"] },

    500: { cloudStyle: "nimbostratus", precipitationStyle: "rain", precipitationIntensity: 0.34, atmosphereStyle: "mist", atmosphereIntensity: 0.18, visibility: 0.78, surfaceWetness: 0.52, skyTint: "medium-gray", cloudContrast: 0.38, promptKeywords: ["light rain", "nimbostratus", "soft reflections"] },
    501: { cloudStyle: "nimbostratus", precipitationStyle: "rain", precipitationIntensity: 0.52, atmosphereStyle: "mist", atmosphereIntensity: 0.28, visibility: 0.66, surfaceWetness: 0.72, skyTint: "dark-gray", cloudContrast: 0.46, promptKeywords: ["moderate rain", "street puddles", "muted colors"] },
    502: { cloudStyle: "nimbostratus", precipitationStyle: "heavy-rain", precipitationIntensity: 0.76, atmosphereStyle: "mist", atmosphereIntensity: 0.38, windIntensity: 0.48, visibility: 0.48, surfaceWetness: 0.9, skyTint: "dark-gray", cloudContrast: 0.56, promptKeywords: ["heavy rain", "runoff streams", "wind ripples"] },
    503: { cloudStyle: "nimbostratus", precipitationStyle: "heavy-rain", precipitationIntensity: 0.9, atmosphereStyle: "mist", atmosphereIntensity: 0.5, windIntensity: 0.56, visibility: 0.34, surfaceWetness: 1, skyTint: "washed-gray", cloudContrast: 0.62, promptKeywords: ["very heavy rain", "rain curtains", "obscured distance"] },
    504: { cloudStyle: "nimbostratus", precipitationStyle: "heavy-rain", precipitationIntensity: 1, atmosphereStyle: "squall", atmosphereIntensity: 0.62, windIntensity: 0.72, visibility: 0.22, surfaceWetness: 1, skyTint: "white-gray", cloudContrast: 0.7, promptKeywords: ["extreme rain", "flooding streets", "barely visible skyline"] },
    511: { cloudStyle: "nimbostratus", precipitationStyle: "freezing-rain", precipitationIntensity: 0.54, atmosphereStyle: "mist", atmosphereIntensity: 0.24, visibility: 0.6, surfaceWetness: 0.88, skyTint: "cold-blue", cloudContrast: 0.42, promptKeywords: ["freezing rain", "icy glaze", "glossy roads"] },
    520: { cloudStyle: "stratocumulus", precipitationStyle: "shower-rain", precipitationIntensity: 0.34, atmosphereStyle: "none", windIntensity: 0.32, visibility: 0.78, surfaceWetness: 0.5, skyTint: "blue-gray", cloudContrast: 0.58, promptKeywords: ["light shower rain", "localized rain shafts", "sky gaps"] },
    521: { cloudStyle: "stratocumulus", precipitationStyle: "shower-rain", precipitationIntensity: 0.52, windIntensity: 0.42, visibility: 0.68, surfaceWetness: 0.66, skyTint: "blue-gray", cloudContrast: 0.62, promptKeywords: ["shower rain", "broken clouds", "sunlight gaps"] },
    522: { cloudStyle: "cumulonimbus", precipitationStyle: "shower-rain", precipitationIntensity: 0.78, windIntensity: 0.58, visibility: 0.48, surfaceWetness: 0.86, skyTint: "blue-gray", cloudContrast: 0.76, promptKeywords: ["heavy shower rain", "convective bursts", "dynamic contrast"] },
    531: { cloudStyle: "cumulonimbus", precipitationStyle: "shower-rain", precipitationIntensity: 0.72, windIntensity: 0.68, visibility: 0.5, surfaceWetness: 0.82, skyTint: "blue-gray", cloudContrast: 0.82, promptKeywords: ["ragged shower rain", "fragmented cells", "chaotic rain"] },

    600: { cloudStyle: "stratus", precipitationStyle: "snow", precipitationIntensity: 0.24, atmosphereStyle: "mist", atmosphereIntensity: 0.16, visibility: 0.82, surfaceWetness: 0.12, skyTint: "pale-cold", cloudContrast: 0.22, promptKeywords: ["light snow", "quiet atmosphere", "gentle accumulation"] },
    601: { cloudStyle: "nimbostratus", precipitationStyle: "snow", precipitationIntensity: 0.46, atmosphereStyle: "mist", atmosphereIntensity: 0.24, visibility: 0.66, surfaceWetness: 0.18, skyTint: "pale-cold", cloudContrast: 0.3, promptKeywords: ["steady snowfall", "snow coated trees", "low contrast"] },
    602: { cloudStyle: "nimbostratus", precipitationStyle: "heavy-snow", precipitationIntensity: 0.9, atmosphereStyle: "mist", atmosphereIntensity: 0.5, windIntensity: 0.58, visibility: 0.32, surfaceWetness: 0.22, skyTint: "whiteout", cloudContrast: 0.2, promptKeywords: ["heavy snow", "large flakes", "whiteout"] },
    611: { cloudStyle: "nimbostratus", precipitationStyle: "sleet", precipitationIntensity: 0.48, atmosphereStyle: "mist", atmosphereIntensity: 0.26, visibility: 0.62, surfaceWetness: 0.72, skyTint: "cold-gray", cloudContrast: 0.34, promptKeywords: ["sleet", "slushy surfaces", "cold wet atmosphere"] },
    612: { cloudStyle: "stratocumulus", precipitationStyle: "sleet", precipitationIntensity: 0.42, atmosphereStyle: "mist", atmosphereIntensity: 0.24, windIntensity: 0.42, visibility: 0.66, surfaceWetness: 0.64, skyTint: "cold-gray", cloudContrast: 0.48, promptKeywords: ["light shower sleet", "mixed precipitation", "gust motion"] },
    613: { cloudStyle: "stratocumulus", precipitationStyle: "sleet", precipitationIntensity: 0.54, atmosphereStyle: "mist", atmosphereIntensity: 0.3, windIntensity: 0.5, visibility: 0.56, surfaceWetness: 0.72, skyTint: "cold-gray", cloudContrast: 0.52, promptKeywords: ["shower sleet", "icy bands", "unstable winter clouds"] },
    615: { cloudStyle: "nimbostratus", precipitationStyle: "sleet", precipitationIntensity: 0.46, atmosphereStyle: "mist", atmosphereIntensity: 0.26, visibility: 0.62, surfaceWetness: 0.78, skyTint: "gray-winter", cloudContrast: 0.34, promptKeywords: ["light rain and snow", "slush", "melting flakes"] },
    616: { cloudStyle: "nimbostratus", precipitationStyle: "sleet", precipitationIntensity: 0.58, atmosphereStyle: "mist", atmosphereIntensity: 0.32, visibility: 0.52, surfaceWetness: 0.86, skyTint: "gray-winter", cloudContrast: 0.38, promptKeywords: ["rain and snow", "heavy moisture", "wet roads"] },
    620: { cloudStyle: "stratocumulus", precipitationStyle: "snow", precipitationIntensity: 0.34, windIntensity: 0.32, visibility: 0.72, skyTint: "pale-cold", cloudContrast: 0.46, promptKeywords: ["light shower snow", "patchy visibility", "broken winter clouds"] },
    621: { cloudStyle: "stratocumulus", precipitationStyle: "snow", precipitationIntensity: 0.5, windIntensity: 0.42, visibility: 0.6, skyTint: "pale-cold", cloudContrast: 0.5, promptKeywords: ["shower snow", "localized snow bursts", "variable density"] },
    622: { cloudStyle: "cumulonimbus", precipitationStyle: "heavy-snow", precipitationIntensity: 0.86, atmosphereStyle: "mist", atmosphereIntensity: 0.42, windIntensity: 0.62, visibility: 0.36, skyTint: "whiteout", cloudContrast: 0.44, promptKeywords: ["heavy shower snow", "convective snow", "low visibility"] },

    701: { cloudStyle: "stratus", atmosphereStyle: "mist", atmosphereIntensity: 0.36, visibility: 0.68, skyTint: "soft-gray", cloudContrast: 0.18, promptKeywords: ["mist", "faded horizon", "soft diffusion"] },
    711: { cloudStyle: "stratus", atmosphereStyle: "smoke", atmosphereIntensity: 0.56, visibility: 0.5, skyTint: "smoky-orange", cloudContrast: 0.14, promptKeywords: ["smoke", "orange diffusion", "air quality distortion"] },
    721: { cloudStyle: "stratus", atmosphereStyle: "haze", atmosphereIntensity: 0.42, visibility: 0.58, skyTint: "washed-pale", cloudContrast: 0.12, promptKeywords: ["haze", "washed atmosphere", "sun glow bloom"] },
    731: { cloudStyle: "stratus", atmosphereStyle: "dust", atmosphereIntensity: 0.66, windIntensity: 0.54, visibility: 0.38, skyTint: "dust-tan", cloudContrast: 0.16, promptKeywords: ["dust", "desert atmosphere", "warm earth tones"] },
    741: { cloudStyle: "stratus", atmosphereStyle: "fog", atmosphereIntensity: 0.78, visibility: 0.22, skyTint: "fog-gray", cloudContrast: 0.08, promptKeywords: ["fog", "ground stratus", "soft silhouettes"] },
    751: { cloudStyle: "stratus", atmosphereStyle: "sand", atmosphereIntensity: 0.62, windIntensity: 0.48, visibility: 0.42, skyTint: "sand-gold", cloudContrast: 0.14, promptKeywords: ["sand haze", "golden brown sky", "harsh diffusion"] },
    761: { cloudStyle: "stratus", atmosphereStyle: "dust", atmosphereIntensity: 0.62, windIntensity: 0.5, visibility: 0.42, skyTint: "dust-tan", cloudContrast: 0.14, promptKeywords: ["dust", "airborne particles", "reduced visibility"] },
    762: { cloudStyle: "stratus", atmosphereStyle: "ash", atmosphereIntensity: 0.74, windIntensity: 0.32, visibility: 0.32, skyTint: "ash-gray", cloudContrast: 0.22, promptKeywords: ["volcanic ash", "gray black skies", "ash particles"] },
    771: { cloudStyle: "cumulonimbus", precipitationStyle: "shower-rain", precipitationIntensity: 0.54, atmosphereStyle: "squall", atmosphereIntensity: 0.54, windIntensity: 1, visibility: 0.42, surfaceWetness: 0.62, skyTint: "blue-gray", cloudContrast: 0.74, promptKeywords: ["squalls", "horizontal precipitation", "fast moving low clouds"] },
    781: { cloudStyle: "supercell", precipitationStyle: "heavy-rain", precipitationIntensity: 0.72, atmosphereStyle: "tornado", atmosphereIntensity: 0.64, lightningIntensity: 0.72, windIntensity: 1, visibility: 0.28, surfaceWetness: 0.78, skyTint: "green-black", cloudContrast: 1, promptKeywords: ["tornado", "rotating funnel", "debris rotation", "supercell"] },

    800: { cloudStyle: "clear", atmosphereStyle: "none", visibility: 1, skyTint: "clear", cloudContrast: 0, windIntensity: 0.1, promptKeywords: ["clear sky", "crisp visibility", "sharp shadows"] },
    801: { cloudStyle: "cumulus", atmosphereStyle: "none", visibility: 0.96, skyTint: "clear", cloudContrast: 0.38, windIntensity: 0.16, promptKeywords: ["few clouds", "fair weather cumulus", "bright sunlight"] },
    802: { cloudStyle: "cumulus", atmosphereStyle: "none", visibility: 0.92, skyTint: "clear", cloudContrast: 0.48, windIntensity: 0.22, promptKeywords: ["scattered clouds", "cumulus mediocris", "sun and shade"] },
    803: { cloudStyle: "stratocumulus", atmosphereStyle: "none", visibility: 0.84, skyTint: "blue-gray", cloudContrast: 0.64, windIntensity: 0.28, promptKeywords: ["broken clouds", "stratocumulus sheets", "sun beams"] },
    804: { cloudStyle: "stratus", atmosphereStyle: "haze", atmosphereIntensity: 0.18, visibility: 0.74, skyTint: "overcast-gray", cloudContrast: 0.26, windIntensity: 0.18, promptKeywords: ["overcast", "flat diffuse lighting", "complete cloud blanket"] },
  };

  return makeVisualProfile(weatherId, profiles[weatherId] ?? {});
}

function getOpenMeteoVisualProfile(weatherCode: number): WeatherVisualProfile {
  const openWeatherEquivalent =
    weatherCode === 0 || weatherCode === 1 ? 800 :
    weatherCode === 2 ? 802 :
    weatherCode === 3 ? 804 :
    weatherCode === 45 || weatherCode === 48 ? 741 :
    weatherCode >= 51 && weatherCode <= 57 ? 301 :
    weatherCode === 61 ? 500 :
    weatherCode === 63 ? 501 :
    weatherCode === 65 || weatherCode === 67 ? 502 :
    weatherCode === 71 || weatherCode === 73 || weatherCode === 77 ? 601 :
    weatherCode === 75 ? 602 :
    weatherCode === 80 ? 520 :
    weatherCode === 81 ? 521 :
    weatherCode === 82 ? 522 :
    weatherCode === 85 ? 621 :
    weatherCode === 86 ? 622 :
    weatherCode === 95 ? 211 :
    weatherCode === 96 || weatherCode === 99 ? 212 :
    804;

  return getOpenWeatherVisualProfile(openWeatherEquivalent);
}

export function getOpenWeatherCondition(weatherId: number, weatherMain: string): WeatherCondition {
  if (weatherId >= 200 && weatherId < 300) return "Thunderstorm";
  if (weatherId >= 300 && weatherId < 400) return "Drizzle";
  if (weatherId >= 500 && weatherId < 600) return "Rain";
  if (weatherId >= 600 && weatherId < 700) return "Snow";
  if (weatherId >= 700 && weatherId < 800) return "Fog";
  if (weatherId === 800) return "Clear";
  if (weatherId > 800) return "Clouds";
  return getConditionCategory(weatherMain);
}

/** Maps each OpenWeather condition ID to the best cloud coverage for the 3-D sim. */
export function getOpenWeatherCoverage(weatherId: number): CloudCoverage {
  // 2xx Thunderstorm
  if (weatherId >= 200 && weatherId < 300) return "storm";

  // 3xx Drizzle — always overcast
  if (weatherId >= 300 && weatherId < 400) return "full";

  // 5xx Rain
  if (weatherId === 500 || weatherId === 520) return "full";               // light / light showers
  if (weatherId === 502 || weatherId === 503 || weatherId === 504) return "storm"; // heavy / very heavy / extreme
  if (weatherId === 522 || weatherId === 531) return "storm";              // heavy shower / ragged
  if (weatherId >= 500 && weatherId < 600) return "full";                  // remaining moderate rain

  // 6xx Snow
  if (weatherId === 602 || weatherId === 622) return "storm";              // heavy snow / heavy shower snow
  if (weatherId >= 600 && weatherId < 700) return "full";

  // 7xx Atmosphere
  if (weatherId === 771 || weatherId === 781) return "storm";              // squall / tornado
  if (weatherId === 701 || weatherId === 721) return "partly";             // mist / haze
  if (weatherId >= 700 && weatherId < 800) return "full";                  // smoke, dust, fog, ash …

  // 800 Clear
  if (weatherId === 800) return "none";

  // 80x Clouds
  if (weatherId === 801 || weatherId === 802) return "partly";             // few / scattered
  if (weatherId === 803 || weatherId === 804) return "full";               // broken / overcast

  return "none";
}

/** Maps each Open-Meteo WMO code to the best cloud coverage for the 3-D sim. */
export function getOpenMeteoCoverage(weatherCode: number): CloudCoverage {
  if (weatherCode === 0 || weatherCode === 1) return "none";
  if (weatherCode === 2) return "partly";
  if (weatherCode === 3) return "full";
  if (weatherCode === 45 || weatherCode === 48) return "full";             // fog
  if (weatherCode === 51 || weatherCode === 53 || weatherCode === 55) return "full"; // drizzle
  if (weatherCode === 56 || weatherCode === 57) return "full";             // freezing drizzle
  if (weatherCode === 61 || weatherCode === 63) return "full";             // slight / moderate rain
  if (weatherCode === 65 || weatherCode === 67) return "storm";            // heavy rain
  if (weatherCode === 71 || weatherCode === 73 || weatherCode === 77) return "full"; // snow
  if (weatherCode === 75) return "storm";                                   // heavy snow
  if (weatherCode === 80 || weatherCode === 81) return "full";             // rain showers
  if (weatherCode === 82) return "storm";                                   // violent showers
  if (weatherCode === 85) return "full";                                    // slight snow showers
  if (weatherCode === 86) return "storm";                                   // heavy snow showers
  if (weatherCode === 95) return "storm";                                   // thunderstorm
  if (weatherCode === 96 || weatherCode === 99) return "storm";            // thunderstorm + hail
  return "none";
}

export function formatWeatherDescription(description: string | undefined): string {
  if (!description) return "Current conditions";
  return description.charAt(0).toUpperCase() + description.slice(1);
}

export function resolveWeather(
  data: WeatherData,
  clockTime: number
): ResolvedWeather {
  const weatherCode = data.current?.weather_code ?? 3;
  const ow = data.openWeather;
  const mapped = ow ?? OPEN_METEO_CODES[weatherCode] ?? { weather: "Clouds" as WeatherCondition, description: "Current conditions" };

  const condition = getConditionCategory(mapped.weather);
  const timePhase = getTimePhase(data, clockTime);
  const dayTime   = timePhase < 1.5;
  const timeKey: TimeKey = dayTime ? "day" : "night";

  const coverage: CloudCoverage = ow
    ? getOpenWeatherCoverage(ow.id)
    : getOpenMeteoCoverage(weatherCode);
  const visual = ow
    ? getOpenWeatherVisualProfile(ow.id)
    : getOpenMeteoVisualProfile(weatherCode);

  // For the VolumetricCloudscape phase prop
  const phase = coverage === "storm" ? "storm" : timePhase;

  const gradient     = CONDITION_GRADIENTS[condition]?.[timeKey] ?? CONDITION_GRADIENTS.Clouds.day;
  const skyGradient  = getSkyGradient(condition, timePhase);
  const shaderColors = SHADER_COLORS[condition]?.[timeKey]       ?? SHADER_COLORS.Clouds.day;

  const isHeavySnow = ow
    ? [602, 622].includes(ow.id)
    : [75, 86].includes(weatherCode);

  const shaderOpacity = condition === "Clear" && dayTime ? "opacity-[0.12]" : "opacity-[0.3]";
  const skyDarkness = getSkyDarkness(timePhase, condition);
  const horizonGlow = getHorizonGlow(timePhase);
  const auroraIntensity = condition === "Clear" && coverage === "none" && !dayTime
    ? getAuroraIntensity(clockTime)
    : 0;
  const showAurora = auroraIntensity > 0;

  // Dark text for bright daytime skies; light text at night and for dark-sky conditions
  const darkText =
    dayTime &&
    skyDarkness < 0.18 &&
    condition !== "Thunderstorm" &&
    condition !== "Rain" &&
    condition !== "Drizzle";

  const textColor      = darkText ? "text-slate-800" : "text-white";
  const textColorMuted = darkText ? "text-slate-600" : "text-white/70";

  const temperature = Math.round(ow?.temperature ?? data.current?.temperature_2m ?? 0);
  const unitLabel   = data.unit === "imperial" ? "F" : "C";
  const description = mapped.description;

  // Forecast
  const highs   = data.daily?.temperature_2m_max ?? [];
  const lows    = data.daily?.temperature_2m_min ?? [];
  const dates   = data.daily?.time ?? [];
  const precips = data.daily?.precipitation_probability_max ?? [];

  const forecastDays: ForecastDay[] = dates.map((date, i) => ({
    date,
    dayName: i === 0 ? "Today" : DAY_NAMES[new Date(date + "T00:00:00").getDay()],
    high: Math.round(highs[i] ?? 0),
    low:  Math.round(lows[i]  ?? highs[i] ?? 0),
    precip: precips[i] ?? 0,
    hourly: getHourlyForecast(data, date),
  }));

  const allTemps = [...lows, ...highs].filter(Number.isFinite);
  const rangeMin  = allTemps.length ? Math.min(...allTemps) : 0;
  const rangeMax  = allTemps.length ? Math.max(...allTemps) : 1;
  const rangeSpan = Math.max(rangeMax - rangeMin, 1);

  return {
    condition,
    coverage,
    phase,
    timePhase,
    dayTime,
    timeKey,
    temperature,
    unitLabel,
    description,
    gradient,
    skyGradient,
    shaderColors,
    shaderOpacity,
    skyDarkness,
    horizonGlow,
    showAurora,
    auroraIntensity,
    visual,
    darkText,
    textColor,
    textColorMuted,
    isHeavySnow,
    forecastDays,
    rangeMin,
    rangeMax,
    rangeSpan,
  };
}
