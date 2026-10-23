import type { SolarContext } from './solarMath';
import { sunElevation } from './solarMath';
import { solarToCanvas } from './renderCurve';

// Time-of-day atmosphere color.
function getAtmosColor(lst: number, elev: number) {
  let r, g, b;

  if (elev < -6) {
    r = 80; g = 60; b = 50;
  } else if (elev < 2) {
    const t = (elev + 6) / 8;
    r = Math.round(180 + 75 * t);
    g = Math.round(80 + 80 * t);
    b = Math.round(30 + 10 * t);
  } else if (elev < 20) {
    const t = (elev - 2) / 18;
    r = Math.round(255 - 195 * t);
    g = Math.round(160 - 10 * t);
    b = Math.round(40 + 220 * t);
  } else {
    r = 60; g = 150; b = 255;
  }

  return { r, g, b };
}

// One circular radial-gradient layer of glow.
function drawGlow(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, stops: Array<[number, string]>) {
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  for (const [pos, color] of stops) {
    grad.addColorStop(pos, color);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
}

// Render the sun: a bright core with circular glow layers that grow and
// strengthen with elevation.
export function renderSun(ctx: CanvasRenderingContext2D, width: number, height: number, lst: number, solar: SolarContext, horizonY: number, elev?: number) {
  if (elev === undefined) elev = sunElevation(solar.lat, solar.lng, lst, solar.doy);
  // Position comes from the fixed curve; the real elevation still drives
  // color temperature and glow shape below.
  const { x: sunX, y: sunY } = solarToCanvas(lst, width, height, solar);

  const isBelowHorizon = elev < 0;
  const { r: ar, g: ag, b: ab } = getAtmosColor(lst, elev);

  if (isBelowHorizon) {
    // Clip below-horizon glow to below the horizon line
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, horizonY, width, height - horizonY);
    ctx.clip();

    // Thin ring
    ctx.beginPath();
    ctx.arc(sunX, sunY, 6.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 244, 212, 0.72)';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(255, 172, 86, 0.34)';
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Subtle glow below horizon
    const nearHorizon = Math.max(0, 1 - Math.abs(elev) / 18);
    const belowRadius = 34 + nearHorizon * 120;
    const belowAlpha = 0.08 + nearHorizon * 0.24;
    ctx.beginPath();
    const belowGlow = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, belowRadius);
    belowGlow.addColorStop(0, `rgba(${ar},${ag},${ab},${belowAlpha})`);
    belowGlow.addColorStop(0.5, `rgba(${ar},${ag},${ab},${belowAlpha * 0.3})`);
    belowGlow.addColorStop(1, `rgba(${ar},${ag},${ab},0)`);
    ctx.fillStyle = belowGlow;
    ctx.arc(sunX, sunY, belowRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    return;
  }

  // How high the sun is (0 = horizon, 1 = peak). Drives size and strength
  // only: every layer stays a circle, so the sun and its halo keep their
  // shape at any elevation. (The horizon's sideways spread of light is drawn
  // by renderHorizonGlow, not by stretching the sun.)
  const elFactor = Math.min(1, elev / solar.maxElevation);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // Layer 0: very broad atmospheric veil.
  const veilRadius = 150 + elFactor * 170;
  const veilAlpha = 0.07 + elFactor * 0.1;
  drawGlow(ctx, sunX, sunY, veilRadius, [
    [0, `rgba(${ar},${ag},${ab},${veilAlpha})`],
    [0.28, `rgba(${ar},${ag},${ab},${veilAlpha * 0.45})`],
    [0.68, `rgba(${ar},${ag},${ab},${veilAlpha * 0.12})`],
    [1, `rgba(${ar},${ag},${ab},0)`],
  ]);

  // Layer 1: wide bloom, stronger at noon.
  const bloomRadius = 90 + elFactor * 110;
  const bloomAlpha = 0.3 + elFactor * 0.26;
  drawGlow(ctx, sunX, sunY, bloomRadius, [
    [0, `rgba(${ar},${ag},${ab},${bloomAlpha})`],
    [0.1, `rgba(${ar},${ag},${ab},${bloomAlpha * 0.68})`],
    [0.32, `rgba(${ar},${ag},${ab},${bloomAlpha * 0.24})`],
    [0.72, `rgba(${ar},${ag},${ab},${bloomAlpha * 0.06})`],
    [1, `rgba(${ar},${ag},${ab},0)`],
  ]);

  // Layer 2: mid glow, slightly warmer.
  const midRadius = 46 + elFactor * 34;
  drawGlow(ctx, sunX, sunY, midRadius, [
    [0, 'rgba(255,235,180,0.5)'],
    [0.28, `rgba(${ar},${ag},${ab},0.2)`],
    [0.72, `rgba(${ar},${ag},${ab},0.05)`],
    [1, `rgba(${ar},${ag},${ab},0)`],
  ]);

  // Layer 3: hot inner halo; with additive blending this clips toward white
  // at the centre, which is what reads as HDR brightness.
  const innerRadius = 18 + elFactor * 12;
  drawGlow(ctx, sunX, sunY, innerRadius, [
    [0, 'rgba(255, 250, 230, 0.9)'],
    [0.35, 'rgba(255, 220, 140, 0.36)'],
    [1, 'rgba(255, 200, 80, 0)'],
  ]);

  ctx.restore();

  // Layer 4: Bright core (no clip — always visible on curve)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.shadowBlur = 18;
  ctx.shadowColor = 'rgba(255, 235, 178, 0.9)';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 6.6, 0, Math.PI * 2);
  const coreGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 6.6);
  coreGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  coreGrad.addColorStop(0.48, 'rgba(255, 248, 212, 0.96)');
  coreGrad.addColorStop(0.78, 'rgba(255, 218, 112, 0.82)');
  coreGrad.addColorStop(1, 'rgba(255, 168, 72, 0.38)');
  ctx.fillStyle = coreGrad;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = 'source-over';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 8.8, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 247, 215, 0.28)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}
