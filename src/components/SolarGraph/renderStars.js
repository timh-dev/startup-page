import { sunElevation } from './solarMath';

// Celestial pole position (normalized 0–1).
// Top-center of canvas — stars rotate around this point.
const POLE_X = 0.5;
const POLE_Y = -0.15; // slightly above canvas top edge

// Generate a stable star field (called once on mount)
// Stars are distributed in polar coords around the celestial pole with enough
// radial coverage that the canvas stays filled through a full 360° rotation.
export function createStarField(count = 800) {
  const stars = [];
  // Max radius needs to cover corner-to-corner distance from the pole at any
  // rotation. Pole is at (0.5, -0.15), farthest canvas corner is ~1.3 away.
  const maxDist = 1.5;
  for (let i = 0; i < count; i++) {
    // Uniform distribution in a disk: sqrt for even area coverage
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.sqrt(Math.random()) * maxDist;
    stars.push({
      angle,
      dist,
      size: 0.5 + Math.random() * 1.5,
      baseBrightness: 0.4 + Math.random() * 0.6,
      twinkleFreq: 0.5 + Math.random() * 2.0,
      twinklePhase: Math.random() * Math.PI * 2,
      twinkleAmplitude: 0.1 + Math.random() * 0.3,
      warmth: Math.random(),
    });
  }
  return stars;
}

// --- Shooting stars ---
// Module-level state so they persist across frames
let activeShootingStars = [];
let lastShootingStarCheck = 0;

function spawnShootingStar(width, height) {
  // Start from a random point in the upper portion of the canvas
  const startX = Math.random() * width;
  const startY = Math.random() * height * 0.5;
  // Travel direction: mostly downward with horizontal drift
  const angle = Math.PI * 0.15 + Math.random() * Math.PI * 0.25; // 27°–72° from horizontal
  const direction = Math.random() > 0.5 ? 1 : -1; // left or right
  const speed = 300 + Math.random() * 400; // px per second
  const length = 40 + Math.random() * 80;

  return {
    x: startX,
    y: startY,
    dx: Math.cos(angle) * direction,
    dy: Math.sin(angle),
    speed,
    length,
    life: 0,
    maxLife: 0.4 + Math.random() * 0.5, // seconds
    brightness: 0.6 + Math.random() * 0.4,
  };
}

function updateAndRenderShootingStars(ctx, width, height, dt, starOpacity) {
  if (starOpacity <= 0.05) {
    activeShootingStars = [];
    return;
  }

  // Spawn new shooting stars randomly (~1 every 3–6 seconds when dark)
  lastShootingStarCheck += dt;
  if (lastShootingStarCheck > 0.1) {
    lastShootingStarCheck = 0;
    if (Math.random() < 0.025 * starOpacity) {
      activeShootingStars.push(spawnShootingStar(width, height));
    }
  }

  // Cap active count
  if (activeShootingStars.length > 4) {
    activeShootingStars = activeShootingStars.slice(-4);
  }

  const surviving = [];
  for (const s of activeShootingStars) {
    s.life += dt;
    if (s.life >= s.maxLife) continue;

    // Position along the streak
    const progress = s.life / s.maxLife;
    const headX = s.x + s.dx * s.speed * s.life;
    const headY = s.y + s.dy * s.speed * s.life;

    // Fade: ramp up then fade out
    const fade = progress < 0.2
      ? progress / 0.2
      : 1 - (progress - 0.2) / 0.8;
    const alpha = fade * s.brightness * starOpacity;

    if (alpha < 0.01) { surviving.push(s); continue; }

    // Draw streak as a gradient line from tail to head
    const tailX = headX - s.dx * s.length * fade;
    const tailY = headY - s.dy * s.length * fade;

    const grad = ctx.createLinearGradient(tailX, tailY, headX, headY);
    grad.addColorStop(0, `rgba(255, 255, 255, 0)`);
    grad.addColorStop(0.6, `rgba(220, 230, 255, ${alpha * 0.4})`);
    grad.addColorStop(1, `rgba(255, 255, 255, ${alpha})`);

    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(headX, headY);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Bright head dot
    ctx.beginPath();
    ctx.arc(headX, headY, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fill();

    surviving.push(s);
  }
  activeShootingStars = surviving;
}

// Render stars with twinkle, fade, and earth-rotation around celestial pole
export function renderStars(ctx, width, height, stars, time, lst, solar) {
  const elev = sunElevation(solar.lat, solar.lng, lst, solar.doy);

  // Full brightness below -6° (civil twilight), fully faded above ~5°
  let starOpacity = 1;
  if (elev > -6) {
    starOpacity = Math.max(0, 1 - (elev + 6) / 11);
  }

  // Delta time for shooting stars (approximate from animation time)
  const dt = 1 / 60; // ~60fps assumed for shooting star physics

  // Shooting stars render even while stars are fading
  updateAndRenderShootingStars(ctx, width, height, dt, starOpacity);

  if (starOpacity <= 0.01) return;

  // Rotation angle: full 2*PI over 24 hours
  const rotAngle = (lst / 24) * Math.PI * 2;

  const poleXpx = POLE_X * width;
  const poleYpx = POLE_Y * height;

  for (const star of stars) {
    const twinkle =
      star.baseBrightness +
      star.twinkleAmplitude *
        Math.sin(time * star.twinkleFreq + star.twinklePhase);
    const alpha = Math.max(0, Math.min(1, twinkle)) * starOpacity;

    if (alpha < 0.02) continue;

    // Rotate star around the celestial pole
    const currentAngle = star.angle + rotAngle;
    const x = poleXpx + Math.cos(currentAngle) * star.dist * width;
    const y = poleYpx + Math.sin(currentAngle) * star.dist * height;

    // Skip if rotated off canvas
    if (x < -10 || x > width + 10 || y < -10 || y > height + 10) continue;

    const r = Math.round(220 + star.warmth * 35);
    const g = Math.round(220 + star.warmth * 20);
    const b = Math.round(235 - star.warmth * 30);

    ctx.beginPath();
    ctx.arc(x, y, star.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.fill();
  }
}
