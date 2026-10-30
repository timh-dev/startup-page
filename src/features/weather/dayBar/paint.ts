import { sunElevation } from "@/features/globe/sun";
import { baseColor, cloudColor, css, mix, pastColor, skyColor, type Rgb } from "./palette";
import { conditionsAt, endOfDay, type Conditions, type HourSample } from "./timeline";

// Painting the day bar. Two layers, both behind the same frost (a CSS
// blur): a colour field, and a quiet texture that moves inside it: drifting
// cloud lumps, falling rain and snow, storm flashes, fog banks, wind. The
// frost erases fine detail, so every texture is broad and soft; what's left
// of it is a gentle shimmer in the colour.

/** One pixel column of the bar: its moment, the sun and the weather. */
export interface Column {
  time: number;
  elevation: number;
  conditions: Conditions;
  color: Rgb;
  cloud: Rgb;
  past: boolean;
}

/** The bar's columns across a day, midnight to midnight. */
export function buildColumns(
  samples: HourSample[],
  dayStart: number,
  width: number,
  place: { latitude: number; longitude: number },
  now: number | null,
): Column[] {
  const dayEnd = endOfDay(dayStart);
  const columns: Column[] = [];
  for (let x = 0; x < width; x++) {
    const time = dayStart + ((x + 0.5) / width) * (dayEnd - dayStart);
    const elevation = sunElevation(place.latitude, place.longitude, new Date(time));
    const conditions = conditionsAt(samples, time);
    const past = now != null && time < now;
    const color = baseColor(conditions, elevation);
    columns.push({
      time,
      elevation,
      conditions,
      color: past ? pastColor(color) : color,
      cloud: cloudColor(elevation, skyColor(elevation)),
      past,
    });
  }
  return columns;
}

/**
 * The colour field: one pixel per column, stretched and blurred by CSS, with
 * `bleed` extra columns each side carrying the midnight colours on past the
 * ends, so the blur stays solid right to the card's edges.
 */
export function paintBase(ctx: CanvasRenderingContext2D, columns: Column[], bleed = 0) {
  ctx.canvas.width = Math.max(1, columns.length + bleed * 2);
  ctx.canvas.height = 1;
  if (!columns.length) return;
  const first = css(columns[0].color);
  const last = css(columns[columns.length - 1].color);
  ctx.fillStyle = first;
  ctx.fillRect(0, 0, bleed, 1);
  ctx.fillStyle = last;
  ctx.fillRect(bleed + columns.length, 0, bleed, 1);
  columns.forEach((column, x) => {
    ctx.fillStyle = css(column.color);
    ctx.fillRect(bleed + x, 0, 1, 1);
  });
}

// ---- texture -------------------------------------------------------------------

/** A small seeded random generator, so particles sit in the same places each frame. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth 1-D noise, 0–1: where a "30% chance" of rain falls and where it doesn't. */
function noise1(x: number) {
  const i = Math.floor(x);
  const f = x - i;
  const hash = (n: number) => {
    const s = Math.sin(n * 127.1) * 43758.5453;
    return s - Math.floor(s);
  };
  const u = f * f * (3 - 2 * f);
  return hash(i) * (1 - u) + hash(i + 1) * u;
}

export interface Particles {
  puffs: Array<{ x: number; y: number; r: number; speed: number }>;
  drops: Array<{ x: number; phase: number; length: number; speed: number }>;
  flakes: Array<{ x: number; phase: number; size: number; sway: number }>;
}

/** Where each kind of particle lives, for a bar `width` CSS pixels wide. */
export function makeParticles(width: number): Particles {
  const rand = seeded(7);
  const count = (perPx: number) => Math.max(4, Math.round(width * perPx));
  return {
    puffs: Array.from({ length: count(1 / 9) }, () => ({ x: rand(), y: 0.2 + rand() * 0.6, r: 0.45 + rand() * 0.45, speed: 0.6 + rand() * 0.8 })),
    drops: Array.from({ length: count(1 / 5) }, () => ({ x: rand(), phase: rand(), length: 0.3 + rand() * 0.3, speed: 0.8 + rand() * 0.5 })),
    flakes: Array.from({ length: count(1 / 6) }, () => ({ x: rand(), phase: rand(), size: 1.8 + rand() * 1.4, sway: rand() * Math.PI * 2 })),
  };
}

const RAINY = new Set(["drizzle", "rain", "storm", "sleet"]);

/**
 * The texture at time `t` (seconds). `width`/`height` are CSS pixels; the
 * context is already scaled for the screen's pixel density.
 */
