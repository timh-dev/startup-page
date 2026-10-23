import type { SolarContext } from './solarMath';
import { sunElevation } from './solarMath';
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

/**
 * Atmosphere along the horizon, modelled on Earth's limb seen from orbit at
 * sunrise/sunset: a thin cream-white line at the horizon, a cyan-to-teal-to-
 * deep-blue band of scattered light above it, and a peach-to-rust glow
 * bleeding below. It's brightest toward the sun and falls off along the
 * horizon, peaks while the sun is near the horizon, fades to a faint blue
 * airglow by day and night, and is added (not painted over) so bright areas
 * read as light rather than paint.
 */
export function renderHorizonGlow(ctx: CanvasRenderingContext2D, width: number, height: number, lst: number, solar: SolarContext, horizonY: number, elev?: number) {
  if (elev === undefined) elev = sunElevation(solar.lat, solar.lng, lst, solar.doy);
  const { x: sunX } = solarToCanvas(lst, width, height, solar);

  // 1 with the sun on the horizon, 0 beyond ±16° (the end of twilight).
  const t = 1 - smoothstep(0, 16, Math.abs(elev));
  // Daylight and night keep a faint airglow so the horizon never goes dead.
  const a = 0.18 + 0.22 * smoothstep(0, 25, elev);

  const scale = ctx.getTransform().a || 1;
  const { canvas: layerCanvas, lctx } = getLayer(Math.round(width * scale), Math.round(height * scale), scale);

  // Above the horizon: scattered light, cream at the limb through teal to
  // deep blue, fading into the sky.
  lctx.fillStyle = gradient(lctx, horizonY, 0, [
    [0, [255, 238, 214], 0.95 * t + 0.35 * a],
    [0.035, [214, 234, 230], 0.8 * t + 0.3 * a],
    [0.16, [120, 182, 200], 0.6 * t + 0.24 * a],
    [0.4, [34, 98, 134], 0.4 * t + 0.16 * a],
    [0.72, [10, 34, 64], 0.2 * t + 0.08 * a],
    [1, [4, 10, 24], 0],
  ]);
  lctx.fillRect(0, 0, width, horizonY);

  // Below the horizon: the sunlit haze, peach at the limb through orange
  // to rust, sinking into darkness. Only around sunrise and sunset.
  if (t > 0.01) {
    lctx.fillStyle = gradient(lctx, horizonY, height, [
      [0, [255, 224, 182], 0.95 * t],
      [0.06, [253, 188, 130], 0.82 * t],
      [0.24, [228, 130, 80], 0.58 * t],
      [0.52, [142, 54, 32], 0.36 * t],
      [0.82, [52, 15, 10], 0.18 * t],
      [1, [10, 4, 4], 0],
    ]);
    lctx.fillRect(0, horizonY, width, height - horizonY);
  }

  // The limb itself: a bright line with a soft bloom.
  lctx.globalCompositeOperation = 'lighter';
  for (const [lineWidth, alpha] of [[14, 0.08], [5, 0.22], [1.4, 0.9]] as const) {
    lctx.beginPath();
    lctx.moveTo(0, horizonY);
    lctx.lineTo(width, horizonY);
    lctx.lineWidth = lineWidth;
    lctx.strokeStyle = `rgba(255, 243, 222, ${alpha * (0.35 + 0.65 * t)})`;
    lctx.stroke();
  }

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
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(layerCanvas, 0, 0, width, height);

  // Bloom: light from a sun on the horizon bleeding across it, round rather
  // than stretched.
  if (t > 0.01) {
    const radius = Math.max(width, height) * 0.42;
    const bloom = ctx.createRadialGradient(sunX, horizonY, 0, sunX, horizonY, radius);
    bloom.addColorStop(0, `rgba(255, 232, 196, ${0.42 * t})`);
    bloom.addColorStop(0.18, `rgba(255, 196, 140, ${0.2 * t})`);
    bloom.addColorStop(0.5, `rgba(214, 120, 80, ${0.07 * t})`);
    bloom.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = bloom;
    ctx.fillRect(sunX - radius, horizonY - radius, radius * 2, radius * 2);
  }
  ctx.restore();
}
