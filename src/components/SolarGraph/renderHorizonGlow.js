import { sunElevation } from './solarMath';
import { getSunriseHorizonColor, getSunsetHorizonColor, rgbString } from './colors';
import { solarToCanvas } from './renderCurve';

// Render dramatic sunrise/sunset horizon glow
export function renderHorizonGlow(ctx, width, height, lst, solar, horizonY) {
  const elev = sunElevation(solar.lat, solar.lng, lst, solar.doy);
  const { x: sunX } = solarToCanvas(lst, elev, width, height, solar, horizonY);

  // Only show glow when sun is near the horizon (within ±15°)
  if (Math.abs(elev) > 15) return;

  // Bell-curve intensity: peaks at horizon (elev=0), fades away
  const intensity = Math.max(0, 1 - Math.abs(elev) / 15);
  const bellIntensity = Math.pow(intensity, 1.5);
  if (bellIntensity < 0.02) return;

  const isMorning = lst < 12;
  const colorFn = isMorning ? getSunriseHorizonColor : getSunsetHorizonColor;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const glowHeight = 60 * bellIntensity;
  const glowWidth = width * 0.6;

  // Main horizontal glow band at horizon
  const mainGlow = ctx.createRadialGradient(
    sunX, horizonY, 5,
    sunX, horizonY, glowWidth * 0.5
  );

  const color1 = colorFn(0.8);
  const color2 = colorFn(0.5);
  const color3 = colorFn(0.2);

  mainGlow.addColorStop(0, rgbString(color1, 0.35 * bellIntensity));
  mainGlow.addColorStop(0.3, rgbString(color2, 0.15 * bellIntensity));
  mainGlow.addColorStop(0.7, rgbString(color3, 0.05 * bellIntensity));
  mainGlow.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = mainGlow;
  ctx.fillRect(0, horizonY - glowHeight, width, glowHeight * 2);

  // Secondary wider, softer glow
  const wideGlow = ctx.createRadialGradient(
    sunX, horizonY, 10,
    sunX, horizonY, glowWidth * 0.8
  );
  wideGlow.addColorStop(0, rgbString(color2, 0.12 * bellIntensity));
  wideGlow.addColorStop(0.5, rgbString(color3, 0.04 * bellIntensity));
  wideGlow.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = wideGlow;
  ctx.fillRect(0, horizonY - glowHeight * 1.5, width, glowHeight * 3);

  ctx.restore();
}
