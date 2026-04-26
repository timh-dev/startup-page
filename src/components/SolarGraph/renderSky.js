import { getSkyColors } from './colors';
import { sunElevation } from './solarMath';

// Render sky gradient background based on sun elevation
export function renderSky(ctx, width, height, lst, solar) {
  const elev = sunElevation(solar.lat, solar.lng, lst, solar.doy);

  // Map elevation to 0–1 factor: -18° (astro twilight) → 0, maxElevation → 1
  let elevationFactor = 0;
  if (elev > -18) {
    elevationFactor = Math.min(1, (elev + 18) / (solar.maxElevation + 18));
  }

  const { top, bottom } = getSkyColors(elevationFactor);

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}
