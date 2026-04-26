import { sunElevation } from './solarMath';
import { solarToCanvas } from './renderCurve';

// Time-of-day atmosphere color.
function getAtmosColor(lst, elev) {
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

// Draw an elliptical radial gradient layer
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

// Render the sun with elliptical atmospheric glow that reshapes with elevation.
// At horizon: wide & flat bloom. High sun: narrow & taller bloom.
export function renderSun(ctx, width, height, lst, solar, horizonY) {
  const elev = sunElevation(solar.lat, solar.lng, lst, solar.doy);
  const { x: sunX, y: sunY } = solarToCanvas(
    lst, elev, width, height, solar, horizonY
  );

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
    ctx.arc(sunX, sunY, 6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(240, 235, 216, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Subtle glow below horizon
    const nearHorizon = Math.max(0, 1 - Math.abs(elev) / 18);
    const belowRadius = 20 + nearHorizon * 80;
    const belowAlpha = 0.06 + nearHorizon * 0.15;
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

  // How high the sun is (0 = horizon, 1 = peak)
  const elFactor = Math.min(1, elev / solar.maxElevation);

  // Ellipse shape mirrors horizon glow:
  // At horizon → wide & flat, high sun → narrower & taller
  const scaleX = 2.5 - elFactor * 1.5;  // 2.5 → 1.0
  const scaleY = 0.5 + elFactor * 0.5;  // 0.5 → 1.0

  // Clip to above horizon
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, horizonY);
  ctx.clip();

  ctx.globalCompositeOperation = 'lighter';

  // Layer 1: Wide atmospheric bloom — elliptical, stronger at noon
  const bloomRadius = 100 + elFactor * 140;
  const bloomAlpha = 0.28 + elFactor * 0.25;
  drawEllipseGlow(ctx, sunX, sunY, bloomRadius, scaleX, scaleY, [
    [0, `rgba(${ar},${ag},${ab},${bloomAlpha})`],
    [0.12, `rgba(${ar},${ag},${ab},${bloomAlpha * 0.6})`],
    [0.35, `rgba(${ar},${ag},${ab},${bloomAlpha * 0.2})`],
    [0.7, `rgba(${ar},${ag},${ab},${bloomAlpha * 0.05})`],
    [1, `rgba(${ar},${ag},${ab},0)`],
  ]);

  // Layer 2: Mid glow — slightly warmer
  const midRadius = 50 + elFactor * 40;
  drawEllipseGlow(ctx, sunX, sunY, midRadius, scaleX * 0.8, scaleY * 0.9, [
    [0, `rgba(${ar},${ag},${ab},0.35)`],
    [0.3, `rgba(${ar},${ag},${ab},0.12)`],
    [0.7, `rgba(${ar},${ag},${ab},0.03)`],
    [1, `rgba(${ar},${ag},${ab},0)`],
  ]);

  // Layer 3: Inner warm haze
  const innerRadius = 20 + elFactor * 15;
  drawEllipseGlow(ctx, sunX, sunY, innerRadius, scaleX * 0.6, scaleY * 0.8, [
    [0, 'rgba(255, 230, 150, 0.50)'],
    [0.4, 'rgba(255, 200, 80, 0.15)'],
    [1, 'rgba(255, 200, 80, 0)'],
  ]);

  ctx.restore();

  // Layer 4: Bright core (no clip — always visible on curve)
  ctx.save();
  ctx.shadowBlur = 15;
  ctx.shadowColor = 'rgba(255, 240, 200, 0.8)';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 5, 0, Math.PI * 2);
  const coreGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 5);
  coreGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  coreGrad.addColorStop(0.6, 'rgba(255, 240, 180, 0.9)');
  coreGrad.addColorStop(1, 'rgba(255, 220, 120, 0.5)');
  ctx.fillStyle = coreGrad;
  ctx.fill();
  ctx.restore();
}
