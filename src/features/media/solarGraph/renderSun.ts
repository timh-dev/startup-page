import type { SolarContext } from './solarMath';
import { hourToDayFraction, sunElevation } from './solarMath';
import { solarToCanvas } from './renderCurve';

// Colour of the light around the sun. Low suns are golden in the morning
// and a deeper red-orange in the evening; both cool to blue as it climbs.
function getAtmosColor(morning: boolean, elev: number) {
  const low = morning ? [255, 196, 104] : [255, 118, 76];
  const dusk = morning ? [196, 120, 60] : [170, 60, 70];
  const lerp = (from: number[], to: number[], t: number) => from.map((value, i) => Math.round(value + (to[i] - value) * t));

  let rgb: number[];
  if (elev < -6) {
    rgb = morning ? [90, 66, 48] : [80, 44, 60];
  } else if (elev < 2) {
    rgb = lerp(dusk, low, (elev + 6) / 8);
  } else if (elev < 20) {
    rgb = lerp(low, [60, 150, 255], (elev - 2) / 18);
  } else {
    rgb = [60, 150, 255];
  }

  const [r, g, b] = rgb;
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
// With the physical sky behind it, the atmosphere already scatters the
// sun's haze, so only the disc and a tight halo are drawn here.
export function renderSun(ctx: CanvasRenderingContext2D, width: number, height: number, lst: number, solar: SolarContext, horizonY: number, elev?: number, physicalSky = false) {
  if (elev === undefined) elev = sunElevation(solar.lat, solar.lng, lst, solar.doy);
  // Position comes from the fixed curve; the real elevation still drives
  // color temperature and glow shape below.
  const { x: sunX, y: sunY } = solarToCanvas(lst, width, height, solar);

  const isBelowHorizon = elev < 0;
  const { r: ar, g: ag, b: ab } = getAtmosColor(hourToDayFraction(lst, solar) < 0.5, elev);

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

    ctx.restore();
    return;
  }

  // How high the sun is (0 = horizon, 1 = peak). Drives size and strength
  // only: every layer stays a circle, so the sun and its halo keep their
  // shape at any elevation. (The horizon's sideways spread of light is drawn
  // by renderHorizonGlow, not by stretching the sun.)
  const elFactor = Math.min(1, elev / solar.maxElevation);

  // Glow stays above the horizon; the core below is always drawn.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, horizonY);
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';

  if (!physicalSky) {
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
  }

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
