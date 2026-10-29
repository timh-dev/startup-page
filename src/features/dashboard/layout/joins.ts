// Joined cards: neighbours that become one shape with no gap between them.
// Each keeps its own content; where they meet, the seam moves like two
// liquids that won't mix (oil and water): it ripples and bulges but never
// blends.
//
// Cell logic (which cards touch, which joins still hold, the groups) and
// pixel geometry (the group's rounded outline, each card's region with its
// wavy seam edge) live here; the dashboard draws them.
import { pageOf, type Layout, type Placement } from "./grid";

export type Join = [string, string];

/** Where two cards touch: a vertical seam (side by side) or a horizontal one (stacked). */
export interface Seam {
  /** The card left of / above the seam. */
  a: string;
  b: string;
  orientation: "v" | "h";
  /** The seam's cell line: x for vertical seams, y for horizontal ones. */
  line: number;
  /** The span along the seam, in cells: [from, to). */
  from: number;
  to: number;
}

export const joinKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** The seam between two cards, if they share an edge on the same page. */
export function seamBetween(p: Placement, q: Placement): Seam | null {
  if (pageOf(p.y) !== pageOf(q.y)) return null;
  const [left, right] = p.x <= q.x ? [p, q] : [q, p];
  if (left.x + left.w === right.x) {
    const from = Math.max(left.y, right.y);
    const to = Math.min(left.y + left.h, right.y + right.h);
    if (to > from) return { a: left.id, b: right.id, orientation: "v", line: right.x, from, to };
  }
  const [top, bottom] = p.y <= q.y ? [p, q] : [q, p];
  if (top.y + top.h === bottom.y) {
    const from = Math.max(top.x, bottom.x);
    const to = Math.min(top.x + top.w, bottom.x + bottom.w);
    if (to > from) return { a: top.id, b: bottom.id, orientation: "h", line: bottom.y, from, to };
  }
  return null;
}

/** Every pair of cards that touch (where a join node can go). */
export function adjacentSeams(layout: Layout): Seam[] {
  const cards = [...layout.values()];
  const seams: Seam[] = [];
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const seam = seamBetween(cards[i], cards[j]);
      if (seam) seams.push(seam);
    }
  }
  return seams;
}

/** The saved joins that still hold (both cards exist and still touch). */
export function activeSeams(layout: Layout, joins: Join[]): Seam[] {
  const seams: Seam[] = [];
  const seen = new Set<string>();
  for (const [a, b] of joins) {
    const key = joinKey(a, b);
    const p = layout.get(a);
    const q = layout.get(b);
    if (!p || !q || seen.has(key)) continue;
    const seam = seamBetween(p, q);
    if (seam) {
      seams.push(seam);
      seen.add(key);
    }
  }
  return seams;
}

/** Groups of joined cards: card id → the ids in its group (only for joined cards). */
export function groupsOf(seams: Seam[]): Map<string, string[]> {
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    const p = parent.get(id) ?? id;
    if (p === id) return id;
    const root = find(p);
    parent.set(id, root);
    return root;
  };
  for (const { a, b } of seams) {
    parent.set(a, find(a));
    parent.set(b, find(b));
    parent.set(find(a), find(b));
  }
  const members = new Map<string, string[]>();
  for (const id of parent.keys()) {
    const root = find(id);
    members.set(root, [...(members.get(root) ?? []), id]);
  }
  const groups = new Map<string, string[]>();
  for (const ids of members.values()) for (const id of ids) groups.set(id, ids);
  return groups;
}

// ---- pixel geometry --------------------------------------------------------

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Turns cells into pixels; rows are mapped by the caller (pages add offsets). */
export interface Metrics {
  cell: number;
  gap: number;
  span: (cells: number) => number;
  rowTop: (row: number) => number;
}

export const rectOf = (p: Placement, m: Metrics): Rect => ({ x: p.x * m.cell, y: m.rowTop(p.y), w: m.span(p.w), h: m.span(p.h) });

/** A seam in pixels: the centre line in the gap and its span along it. */
export interface SeamPx {
  key: string;
  a: string;
  b: string;
  orientation: "v" | "h";
  /** Centre of the gap (x for vertical seams, y for horizontal). */
  center: number;
  from: number;
  to: number;
  seed: number;
}

