import { sunElevation, formatHour } from './solarMath';
import { solarToCanvas } from './renderCurve';

const EVENT_COLORS = {
  horizon:       { fill: 'rgba(255, 200, 60, 0.9)',  glow: 'rgba(255, 200, 60, 0.3)' },
  civil:         { fill: 'rgba(230, 140, 50, 0.85)', glow: 'rgba(230, 140, 50, 0.25)' },
  nautical:      { fill: 'rgba(140, 160, 190, 0.8)', glow: 'rgba(140, 160, 190, 0.25)' },
  astronomical:  { fill: 'rgba(70, 90, 160, 0.8)',   glow: 'rgba(70, 90, 160, 0.25)' },
};

const EVENT_RADIUS = {
  horizon: 4.5,
  civil: 3.5,
  nautical: 3.5,
  astronomical: 3.5,
};

function drawPill(ctx, x, y, text, fontSize) {
  ctx.font = `${fontSize}px sans-serif`;
  const metrics = ctx.measureText(text);
  const padX = 5;
  const padY = 3;
  const pw = metrics.width + padX * 2;
  const ph = fontSize + padY * 2;
  const px = Math.max(1, Math.min(x - pw / 2, ctx.canvas.width / (window.devicePixelRatio || 1) - pw - 1));
  const py = y - ph / 2;

  ctx.fillStyle = 'rgba(15, 15, 20, 0.65)';
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 4);
  ctx.fill();

  ctx.fillStyle = 'rgba(240, 235, 216, 0.9)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, px + padX, py + ph / 2);
}

// Render event markers, labels, tooltip, time cursor, and current-time indicator
export function renderMarkers(ctx, w, h, hoverHour, solar, horizonY, realLst) {
  // --- Time cursor: vertical dashed line from sun to horizon ---
  const hoverElev = sunElevation(solar.lat, solar.lng, hoverHour, solar.doy);
  const { x: sunX, y: sunY } = solarToCanvas(hoverHour, hoverElev, w, h, solar, horizonY);

  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(240, 235, 216, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sunX, sunY);
  ctx.lineTo(sunX, horizonY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // --- Event marker dots + labels (label only when cursor is near) ---
  const LABEL_PROXIMITY = 0.5; // hours — how close cursor must be to show label
  for (const evt of solar.events) {
    const { type, hour, elevation, label } = evt;
    const colors = EVENT_COLORS[type];
    const radius = EVENT_RADIUS[type];
    const { x, y } = solarToCanvas(hour, elevation, w, h, solar, horizonY);

    // Glow ring
    ctx.beginPath();
    ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
    ctx.fillStyle = colors.glow;
    ctx.fill();

    // Filled dot
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = colors.fill;
    ctx.fill();

    // Label only when hovering near this event's time
    const dist = Math.abs(hoverHour - hour);
    if (dist < LABEL_PROXIMITY) {
      const labelAlpha = 1 - dist / LABEL_PROXIMITY; // fade in as cursor approaches
      ctx.globalAlpha = labelAlpha;
      const timeStr = formatHour(hour);
      const labelText = `${label} ${timeStr}`;
      const labelOffsetY = elevation >= 0 ? -(radius + 12) : (radius + 12);
      const labelY = Math.max(12, Math.min(h - 12, y + labelOffsetY));
      drawPill(ctx, x, labelY, labelText, 10);
      ctx.globalAlpha = 1;
    }
  }

  // --- Hover tooltip near sun ---
  const elevStr = `${hoverElev >= 0 ? '+' : ''}${hoverElev.toFixed(1)}°`;
  const tooltipText = `${formatHour(hoverHour)}  ${elevStr}`;
  const tooltipY = sunY - 22;
  drawPill(ctx, sunX, Math.max(12, tooltipY), tooltipText, 12);

  // --- Current-time marker (shows "now" while scrubbing) ---
  const realElev = sunElevation(solar.lat, solar.lng, realLst, solar.doy);
  const { x: nowX, y: nowY } = solarToCanvas(realLst, realElev, w, h, solar, horizonY);

  ctx.beginPath();
  ctx.arc(nowX, nowY, 3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(240, 235, 216, 0.5)';
  ctx.fill();

  // Small ring around current-time marker
  ctx.beginPath();
  ctx.arc(nowX, nowY, 6, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(240, 235, 216, 0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();
}
