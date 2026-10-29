// Joined cards: neighbours that become one shape with no gap between them.
// Each keeps its own content, exactly where it was; the gap between them is
// filled with a gradient from one card's edge colour to the other's, and the
// group gets one rounded outline (filleted inner corners).
//
// Cell logic (which cards touch, which joins still hold, the groups) and
// pixel geometry (the group's outline, the bridges across seams) live here;
// the dashboard draws them.
import { pageOf, type Layout, type Placement } from "./grid";

/**
 * "bridge": one shape, the gap between filled. "window": the cards keep
 * their own shapes and gaps but show one shared video or photo through them.
 */
export type JoinMode = "bridge" | "window";
export type Join = [string, string] | [string, string, JoinMode];

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
  mode?: JoinMode;
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
  for (const [a, b, mode] of joins) {
    const key = joinKey(a, b);
    const p = layout.get(a);
    const q = layout.get(b);
    if (!p || !q || seen.has(key)) continue;
    const seam = seamBetween(p, q);
    if (seam) {
      seams.push({ ...seam, mode: mode ?? "bridge" });
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
  mode: JoinMode;
}

export function seamPx(seam: Seam, m: Metrics): SeamPx {
  const key = joinKey(seam.a, seam.b);
  if (seam.orientation === "v") {
    return { key, a: seam.a, b: seam.b, orientation: "v", center: seam.line * m.cell - m.gap / 2, from: m.rowTop(seam.from), to: m.rowTop(seam.to - 1) + m.span(1), mode: seam.mode ?? "bridge" };
  }
  return { key, a: seam.a, b: seam.b, orientation: "h", center: m.rowTop(seam.line) - m.gap / 2, from: seam.from * m.cell, to: seam.from * m.cell + m.span(seam.to - seam.from), mode: seam.mode ?? "bridge" };
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
    // Each corner rounds by up to `radius` along each of its edges; a short
    // edge (like a bridge across a gap) is shared between its two corners,
    // while the long edges keep the full radius, so inner corners stay round.
    const len = (u: [number, number], v: [number, number]) => Math.hypot(v[0] - u[0], v[1] - u[1]);
    for (let i = 0; i < n; i++) {
      const prev = corners[(i - 1 + n) % n];
      const p = corners[i];
      const next = corners[(i + 1) % n];
      const a = towards(p, prev, Math.min(radius, len(prev, p) / 2));
      const b = towards(p, next, Math.min(radius, len(p, next) / 2));
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

/** Separate rounded rectangles as one path (cards that share media but keep their gaps). */
export function roundedRects(rects: Rect[], radius: number): string {
  return rects
    .map(({ x, y, w, h }) => {
      const r = Math.min(radius, w / 2, h / 2);
      return `M${fmt(x + r)} ${fmt(y)}H${fmt(x + w - r)}Q${fmt(x + w)} ${fmt(y)} ${fmt(x + w)} ${fmt(y + r)}V${fmt(y + h - r)}Q${fmt(x + w)} ${fmt(y + h)} ${fmt(x + w - r)} ${fmt(y + h)}H${fmt(x + r)}Q${fmt(x)} ${fmt(y + h)} ${fmt(x)} ${fmt(y + h - r)}V${fmt(y + r)}Q${fmt(x)} ${fmt(y)} ${fmt(x + r)} ${fmt(y)}Z`;
    })
    .join("");
}