export function paintTexture(ctx: CanvasRenderingContext2D, columns: Column[], particles: Particles, width: number, height: number, t: number) {
  ctx.clearRect(0, 0, width, height);
  if (!columns.length) return;
  const at = (x: number) => columns[Math.max(0, Math.min(columns.length - 1, Math.floor((x / width) * columns.length)))];
  const wrap = (x: number) => ((x % 1) + 1) % 1;
  const fade = (column: Column) => (column.past ? 0.55 : 1);

  // Cloud lumps: most where the sky is broken (about half covered); an
  // overcast is a flat sheet, so it has none.
  for (const puff of particles.puffs) {
    const wind = 0.3 + at(puff.x * width).conditions.wind;
    const x = wrap(puff.x + (t * 0.004 * puff.speed * wind)) * width;
    const column = at(x);
    const c = column.conditions;
    if (!c.known) continue;
    const broken = Math.max(0, 1 - Math.abs(c.cloud - 0.5) * 2.4);
    // Fog hides the cloud shapes: it's a flat, milky layer instead.
    const alpha = broken * 0.55 * (1 - c.obscuredAmount) * fade(column);
    if (alpha <= 0.02) continue;
    const r = puff.r * height;
    const y = puff.y * height;
    const light = mix(column.cloud, [255, 255, 255], column.elevation > -4 ? 0.35 : 0.1);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, css(light, alpha));
    gradient.addColorStop(1, css(light, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Fog banks: long, flat, faint layers sliding slowly past each other.
  for (let band = 0; band < 3; band++) {
    const y = height * (0.3 + band * 0.2);
    const offset = wrap(band * 0.37 + t * 0.006 * (band % 2 ? 1 : -1)) * width;
    for (let x = -width; x < width * 2; x += width / 4) {
      const cx = x + offset;
      const column = at(Math.max(0, Math.min(width - 1, cx)));
      const amount = column.conditions.obscuredAmount;
      if (amount < 0.2) continue;
      const alpha = amount * 0.3 * fade(column);
      ctx.save();
      ctx.translate(cx, y);
      ctx.scale(1, 0.12);
      const r = width / 7;
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      gradient.addColorStop(0, `rgba(255, 250, 240, ${alpha})`);
      gradient.addColorStop(1, "rgba(255, 250, 240, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.restore();
    }
  }

  // Rain, drizzle and sleet: streaks falling, slanted by the wind. A chance
  // of rain falls in patches, so it looks unlike steady rain.
  ctx.lineCap = "round";
  for (const drop of particles.drops) {
    const x = drop.x * width;
    const column = at(x);
    const c = column.conditions;
    if (!c.known || !RAINY.has(c.precip)) continue;
    const patch = noise1(drop.x * 9 + Math.floor(t / 6) * 0.13);
    if (patch > c.chance + 0.05) continue;
    if (drop.phase > 0.25 + c.intensity * 0.75) continue;
    const drizzle = c.precip === "drizzle";
    const fall = drizzle ? 0.35 : c.precip === "sleet" ? 0.5 : 0.9;
    const y = wrap(drop.phase * 7 + t * fall * drop.speed) * (height * 1.4) - height * 0.2;
    const length = height * drop.length * (drizzle ? 0.45 : 1);
    const slant = c.wind * length * 0.8;
    ctx.strokeStyle = `rgba(214, 236, 255, ${(drizzle ? 0.45 : 0.7) * fade(column)})`;
    ctx.lineWidth = drizzle ? 2 : 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - slant, y + length);
    ctx.stroke();
  }

  // Snow (and the snow in sleet): soft flakes drifting down and sideways.
  for (const flake of particles.flakes) {
    const baseX = flake.x * width;
    const column = at(baseX);
    const c = column.conditions;
    if (!c.known || (c.precip !== "snow" && c.precip !== "sleet")) continue;
    if (noise1(flake.x * 9) > c.chance + 0.05) continue;
    if (flake.phase > 0.3 + c.intensity * 0.7) continue;
    const y = wrap(flake.phase * 5 + t * 0.12) * (height * 1.2) - height * 0.1;
    const x = baseX + Math.sin(t * 0.8 + flake.sway) * 3 - c.wind * y * 0.4;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * fade(column)})`;
    ctx.beginPath();
    ctx.arc(x, y, flake.size * (c.precip === "sleet" ? 0.7 : 1), 0, Math.PI * 2);
    ctx.fill();
  }

  // Lightning: now and then a brief bloom somewhere in a storm.
  const beat = Math.floor(t / 2.6);
  const flash = seeded(beat * 31 + 5);
  for (let i = 0; i < 2; i++) {
    const fx = flash() * width;
    const column = at(fx);
    if (column.conditions.precip !== "storm" || column.past) continue;
    const age = t - beat * 2.6 - flash() * 1.2;
    if (age < 0 || age > 0.35) continue;
    const alpha = (1 - age / 0.35) * 0.75;
    const r = height * 1.1;
    const gradient = ctx.createRadialGradient(fx, height * 0.4, 0, fx, height * 0.4, r);
    gradient.addColorStop(0, `rgba(240, 230, 255, ${alpha})`);
    gradient.addColorStop(1, "rgba(200, 180, 255, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(fx - r, 0, r * 2, height);
  }

  // Wind: thin streaks racing sideways when it's blowing hard.
  for (const drop of particles.drops) {
    const column = at(drop.x * width);
    const wind = column.conditions.wind;
    if (wind < 0.45 || drop.phase > 0.35) continue;
    const x = wrap(drop.x + t * 0.25 * drop.speed) * width;
    const y = (0.15 + drop.length * 3) * height;
    ctx.strokeStyle = `rgba(255, 255, 255, ${(wind - 0.4) * 0.6 * fade(column)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + height * 1.2, y);
    ctx.stroke();
  }
}