export function seamPx(seam: Seam, m: Metrics): SeamPx {
  const key = joinKey(seam.a, seam.b);
  let seed = 0;
  for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) % 997;
  if (seam.orientation === "v") {
    return { key, a: seam.a, b: seam.b, orientation: "v", center: seam.line * m.cell - m.gap / 2, from: m.rowTop(seam.from), to: m.rowTop(seam.to - 1) + m.span(1), seed };
  }
  return { key, a: seam.a, b: seam.b, orientation: "h", center: m.rowTop(seam.line) - m.gap / 2, from: seam.from * m.cell, to: seam.from * m.cell + m.span(seam.to - seam.from), seed };
}

/**
 * The seam's offset from the gap's centre line at a point along it, at a
 * time: slow, heavy swells plus a bulge that drifts along, tapering to zero
 * at the ends so it meets the outline cleanly. Both cards use the same
 * function, so their edges always meet exactly.
 */
export function seamWave(s: SeamPx, along: number, t: number, amplitude: number) {
  const length = Math.max(1, s.to - s.from);
  const u = (along - s.from) / length;
  if (u <= 0 || u >= 1) return 0;
  const taper = Math.sin(Math.PI * u);
  const phase = s.seed * 0.37;
  const swell = 0.45 * Math.sin((along / 120) * Math.PI * 2 + t * 0.9 + phase) + 0.25 * Math.sin((along / 53) * Math.PI * 2 - t * 0.6 + phase * 1.7);
  const centre = 0.5 + 0.32 * Math.sin(t * 0.23 + phase);
  const bulge = 0.6 * Math.exp(-(((u - centre) / 0.2) ** 2)) * Math.sin(t * 0.7 + phase * 2.3);
  return amplitude * taper * (swell + bulge);
}

const fmt = (n: number) => Math.round(n * 10) / 10;

/**
 * The outline of a joined group, rounded: the cards' rectangles plus the
 * bridges across each seam's gap, traced as one rectilinear outline whose
 * corners are rounded (outward at convex corners, filleted at inward ones).
 */
export function groupOutline(rects: Rect[], radius: number): string {
  const xs = [...new Set(rects.flatMap((r) => [r.x, r.x + r.w]))].sort((a, b) => a - b);
  const ys = [...new Set(rects.flatMap((r) => [r.y, r.y + r.h]))].sort((a, b) => a - b);
  const inside = (i: number, j: number) => {
    const cx = (xs[i] + xs[i + 1]) / 2;
    const cy = (ys[j] + ys[j + 1]) / 2;
    return rects.some((r) => cx > r.x && cx < r.x + r.w && cy > r.y && cy < r.y + r.h);
  };
  const filled = (i: number, j: number) => i >= 0 && j >= 0 && i < xs.length - 1 && j < ys.length - 1 && inside(i, j);

  // Boundary edges, oriented clockwise (inside on the right in screen space).
  const edges = new Map<string, [number, number]>();
  const key = (x: number, y: number) => `${x},${y}`;
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      if (!filled(i, j)) continue;
      if (!filled(i, j - 1)) edges.set(key(xs[i], ys[j]), [xs[i + 1], ys[j]]); // top: left → right
      if (!filled(i + 1, j)) edges.set(key(xs[i + 1], ys[j]), [xs[i + 1], ys[j + 1]]); // right: down
      if (!filled(i, j + 1)) edges.set(key(xs[i + 1], ys[j + 1]), [xs[i], ys[j + 1]]); // bottom: right → left
      if (!filled(i - 1, j)) edges.set(key(xs[i], ys[j + 1]), [xs[i], ys[j]]); // left: up
    }
  }

  let d = "";
  const used = new Set<string>();
  for (const start of edges.keys()) {
    if (used.has(start)) continue;
    // Walk the loop, merging collinear edges into corners.
    const points: Array<[number, number]> = [];
    let at = start;
    while (!used.has(at)) {
      used.add(at);
      const [x, y] = at.split(",").map(Number);
      points.push([x, y]);
      const next = edges.get(at);
      if (!next) break;
      at = key(next[0], next[1]);
    }
    const corners = points.filter((p, i) => {
      const prev = points[(i - 1 + points.length) % points.length];
      const next = points[(i + 1) % points.length];
      return !((prev[0] === p[0] && p[0] === next[0]) || (prev[1] === p[1] && p[1] === next[1]));
    });
    if (corners.length < 3) continue;
    // Round each corner with a curve whose control point is the corner.
    const n = corners.length;
    const towards = (from: [number, number], to: [number, number], dist: number): [number, number] => {
      const len = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
      return [from[0] + ((to[0] - from[0]) / len) * dist, from[1] + ((to[1] - from[1]) / len) * dist];
    };
    for (let i = 0; i < n; i++) {
      const prev = corners[(i - 1 + n) % n];
      const p = corners[i];
      const next = corners[(i + 1) % n];
      const r = Math.min(radius, Math.hypot(p[0] - prev[0], p[1] - prev[1]) / 2, Math.hypot(next[0] - p[0], next[1] - p[1]) / 2);
      const a = towards(p, prev, r);
      const b = towards(p, next, r);
      d += `${i === 0 ? "M" : "L"}${fmt(a[0])} ${fmt(a[1])}Q${fmt(p[0])} ${fmt(p[1])} ${fmt(b[0])} ${fmt(b[1])}`;
    }
    d += "Z";
  }
  return d;
}

