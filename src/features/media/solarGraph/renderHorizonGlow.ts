import type { SolarContext } from './solarMath';
import { hourToDayFraction, sunElevation } from './solarMath';
import { solarToCanvas } from './renderCurve';

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

type Stop = [offset: number, rgb: [number, number, number], alpha: number];

function gradient(ctx: CanvasRenderingContext2D, y0: number, y1: number, stops: Stop[]) {
  const grad = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [offset, [r, g, b], alpha] of stops) {
    grad.addColorStop(offset, `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`);
  }
  return grad;
}

// Reused between frames; resized when the canvas changes.
let layer: HTMLCanvasElement | null = null;

function getLayer(pixelWidth: number, pixelHeight: number, scale: number) {
  if (!layer) layer = document.createElement('canvas');
  if (layer.width !== pixelWidth || layer.height !== pixelHeight) {
    layer.width = pixelWidth;
    layer.height = pixelHeight;
  }
  const lctx = layer.getContext('2d')!;
  lctx.setTransform(scale, 0, 0, scale, 0, 0);
  lctx.globalCompositeOperation = 'source-over';
  lctx.clearRect(0, 0, pixelWidth / scale, pixelHeight / scale);
  return { canvas: layer, lctx };
}

type Palette = {
  /** Above the horizon, from the limb upward. */
  sky: Array<[offset: number, rgb: [number, number, number], twilight: number, ambient: number]>;
  limb: [number, number, number];
  bloom: Array<[offset: number, rgb: [number, number, number], alpha: number]>;
};

// Sunrise: soft and golden, warming a pale morning blue.
const SUNRISE: Palette = {
  sky: [
    [0, [255, 240, 204], 0.95, 0.35],
    [0.04, [255, 222, 150], 0.82, 0.28],
    [0.14, [252, 196, 118], 0.62, 0.2],
    [0.32, [214, 196, 160], 0.38, 0.16],
    [0.55, [110, 160, 205], 0.26, 0.12],
    [0.8, [34, 70, 120], 0.12, 0.06],
    [1, [8, 16, 34], 0, 0],
  ],
  limb: [255, 244, 214],
  bloom: [
    [0, [255, 236, 186], 0.5],
    [0.2, [255, 204, 120], 0.24],
    [0.5, [232, 168, 90], 0.08],
  ],
};

// Sunset: vivid and dramatic, burning orange into magenta, violet and indigo.
const SUNSET: Palette = {
  sky: [
    [0, [255, 222, 176], 0.95, 0.35],
    [0.035, [255, 160, 82], 0.88, 0.28],
    [0.12, [240, 96, 86], 0.72, 0.2],
    [0.26, [196, 66, 128], 0.56, 0.16],
    [0.45, [124, 62, 168], 0.42, 0.12],
    [0.68, [58, 48, 140], 0.26, 0.08],
    [0.88, [20, 24, 72], 0.12, 0.04],
    [1, [8, 10, 30], 0, 0],
  ],
  limb: [255, 230, 196],
  bloom: [
    [0, [255, 214, 160], 0.48],
    [0.18, [255, 140, 90], 0.24],
    [0.45, [200, 70, 120], 0.1],
  ],
};

/**
 * Light along the horizon at sunrise and sunset, modelled on Earth's limb
 * seen from orbit: a thin bright line at the horizon with a band of
 * scattered light above it, brightest toward the sun and falling off along
 * the horizon. Only above the horizon. Sunrise is golden, sunset runs
 * through orange and magenta into violet and indigo. It peaks while the sun
 * is near the horizon and fades to a faint airglow by day and night, and is
 * added (not painted over) so bright areas read as light rather than paint.
 */
export function renderHorizonGlow(ctx: CanvasRenderingContext2D, width: number, height: number, lst: number, solar: SolarContext, horizonY: number, elev?: number) {
  if (elev === undefined) elev = sunElevation(solar.lat, solar.lng, lst, solar.doy);
  const { x: sunX } = solarToCanvas(lst, width, height, solar);
  const palette = hourToDayFraction(lst, solar) < 0.5 ? SUNRISE : SUNSET;

  // Full strength within 4° of the horizon, fading out by 18° (astronomical
  // twilight), so the colour lingers through dawn and dusk.
  const t = 1 - smoothstep(4, 18, Math.abs(elev));
  // Daylight and night keep a faint airglow so the horizon never goes dead.
  const a = 0.18 + 0.22 * smoothstep(0, 25, elev);

  const scale = ctx.getTransform().a || 1;
  const { canvas: layerCanvas, lctx } = getLayer(Math.round(width * scale), Math.round(height * scale), scale);

  lctx.fillStyle = gradient(
    lctx,
    horizonY,
    0,
    palette.sky.map(([offset, rgb, twilight, ambient]) => [offset, rgb, twilight * t + ambient * a]),
  );
  lctx.fillRect(0, 0, width, horizonY);

  // The limb itself: a bright line with a soft bloom, kept above the horizon.
  lctx.save();
  lctx.beginPath();
  lctx.rect(0, 0, width, horizonY + 0.75);
  lctx.clip();
  lctx.globalCompositeOperation = 'lighter';
  const [lr, lg, lb] = palette.limb;
  for (const [lineWidth, alpha] of [[14, 0.08], [5, 0.22], [1.4, 0.9]] as const) {
    lctx.beginPath();
    lctx.moveTo(0, horizonY);
    lctx.lineTo(width, horizonY);
    lctx.lineWidth = lineWidth;
    lctx.strokeStyle = `rgba(${lr}, ${lg}, ${lb}, ${alpha * (0.35 + 0.65 * t)})`;
    lctx.stroke();
  }
  lctx.restore();

  // Fade the whole layer away from the sun along the horizon: full strength
  // near the sun, a faint floor at the far edges.
  lctx.globalCompositeOperation = 'destination-in';
  const sigma = width * (0.42 + 0.2 * (1 - t));
  const floor = 0.14;
  const mask = lctx.createLinearGradient(0, 0, width, 0);
  const samples = 16;
  for (let i = 0; i <= samples; i++) {
    const x = (i / samples) * width;
    const weight = floor + (1 - floor) * Math.exp(-(((x - sunX) / sigma) ** 2));
    mask.addColorStop(i / samples, `rgba(0,0,0,${weight})`);
  }
  lctx.fillStyle = mask;
  lctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, horizonY + 0.75);
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(layerCanvas, 0, 0, width, height);

  // Bloom: light from a sun on the horizon spreading up into the sky.
  if (t > 0.01) {
    const radius = Math.max(width, height) * 0.42;
    const bloom = ctx.createRadialGradient(sunX, horizonY, 0, sunX, horizonY, radius);
    for (const [offset, [r, g, b], alpha] of palette.bloom) {
      bloom.addColorStop(offset, `rgba(${r}, ${g}, ${b}, ${alpha * t})`);
    }
    bloom.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = bloom;
    ctx.fillRect(sunX - radius, horizonY - radius, radius * 2, radius);
  }
  ctx.restore();
}
