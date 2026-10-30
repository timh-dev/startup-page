import type { Conditions, Precip } from "./timeline";

// The day bar's colours. The sky comes from the sun's height (warm light by
// day, gold, coral, pink and violet through dusk, navy at night); clouds,
// fog and precipitation are mixed over it. Blue is kept for water, so a
// clear day is never mistaken for rain.

export type Rgb = [number, number, number];

export const mix = (a: Rgb, b: Rgb, t: number): Rgb => {
  const k = Math.max(0, Math.min(1, t));
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
};

export const css = ([r, g, b]: Rgb, alpha = 1) =>
  alpha >= 1 ? `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})` : `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;

// ---- sky ---------------------------------------------------------------------

/** Sky colour by the sun's elevation in degrees (standard twilight bands). */
const SKY_STOPS: Array<[number, Rgb]> = [
  [-90, [16, 24, 62]], // night
  [-18, [20, 30, 74]], // astronomical twilight
  [-12, [27, 36, 92]], // nautical twilight: indigo
  [-8, [58, 54, 158]], // blue hour, leaning violet so it isn't rain
  [-5, [102, 70, 170]], // violet
  [-3, [156, 78, 152]], // purple
  [-1.5, [214, 98, 128]], // pink
  [0, [240, 122, 92]], // coral, at the horizon
  [2, [246, 152, 68]], // orange
  [6, [250, 190, 84]], // gold: the end of golden hour
  [15, [254, 208, 104]],
  [35, [255, 220, 122]], // bright day: sunlight, not sky blue
  [90, [255, 232, 152]],
];

export function skyColor(elevation: number): Rgb {
  if (elevation <= SKY_STOPS[0][0]) return SKY_STOPS[0][1];
  for (let i = 1; i < SKY_STOPS.length; i++) {
    const [e1, c1] = SKY_STOPS[i];
    if (elevation <= e1) {
      const [e0, c0] = SKY_STOPS[i - 1];
      return mix(c0, c1, (elevation - e0) / (e1 - e0));
    }
  }
  return SKY_STOPS[SKY_STOPS.length - 1][1];
}

/** 0 at night, 1 in full daylight, easing through twilight. */
export function daylight(elevation: number): number {
  return Math.max(0, Math.min(1, (elevation + 8) / 16));
}

// ---- weather -------------------------------------------------------------------

const CLOUD_DAY: Rgb = [214, 219, 226];
const CLOUD_DUSK: Rgb = [138, 134, 148];
// Night cloud is lighter than the clear sky (it catches the ground's light).
const CLOUD_NIGHT: Rgb = [104, 108, 124];

/**
 * Lit clouds by day, a dull grey-mauve at dusk (a full overcast doesn't glow;
 * broken cloud shows the sunset between it), lit slate at night.
 */
export function cloudColor(elevation: number, sky: Rgb): Rgb {
  if (elevation >= 8) return mix(CLOUD_DAY, sky, 0.12);
  if (elevation >= -4) return mix(mix(CLOUD_DUSK, CLOUD_DAY, (elevation + 4) / 12), sky, 0.25);
  return mix(mix(CLOUD_NIGHT, CLOUD_DUSK, Math.max(0, (elevation + 12) / 8)), sky, 0.2);
}

/** Each precipitation's colour by day and by night. */
export const PRECIP_COLORS: Record<Exclude<Precip, "none">, { day: Rgb; night: Rgb }> = {
  // Rain leans teal and storms violet, so neither is mistaken for twilight blue.
  drizzle: { day: [104, 156, 196], night: [40, 110, 170] },
  rain: { day: [30, 122, 172], night: [8, 70, 112] },
  // Storms are also darker than rain, which holds for colour-blind eyes too.
  storm: { day: [74, 36, 128], night: [58, 24, 96] },
  snow: { day: [226, 240, 255], night: [176, 196, 230] },
  sleet: { day: [150, 204, 226], night: [96, 134, 158] },
};

export const OBSCURED_COLORS = {
  // Fog is a warm milky grey: darker and warmer than snow, paler than cloud; at night it glows.
  fog: { day: [226, 212, 184] as Rgb, night: [132, 126, 112] as Rgb },
  haze: { day: [222, 196, 150] as Rgb, night: [92, 82, 70] as Rgb },
  smoke: { day: [196, 160, 120] as Rgb, night: [84, 70, 60] as Rgb },
};

const atLight = (pair: { day: Rgb; night: Rgb }, elevation: number) => mix(pair.night, pair.day, daylight(elevation));

/** Shown where there's no forecast: the sky, greyed and dimmed. */
const UNKNOWN_GREY: Rgb = [128, 132, 138];

/**
 * The bar's colour at one moment: the sky, then clouds by how much of it
 * they cover (thick cloud darker), then fog or haze washing it out, then
 * rain, snow or storms tinting it by how heavy and how likely.
 */
export function baseColor(conditions: Conditions, elevation: number): Rgb {
  const sky = skyColor(elevation);
  if (!conditions.known) return mix(sky, UNKNOWN_GREY, 0.6);

  const cloud = cloudColor(elevation, sky);
  // Thick cloud is darker underneath by day; at night it's lit from below, so no darker.
  const thick = (Math.max(0, conditions.cloud - 0.75) / 0.25) * daylight(elevation);
  const clouds = mix(cloud, [cloud[0] * 0.82, cloud[1] * 0.84, cloud[2] * 0.88], thick);
  let color = mix(sky, clouds, Math.pow(conditions.cloud, 0.8) * 0.92);

  if (conditions.obscured !== "none") {
    color = mix(color, atLight(OBSCURED_COLORS[conditions.obscured], elevation), conditions.obscuredAmount * 0.78);
  }
  if (conditions.precip !== "none") {
    const strength = (0.5 + 0.5 * conditions.intensity) * (0.4 + 0.6 * conditions.chance);
    color = mix(color, atLight(PRECIP_COLORS[conditions.precip], elevation), strength);
  }
  return color;
}

/** Hours already past: a little faded, so the rest of the day stands out. */
export function pastColor(color: Rgb): Rgb {
  const grey = (color[0] + color[1] + color[2]) / 3;
  return mix(color, [grey, grey, grey], 0.35).map((c) => c * 0.82) as Rgb;
}

// ---- telling colours apart ---------------------------------------------------------

const toLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const fromLinear = (v: number) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

/** OKLab, where distance roughly matches how different two colours look. */
export function oklab([r, g, b]: Rgb): [number, number, number] {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** How different two colours look, ×100 (about 2 is barely noticeable; 10+ is clearly different). */
export function deltaE(a: Rgb, b: Rgb): number {
  const [l1, a1, b1] = oklab(a);
  const [l2, a2, b2] = oklab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2) * 100;
}

/** How a colour looks with deuteranopia (the commonest colour blindness), after Machado et al. 2009. */
export function deuteranopia([r, g, b]: Rgb): Rgb {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const out = [
    0.367322 * lr + 0.860646 * lg - 0.227968 * lb,
    0.280085 * lr + 0.672501 * lg + 0.047413 * lb,
    -0.01182 * lr + 0.04294 * lg + 0.968881 * lb,
  ];
  return out.map((v) => Math.max(0, Math.min(255, fromLinear(Math.max(0, Math.min(1, v)))))) as Rgb;
}
