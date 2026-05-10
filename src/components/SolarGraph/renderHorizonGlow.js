import { sunElevation } from './solarMath';
import { solarToCanvas } from './renderCurve';

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Draw one elliptical glow layer using canvas scale transform.
// radius is the base circle size; scaleX/scaleY stretch it into an ellipse.
function drawEllipseGlow(ctx, cx, cy, radius, scaleX, scaleY, stops) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scaleX, scaleY);

  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  for (const [pos, color] of stops) {
    grad.addColorStop(pos, color);
  }

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
}

// Multi-layered sunrise/sunset horizon glow with elliptical shape.
// At horizon (elev ≈ 0): flat, wide gaussian spread along horizon.
// As sun rises: glow narrows horizontally, grows slightly taller.
// Sunset reverses: starts narrow/tall, flattens as sun descends.
export function renderHorizonGlow(ctx, width, height, lst, solar, horizonY, elev) {
  if (elev === undefined) elev = sunElevation(solar.lat, solar.lng, lst, solar.doy);
  const { x: sunX } = solarToCanvas(lst, elev, width, height, solar, horizonY);

  // Active within ±15° of horizon
  if (Math.abs(elev) > 15) return;

  const distFromHorizon = Math.abs(elev);
  const fadeFactor = 1 - smoothstep(0, 15, distFromHorizon);
  if (fadeFactor < 0.01) return;

  // How far above horizon (0 at horizon, 1 at +15°)
  const riseFactor = elev > 0 ? Math.min(1, elev / 15) : 0;

  // Ellipse shape:
  // scaleX: wide at horizon (3.5), narrows as sun rises (1.0)
  // scaleY: tall at horizon (2.5), drops off exponentially as sun rises
  //         exp(-1 * riseFactor) gives rapid falloff: 1.0 → 0.02 over the range
  const scaleX = 3.5 - riseFactor * 2.5;
  const scaleY = 0.4 + 2.1 * Math.exp(-1 * riseFactor);

  const isMorning = lst < 12;

  // Color layers — multiple bands for richness
  // Layer order: outermost (deep red/crimson) → mid (orange) → inner (gold/amber)
  const alphaScale = fadeFactor * fadeFactor; // quadratic falloff
  const sizeScale = Math.max(0.82, Math.min(1.45, width / 640));

  // Clip to above horizon
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, horizonY);
  ctx.clip();

  ctx.globalCompositeOperation = 'lighter';

  // --- Layer 0b: Outermost atmospheric halo — very wide, soft color backdrop ---
  // Sunset: dark blues + light purples. Sunrise: soft pinks + warm magentas.
  if (isMorning) {
    // Sunrise outer halo: soft magenta-pink
    const haloA = { r: 120, g: 40, b: 80 };
    drawEllipseGlow(ctx, sunX, horizonY, 310 * sizeScale, scaleX * 1.9, scaleY * 1.35, [
      [0, `rgba(${haloA.r},${haloA.g},${haloA.b},${0.28 * alphaScale})`],
      [0.2, `rgba(${haloA.r},${haloA.g},${haloA.b},${0.15 * alphaScale})`],
      [0.52, `rgba(${haloA.r},${haloA.g},${haloA.b},${0.05 * alphaScale})`],
      [1, 'rgba(0,0,0,0)'],
    ]);
    // Sunrise mid-halo: warm rose-pink
    const haloB = { r: 180, g: 70, b: 90 };
    drawEllipseGlow(ctx, sunX, horizonY, 230 * sizeScale, scaleX * 1.55, scaleY * 1.13, [
      [0, `rgba(${haloB.r},${haloB.g},${haloB.b},${0.32 * alphaScale})`],
      [0.25, `rgba(${haloB.r},${haloB.g},${haloB.b},${0.15 * alphaScale})`],
      [0.6, `rgba(${haloB.r},${haloB.g},${haloB.b},${0.04 * alphaScale})`],
      [1, 'rgba(0,0,0,0)'],
    ]);
  } else {
    // Sunset outer halo: dark blue
    const haloA = { r: 30, g: 40, b: 100 };
    drawEllipseGlow(ctx, sunX, horizonY, 310 * sizeScale, scaleX * 1.9, scaleY * 1.35, [
      [0, `rgba(${haloA.r},${haloA.g},${haloA.b},${0.31 * alphaScale})`],
      [0.2, `rgba(${haloA.r},${haloA.g},${haloA.b},${0.17 * alphaScale})`],
      [0.52, `rgba(${haloA.r},${haloA.g},${haloA.b},${0.06 * alphaScale})`],
      [1, 'rgba(0,0,0,0)'],
    ]);
    // Sunset mid-halo: light purple / lavender
    const haloB = { r: 110, g: 60, b: 150 };
    drawEllipseGlow(ctx, sunX, horizonY, 230 * sizeScale, scaleX * 1.55, scaleY * 1.13, [
      [0, `rgba(${haloB.r},${haloB.g},${haloB.b},${0.34 * alphaScale})`],
      [0.25, `rgba(${haloB.r},${haloB.g},${haloB.b},${0.17 * alphaScale})`],
      [0.6, `rgba(${haloB.r},${haloB.g},${haloB.b},${0.05 * alphaScale})`],
      [1, 'rgba(0,0,0,0)'],
    ]);
  }

  // --- Layer 1: Deep red/crimson ---
  const outerColor = isMorning
    ? { r: 140, g: 20, b: 10 }
    : { r: 100, g: 10, b: 40 };
  drawEllipseGlow(ctx, sunX, horizonY, 180 * sizeScale, scaleX * 1.2, scaleY, [
    [0, `rgba(${outerColor.r},${outerColor.g},${outerColor.b},${0.36 * alphaScale})`],
    [0.3, `rgba(${outerColor.r},${outerColor.g},${outerColor.b},${0.17 * alphaScale})`],
    [0.7, `rgba(${outerColor.r},${outerColor.g},${outerColor.b},${0.05 * alphaScale})`],
    [1, 'rgba(0,0,0,0)'],
  ]);

  // --- Layer 2: Mid — warm orange ---
  const midColor = isMorning
    ? { r: 230, g: 100, b: 30 }
    : { r: 210, g: 70, b: 20 };
  drawEllipseGlow(ctx, sunX, horizonY, 145 * sizeScale, scaleX, scaleY * 0.85, [
    [0, `rgba(${midColor.r},${midColor.g},${midColor.b},${0.48 * alphaScale})`],
    [0.2, `rgba(${midColor.r},${midColor.g},${midColor.b},${0.26 * alphaScale})`],
    [0.5, `rgba(${midColor.r},${midColor.g},${midColor.b},${0.1 * alphaScale})`],
    [1, 'rgba(0,0,0,0)'],
  ]);

  // --- Layer 3: Inner — bright gold/amber ---
  const innerColor = isMorning
    ? { r: 255, g: 190, b: 60 }
    : { r: 255, g: 140, b: 40 };
  drawEllipseGlow(ctx, sunX, horizonY, 98 * sizeScale, scaleX * 0.8, scaleY * 0.7, [
    [0, `rgba(${innerColor.r},${innerColor.g},${innerColor.b},${0.54 * alphaScale})`],
    [0.15, `rgba(${innerColor.r},${innerColor.g},${innerColor.b},${0.3 * alphaScale})`],
    [0.42, `rgba(${innerColor.r},${innerColor.g},${innerColor.b},${0.1 * alphaScale})`],
    [1, 'rgba(0,0,0,0)'],
  ]);

  // --- Layer 4: Hot core — white/yellow ---
  drawEllipseGlow(ctx, sunX, horizonY, 58 * sizeScale, scaleX * 0.5, scaleY * 0.5, [
    [0, `rgba(255,246,214,${0.48 * alphaScale})`],
    [0.2, `rgba(255,224,154,${0.2 * alphaScale})`],
    [0.52, `rgba(255,200,100,${0.06 * alphaScale})`],
    [1, 'rgba(0,0,0,0)'],
  ]);

  ctx.restore();
}
