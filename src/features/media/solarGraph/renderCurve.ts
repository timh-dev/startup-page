import type { SolarContext } from './solarMath';
import { hourToDayFraction, normalizedElevation, solarDayAnchors } from './solarMath';

const CURVE_COLOR = '#f0ebd8';
const HORIZON_COLOR = '#f0ebd8';

// Fixed curve geometry — identical for every location and date. The noon
// peak and midnight trough leave breathing room for the sun glow and
// tooltips; the horizon line moves within this band by season.
export const PEAK_FRAC = 0.16;
const TROUGH_FRAC = 0.88;
const CURVE_SAMPLES = 256;

// Map the normalized curve value (+1 noon peak … -1 midnight trough) to
// canvas Y with a single linear scale.
function normElevToY(normElev: number, height: number) {
  return height * (PEAK_FRAC + ((1 - normElev) / 2) * (TROUGH_FRAC - PEAK_FRAC));
}

// The horizon sits where the fixed curve crosses it at today's real
// sunrise/sunset: the crossing is halfDay hours from solar noon, so its
// height directly encodes day length (low horizon = long day).
export function getHorizonY(height: number, solar: SolarContext) {
  const { halfDay } = solarDayAnchors(solar);
  const horizonNorm = normalizedElevation(0.5 + halfDay / 24);
  return Math.round(normElevToY(horizonNorm, height)) + 0.5;
}

// Convert a local hour to canvas coordinates on the fixed curve.
// X is linear time centered on solar noon; Y follows the fixed cosine.
export function solarToCanvas(hour: number, width: number, height: number, solar: SolarContext) {
  const u = hourToDayFraction(hour, solar);
  return {
    x: u * width,
    y: normElevToY(normalizedElevation(u), height),
  };
}

// The curve geometry only depends on canvas size — cache the Path2D.
let _cachedPath: Path2D | null = null;
let _cacheTag: { width: number; height: number } | null = null;

function getSolarPath(width: number, height: number): Path2D {
  if (_cacheTag && _cacheTag.width === width && _cacheTag.height === height) {
    return _cachedPath!;
  }
  const path = new Path2D();
  for (let i = 0; i <= CURVE_SAMPLES; i++) {
    const u = i / CURVE_SAMPLES;
    const x = u * width;
    const y = normElevToY(normalizedElevation(u), height);
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  _cachedPath = path;
  _cacheTag = { width, height };
  return path;
}

// Render the solar elevation curve and horizon line
export function renderCurve(ctx: CanvasRenderingContext2D, width: number, height: number, solar: SolarContext) {
  const crispHorizonY = getHorizonY(height, solar);

  // Reuse cached Path2D — rebuilt only when the canvas size changes
  const path = getSolarPath(width, height);

  // Multi-width soft glow without shadowBlur (shadowBlur on complex paths is the main perf bottleneck)
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.strokeStyle = 'rgba(240, 235, 216, 0.07)';
  ctx.lineWidth = 9;
  ctx.stroke(path);

  ctx.strokeStyle = 'rgba(240, 235, 216, 0.13)';
  ctx.lineWidth = 5;
  ctx.stroke(path);

  ctx.strokeStyle = CURVE_COLOR;
  ctx.lineWidth = 1.6;
  ctx.stroke(path);

  ctx.restore();

  // Horizon line — two strokes, no shadowBlur
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, crispHorizonY);
  ctx.lineTo(width, crispHorizonY);
  ctx.strokeStyle = 'rgba(240, 235, 216, 0.12)';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, crispHorizonY);
  ctx.lineTo(width, crispHorizonY);
  ctx.strokeStyle = HORIZON_COLOR;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.58;
  ctx.stroke();
  ctx.restore();

  return { horizonY: crispHorizonY };
}
