// Render sky background — solid black (space)
// All atmospheric color comes from the sun glow and horizon glow modules.
export function renderSky(ctx, width, height) {
  ctx.fillStyle = '#030308';
  ctx.fillRect(0, 0, width, height);
}
