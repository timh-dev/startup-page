export function renderSky(ctx, width, height) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#02030b');
  sky.addColorStop(0.45, '#070713');
  sky.addColorStop(1, '#020205');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const centerGlow = ctx.createRadialGradient(
    width * 0.5,
    height * 0.45,
    0,
    width * 0.5,
    height * 0.45,
    Math.max(width, height) * 0.75
  );
  centerGlow.addColorStop(0, 'rgba(52, 65, 110, 0.18)');
  centerGlow.addColorStop(0.45, 'rgba(16, 20, 42, 0.12)');
  centerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = centerGlow;
  ctx.fillRect(0, 0, width, height);

  const vignette = ctx.createRadialGradient(
    width * 0.5,
    height * 0.5,
    Math.min(width, height) * 0.2,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.72
  );
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}
