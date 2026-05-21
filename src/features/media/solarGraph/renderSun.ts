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
export function renderSun(ctx, width, height, lst, solar, horizonY, elev) {
  if (elev === undefined) elev = sunElevation(solar.lat, solar.lng, lst, solar.doy);
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

  // Layer 0: very broad atmospheric veil.
  const veilRadius = 160 + elFactor * 190;
  const veilAlpha = 0.08 + elFactor * 0.12;
  drawEllipseGlow(ctx, sunX, sunY, veilRadius, scaleX * 1.55, scaleY * 1.35, [
    [0, `rgba(${ar},${ag},${ab},${veilAlpha})`],
    [0.28, `rgba(${ar},${ag},${ab},${veilAlpha * 0.45})`],
    [0.68, `rgba(${ar},${ag},${ab},${veilAlpha * 0.12})`],
    [1, `rgba(${ar},${ag},${ab},0)`],
  ]);

  // Layer 1: Wide atmospheric bloom — elliptical, stronger at noon
  const bloomRadius = 105 + elFactor * 155;
  const bloomAlpha = 0.34 + elFactor * 0.3;
  drawEllipseGlow(ctx, sunX, sunY, bloomRadius, scaleX, scaleY, [
    [0, `rgba(${ar},${ag},${ab},${bloomAlpha})`],
    [0.1, `rgba(${ar},${ag},${ab},${bloomAlpha * 0.68})`],
    [0.32, `rgba(${ar},${ag},${ab},${bloomAlpha * 0.24})`],
    [0.72, `rgba(${ar},${ag},${ab},${bloomAlpha * 0.06})`],
    [1, `rgba(${ar},${ag},${ab},0)`],
  ]);

  // Layer 2: Mid glow — slightly warmer
  const midRadius = 54 + elFactor * 50;
  drawEllipseGlow(ctx, sunX, sunY, midRadius, scaleX * 0.8, scaleY * 0.9, [
    [0, `rgba(255,235,180,0.42)`],
    [0.28, `rgba(${ar},${ag},${ab},0.17)`],
    [0.72, `rgba(${ar},${ag},${ab},0.04)`],
    [1, `rgba(${ar},${ag},${ab},0)`],
  ]);

  // Layer 3: Inner warm haze
  const innerRadius = 22 + elFactor * 19;
  drawEllipseGlow(ctx, sunX, sunY, innerRadius, scaleX * 0.6, scaleY * 0.8, [
    [0, 'rgba(255, 245, 190, 0.62)'],
    [0.38, 'rgba(255, 202, 82, 0.2)'],
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
