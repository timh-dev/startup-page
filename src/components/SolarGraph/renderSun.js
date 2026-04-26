import { sunElevation } from './solarMath';
import { solarToCanvas } from './renderCurve';

// Render the sun with multi-layered glow
export function renderSun(ctx, width, height, lst, solar, horizonY) {
  const elev = sunElevation(solar.lat, solar.lng, lst, solar.doy);
  const { x: sunX, y: sunY } = solarToCanvas(
    lst, elev, width, height, solar, horizonY
  );

  const isBelowHorizon = elev < 0;

  // Atmosphere color: blue during day, golden during sunrise/sunset
  let atmosR, atmosG, atmosB;
  if (lst <= 12) {
    const factor = lst / 12;
    atmosR = Math.round(82 + (117 - 82) * factor);
    atmosG = Math.round(87 + (181 - 87) * factor);
    atmosB = Math.round(87 + (240 - 87) * factor);
  } else {
    const factor = (lst - 12) / 12;
    atmosR = Math.round(117 + (64 - 117) * factor);
    atmosG = Math.round(181 + (82 - 181) * factor);
    atmosB = Math.round(240 + (115 - 240) * factor);
  }

  if (isBelowHorizon) {
    // Below horizon: draw as a thin ring (like the old torus)
    ctx.beginPath();
    ctx.arc(sunX, sunY, 6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(240, 235, 216, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Subtle glow even below horizon
    ctx.beginPath();
    const belowGlow = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, 20);
    belowGlow.addColorStop(0, `rgba(${atmosR},${atmosG},${atmosB},0.15)`);
    belowGlow.addColorStop(1, `rgba(${atmosR},${atmosG},${atmosB},0)`);
    ctx.fillStyle = belowGlow;
    ctx.arc(sunX, sunY, 20, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // Scale glow based on elevation (0 at horizon, 1 at peak)
  const elFactor = Math.min(1, elev / solar.maxElevation);

  // Layer 1: Outer glow (large, soft)
  const outerRadius = 30 + elFactor * 50;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const outerGlow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, outerRadius);
  outerGlow.addColorStop(0, `rgba(${atmosR},${atmosG},${atmosB},0.25)`);
  outerGlow.addColorStop(0.4, `rgba(${atmosR},${atmosG},${atmosB},0.08)`);
  outerGlow.addColorStop(1, `rgba(${atmosR},${atmosG},${atmosB},0)`);
  ctx.beginPath();
  ctx.arc(sunX, sunY, outerRadius, 0, Math.PI * 2);
  ctx.fillStyle = outerGlow;
  ctx.fill();

  // Layer 2: Inner glow (golden yellow)
  const innerGlowRadius = 15 + elFactor * 15;
  const innerGlow = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, innerGlowRadius);
  innerGlow.addColorStop(0, 'rgba(255, 230, 150, 0.6)');
  innerGlow.addColorStop(0.5, 'rgba(255, 200, 80, 0.15)');
  innerGlow.addColorStop(1, 'rgba(255, 200, 80, 0)');
  ctx.beginPath();
  ctx.arc(sunX, sunY, innerGlowRadius, 0, Math.PI * 2);
  ctx.fillStyle = innerGlow;
  ctx.fill();

  ctx.restore();

  // Layer 3: Inner core (bright white/yellow)
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
