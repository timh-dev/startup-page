import { sunElevation } from './solarMath';

// Celestial pole position (normalized 0–1).
// Top-center of canvas — stars rotate around this point.
const POLE_X = 0.5;
const POLE_Y = -0.15;

// Realistic star field generator.
// Real sky: overwhelming majority of stars are dim sub-pixel pinpoints,
// a few are moderately bright, very rare ones are prominent.
// Uses a power-law magnitude distribution to mimic this.
export function createStarField(count = 1600) {
  const stars = [];
  const maxDist = 1.5;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.sqrt(Math.random()) * maxDist;

    // Power-law brightness: most stars are very dim
    // magnitude ~ random^3 pushes most values near 0
    const mag = Math.pow(Math.random(), 3);

    // Size: dim stars are sub-pixel, bright stars up to ~1.8px
    const size = 0.2 + mag * 1.6;

    // Brightness follows magnitude
    const baseBrightness = 0.1 + mag * 0.7;

    // Twinkle: dim stars scintillate more (atmospheric seeing),
    // bright stars are steadier
    const twinkleAmplitude = 0.02 + (1 - mag) * 0.08;

    // Color temperature: most stars blue-white, rare warm ones
    // 0 = cool blue-white, 1 = warm yellow
    // Weighted toward cool — only bright stars get warm tones
    const warmth = mag > 0.7 ? Math.random() * 0.6 : Math.random() * 0.15;

    stars.push({
      angle,
      dist,
      size,
      baseBrightness,
      twinkleFreq: 0.3 + Math.random() * 1.5,
      twinklePhase: Math.random() * Math.PI * 2,
      twinkleAmplitude,
      warmth,
    });
  }
  return stars;
}

// --- Shooting stars ---
let activeShootingStars = [];
let lastShootingStarCheck = 0;

function spawnShootingStar(width, height) {
  const startX = Math.random() * width;
  const startY = Math.random() * height * 0.5;
  const angle = Math.PI * 0.15 + Math.random() * Math.PI * 0.25;
  const direction = Math.random() > 0.5 ? 1 : -1;
  const speed = 300 + Math.random() * 400;
  const length = 40 + Math.random() * 80;

  return {
    x: startX,
    y: startY,
    dx: Math.cos(angle) * direction,
    dy: Math.sin(angle),
    speed,
    length,
    life: 0,
    maxLife: 0.4 + Math.random() * 0.5,
    brightness: 0.6 + Math.random() * 0.4,
  };
}

function updateAndRenderShootingStars(ctx, width, height, dt, starOpacity) {
  if (starOpacity <= 0.05) {
    activeShootingStars = [];
    return;
  }

  lastShootingStarCheck += dt;
  if (lastShootingStarCheck > 0.1) {
    lastShootingStarCheck = 0;
    if (Math.random() < 0.025 * starOpacity) {
      activeShootingStars.push(spawnShootingStar(width, height));
    }
  }

  if (activeShootingStars.length > 4) {
    activeShootingStars = activeShootingStars.slice(-4);
  }

  const surviving = [];
  for (const s of activeShootingStars) {
    s.life += dt;
    if (s.life >= s.maxLife) continue;

    const progress = s.life / s.maxLife;
    const headX = s.x + s.dx * s.speed * s.life;
    const headY = s.y + s.dy * s.speed * s.life;

    const fade = progress < 0.2
      ? progress / 0.2
      : 1 - (progress - 0.2) / 0.8;
    const alpha = fade * s.brightness * starOpacity;

    if (alpha < 0.01) { surviving.push(s); continue; }

    const tailX = headX - s.dx * s.length * fade;
    const tailY = headY - s.dy * s.length * fade;

    const grad = ctx.createLinearGradient(tailX, tailY, headX, headY);
    grad.addColorStop(0, `rgba(255, 255, 255, 0)`);
    grad.addColorStop(0.6, `rgba(200, 210, 230, ${alpha * 0.3})`);
    grad.addColorStop(1, `rgba(255, 255, 255, ${alpha * 0.9})`);

    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(headX, headY);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(headX, headY, 1, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fill();

    surviving.push(s);
  }
  activeShootingStars = surviving;
}

// Render stars with realistic brightness, subtle twinkle, and polar rotation
export function renderStars(ctx, width, height, stars, time, lst, solar) {
  const elev = sunElevation(solar.lat, solar.lng, lst, solar.doy);

  let starOpacity = 1;
  if (elev > -6) {
    starOpacity = Math.max(0, 1 - (elev + 6) / 11);
  }

  const dt = 1 / 60;
  updateAndRenderShootingStars(ctx, width, height, dt, starOpacity);

  if (starOpacity <= 0.01) return;

  const rotAngle = (lst / 24) * Math.PI * 2;
  const poleXpx = POLE_X * width;
  const poleYpx = POLE_Y * height;

  for (const star of stars) {
    const twinkle =
      star.baseBrightness +
      star.twinkleAmplitude *
        Math.sin(time * star.twinkleFreq + star.twinklePhase);
    const alpha = Math.max(0, Math.min(1, twinkle)) * starOpacity;

    if (alpha < 0.01) continue;

    const currentAngle = star.angle + rotAngle;
    const x = poleXpx + Math.cos(currentAngle) * star.dist * width;
    const y = poleYpx + Math.sin(currentAngle) * star.dist * height;

    if (x < -5 || x > width + 5 || y < -5 || y > height + 5) continue;

    // Cool blue-white base, shift toward warm yellow with warmth factor
    const r = Math.round(190 + star.warmth * 60);
    const g = Math.round(195 + star.warmth * 40);
    const b = Math.round(220 - star.warmth * 50);

    // Dim stars: simple filled pixel. Bright stars: subtle soft glow.
    if (star.size > 1.0 && alpha > 0.3) {
      // Faint glow halo for brighter stars
      ctx.beginPath();
      ctx.arc(x, y, star.size + 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha * 0.08})`;
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(x, y, star.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.fill();
  }
}
