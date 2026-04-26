const CURVE_COLOR = '#f0ebd8';
const HORIZON_COLOR = '#f0ebd8';

// Map elevation (degrees) to canvas Y
function elevToCanvasY(elevation, maxEl, minEl, horizonY, canvasHeight) {
  if (elevation >= 0) {
    return horizonY * (1 - elevation / maxEl);
  }
  const below = canvasHeight - horizonY;
  return horizonY + (Math.abs(elevation) / Math.abs(minEl)) * below;
}

// Convert solar hour + elevation (degrees) to canvas coordinates
export function solarToCanvas(hour, elevation, width, height, solar, horizonY) {
  const x = (hour / 24) * width;
  const y = elevToCanvasY(
    elevation,
    solar.maxElevation,
    solar.minElevation,
    horizonY,
    height
  );
  return { x, y };
}

// Render the solar elevation curve and horizon line
export function renderCurve(ctx, width, height, solar) {
  // Position horizon proportional to annual elevation range
  const horizonFrac =
    solar.maxElevation / (solar.maxElevation - solar.minElevation);
  const horizonY = Math.max(
    height * 0.2,
    Math.min(height * 0.85, height * horizonFrac)
  );

  const { curveHours, curveElevations } = solar;

  // Draw the curve
  ctx.beginPath();
  ctx.strokeStyle = CURVE_COLOR;
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = 4;
  ctx.shadowColor = 'rgba(240, 235, 216, 0.3)';

  for (let i = 0; i < curveHours.length; i++) {
    const { x, y } = solarToCanvas(
      curveHours[i],
      curveElevations[i],
      width,
      height,
      solar,
      horizonY
    );
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Horizon line at elevation 0°
  ctx.beginPath();
  ctx.strokeStyle = HORIZON_COLOR;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.6;
  ctx.moveTo(0, horizonY);
  ctx.lineTo(width, horizonY);
  ctx.stroke();
  ctx.globalAlpha = 1;

  return { horizonY };
}