/** The gap strips that seams bridge, in pixels. */
export function bridgeRect(s: SeamPx, gap: number): Rect {
  return s.orientation === "v"
    ? { x: s.center - gap / 2, y: s.from, w: gap, h: s.to - s.from }
    : { x: s.from, y: s.center - gap / 2, w: s.to - s.from, h: gap };
}

/**
 * One card's region inside its group, in its own box's coordinates (the box
 * is the card's rectangle grown by `reach` on joined sides): the rectangle,
 * pushed out across each of its seams to the seam's wavy edge.
 */
export function memberRegion(id: string, rect: Rect, box: Rect, seams: SeamPx[], t: number, amplitude: number): string {
  const ox = box.x;
  const oy = box.y;
  const step = 8;
  const pts: Array<[number, number]> = [];
  const push = (x: number, y: number) => pts.push([x - ox, y - oy]);
  const along = (side: "top" | "right" | "bottom" | "left") =>
    seams
      .filter((s) => {
        if (s.orientation === "v") return (side === "right" && s.a === id) || (side === "left" && s.b === id);
        return (side === "bottom" && s.a === id) || (side === "top" && s.b === id);
      })
      .sort((p, q) => p.from - q.from);

  const right = rect.x + rect.w;
  const bottom = rect.y + rect.h;

  // Top edge, left → right.
  push(rect.x, rect.y);
  for (const s of along("top")) {
    push(s.from, rect.y);
    for (let x = s.from; x <= s.to; x += step) push(x, s.center + seamWave(s, x, t, amplitude));
    push(s.to, s.center + seamWave(s, s.to, t, amplitude));
    push(s.to, rect.y);
  }
  push(right, rect.y);
  // Right edge, top → bottom.
  for (const s of along("right")) {
    push(right, s.from);
    for (let y = s.from; y <= s.to; y += step) push(s.center + seamWave(s, y, t, amplitude), y);
    push(s.center + seamWave(s, s.to, t, amplitude), s.to);
    push(right, s.to);
  }
  push(right, bottom);
  // Bottom edge, right → left.
  for (const s of along("bottom").reverse()) {
    push(s.to, bottom);
    for (let x = s.to; x >= s.from; x -= step) push(x, s.center + seamWave(s, x, t, amplitude));
    push(s.from, s.center + seamWave(s, s.from, t, amplitude));
    push(s.from, bottom);
  }
  push(rect.x, bottom);
  // Left edge, bottom → top.
  for (const s of along("left").reverse()) {
    push(rect.x, s.to);
    for (let y = s.to; y >= s.from; y -= step) push(s.center + seamWave(s, y, t, amplitude), y);
    push(s.center + seamWave(s, s.from, t, amplitude), s.from);
    push(rect.x, s.from);
  }
  return `M${pts.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join("L")}Z`;
}

/** The seam line itself (for the meniscus highlight), in grid coordinates. */
export function seamLine(s: SeamPx, t: number, amplitude: number) {
  const pts: string[] = [];
  for (let at = s.from; at <= s.to; at += 6) {
    const off = s.center + seamWave(s, at, t, amplitude);
    pts.push(s.orientation === "v" ? `${fmt(off)} ${fmt(at)}` : `${fmt(at)} ${fmt(off)}`);
  }
  const end = s.center + seamWave(s, s.to, t, amplitude);
  pts.push(s.orientation === "v" ? `${fmt(end)} ${fmt(s.to)}` : `${fmt(s.to)} ${fmt(end)}`);
  return `M${pts.join("L")}`;
}
