// Colours along one edge of a card, for the gradient that fills the gap
// between joined cards. Samples what's actually on screen at that edge (the
// card's photo, video or canvas, mapped through object-fit and any zoom) at
// several points along it; otherwise the card's background colour.

export type Side = "top" | "right" | "bottom" | "left";

/** How deep into the card each sample reaches, in px. */
const DEPTH = 10;

let scratch: CanvasRenderingContext2D | null = null;
function context() {
  if (!scratch) {
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 4;
    scratch = canvas.getContext("2d", { willReadFrequently: true });
  }
  return scratch;
}

type Media = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;
const dims = (m: Media) =>
  m instanceof HTMLVideoElement ? [m.videoWidth, m.videoHeight] : m instanceof HTMLImageElement ? [m.naturalWidth, m.naturalHeight] : [m.width, m.height];

/** Average colour of a screen rectangle as drawn by one media element, or null. */
function sampleMedia(media: Media, x: number, y: number, w: number, h: number): string | null {
  const ctx = context();
  const [nw, nh] = dims(media);
  if (!ctx || !nw || !nh) return null;
  const r = media.getBoundingClientRect();
  // Where the source is drawn on screen (object-fit cover / contain / fill).
  const fit = media instanceof HTMLCanvasElement ? "fill" : getComputedStyle(media).objectFit;
  let sx = r.width / nw;
  let sy = r.height / nh;
  if (fit === "cover" || fit === "contain") sx = sy = fit === "cover" ? Math.max(sx, sy) : Math.min(sx, sy);
  const ox = r.left + (r.width - nw * sx) / 2;
  const oy = r.top + (r.height - nh * sy) / 2;
  const srcX = Math.max(0, (x - ox) / sx);
  const srcY = Math.max(0, (y - oy) / sy);
  const srcW = Math.min(nw - srcX, w / sx);
  const srcH = Math.min(nh - srcY, h / sy);
  if (srcW <= 0 || srcH <= 0) return null;
  try {
    ctx.clearRect(0, 0, 4, 4);
    ctx.drawImage(media, srcX, srcY, srcW, srcH, 0, 0, 4, 4);
    const data = ctx.getImageData(0, 0, 4, 4).data;
    let red = 0, green = 0, blue = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      red += data[i];
      green += data[i + 1];
      blue += data[i + 2];
      n++;
    }
    return n ? `rgb(${Math.round(red / n)}, ${Math.round(green / n)}, ${Math.round(blue / n)})` : null;
  } catch {
    return null; // cross-origin without CORS: can't read it
  }
}

const transparent = (color: string) => !color || color === "transparent" || /rgba\([^)]*,\s*0\)$/.test(color);

function backgroundOf(tile: HTMLElement): string | null {
  let node = tile.querySelector<HTMLElement>(".dashboard-tile-content > *");
  while (node) {
    const background = getComputedStyle(node).backgroundColor;
    if (!transparent(background)) return background;
    node = node.firstElementChild as HTMLElement | null;
  }
  return null;
}

/**
 * Colours at `count` points along one side of a card, over the span from
 * `from` to `to` (screen px along that side).
 */
export function edgeColors(tile: HTMLElement, side: Side, from: number, to: number, count: number): Array<string | null> {
  const rect = tile.getBoundingClientRect();
  const media = [...tile.querySelectorAll<Media>(".dashboard-tile-content img, .dashboard-tile-content video, .dashboard-tile-content canvas")]
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.width > 0 && r.height > 0)
    .sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height)
    .map(({ el }) => el);
  const fallback = backgroundOf(tile);
  const colors: Array<string | null> = [];
  for (let i = 0; i < count; i++) {
    const a = from + ((to - from) * i) / count;
    const b = from + ((to - from) * (i + 1)) / count;
    const [x, y, w, h] =
      side === "right" ? [rect.right - DEPTH, a, DEPTH, b - a]
      : side === "left" ? [rect.left, a, DEPTH, b - a]
      : side === "bottom" ? [a, rect.bottom - DEPTH, b - a, DEPTH]
      : [a, rect.top, b - a, DEPTH];
    let color: string | null = null;
    for (const el of media) {
      color = sampleMedia(el, x, y, w, h);
      if (color) break;
    }
    colors.push(color ?? fallback);
  }
  return colors;
}
