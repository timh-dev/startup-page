// Free placement for the dashboard grid: every card has a cell position and
// a size in cells, gaps are allowed, and moving or resizing a card pushes
// only the cards it lands on to the nearest free spots.
//
// Pure functions over plain data, so the editor can preview a move on every
// pointer event and commit the same result on drop.
import type { TileSize, WidgetInstance } from "@/lib/dashboard-dimensions";

export const DEFAULT_COLUMNS = 7;
export const MIN_COLUMNS = 4;
export const MAX_COLUMNS = 10;

/** Width and height in cells for each tile size. */
export const SIZE_CELLS: Record<TileSize, { w: number; h: number }> = {
  small: { w: 1, h: 1 },
  wide: { w: 2, h: 1 },
  tall: { w: 1, h: 2 },
  large: { w: 2, h: 2 },
  feature: { w: 3, h: 2 },
};

export interface Placement {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Layout = Map<string, Placement>;

export function cellsFor(size: TileSize | undefined) {
  return SIZE_CELLS[size ?? "small"] ?? SIZE_CELLS.small;
}

const overlaps = (a: Placement, b: Placement) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function fits(candidate: Placement, placed: Iterable<Placement>, columns: number) {
  if (candidate.x < 0 || candidate.y < 0 || candidate.x + candidate.w > columns) return false;
  for (const other of placed) if (other.id !== candidate.id && overlaps(candidate, other)) return false;
  return true;
}

/** The first free spot scanning rows top to bottom, left to right. */
function firstFree(id: string, w: number, h: number, placed: Placement[], columns: number): Placement {
  const width = Math.min(w, columns);
  for (let y = 0; ; y++) {
    for (let x = 0; x + width <= columns; x++) {
      const candidate = { id, x, y, w: width, h };
      if (fits(candidate, placed, columns)) return candidate;
    }
  }
}

/** The free spot closest to (x, y); ties go to the higher, then leftmost spot. */
function nearestFree(id: string, near: { x: number; y: number }, w: number, h: number, placed: Placement[], columns: number): Placement {
  const width = Math.min(w, columns);
  const maxY = placed.reduce((m, p) => Math.max(m, p.y + p.h), 0) + h + 1;
  let best: Placement | null = null;
  let bestScore = Infinity;
  for (let y = 0; y <= maxY; y++) {
    for (let x = 0; x + width <= columns; x++) {
      const candidate = { id, x, y, w: width, h };
      if (!fits(candidate, placed, columns)) continue;
      // Vertical moves cost a little more than sideways ones, so cards slide
      // along their row before dropping a row.
      const score = Math.abs(x - near.x) + Math.abs(y - near.y) * 1.2 + y * 0.001;
      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
  }
  return best ?? firstFree(id, w, h, placed, columns);
}

/**
 * Where every card goes. Cards keep their saved position when it's in
 * bounds and free; the rest (new cards, ones saved before free placement,
 * ones pushed off a narrower grid) fill the first free spots in list order.
 */
export function resolveLayout(widgets: WidgetInstance[], columns: number): Layout {
  const layout: Layout = new Map();
  const placed: Placement[] = [];
  const pending: WidgetInstance[] = [];
  for (const widget of widgets) {
    const { w, h } = cellsFor(widget.size);
    const pos = widget.pos;
    const candidate = pos ? { id: widget.id, x: pos.x, y: pos.y, w: Math.min(w, columns), h } : null;
    if (candidate && fits(candidate, placed, columns)) {
      placed.push(candidate);
      layout.set(widget.id, candidate);
    } else {
      pending.push(widget);
    }
  }
  for (const widget of pending) {
    const { w, h } = cellsFor(widget.size);
    const spot = firstFree(widget.id, w, h, placed, columns);
    placed.push(spot);
    layout.set(widget.id, spot);
  }
  return layout;
}

/**
 * Puts one card at a spot (clamped to the grid) and moves only the cards it
 * now covers, each to the free spot nearest where it was.
 */
export function placeTile(layout: Layout, id: string, target: { x: number; y: number }, size: { w: number; h: number }, columns: number): Layout {
  const w = Math.min(size.w, columns);
  const moving: Placement = {
    id,
    x: Math.max(0, Math.min(columns - w, Math.round(target.x))),
    y: Math.max(0, Math.round(target.y)),
    w,
    h: size.h,
  };
  const others = [...layout.values()].filter((p) => p.id !== id);
  const staying = others.filter((p) => !overlaps(p, moving));
  const displaced = others.filter((p) => overlaps(p, moving)).sort((a, b) => a.y - b.y || a.x - b.x);
  const placed = [moving, ...staying];
  // A pushed card first tries the spot the moved card left (a swap), then
  // the free spot nearest where it was.
  const vacated = layout.get(id);
  for (const card of displaced) {
    const swap = vacated ? { id: card.id, x: vacated.x, y: vacated.y, w: card.w, h: card.h } : null;
    placed.push(swap && fits(swap, placed, columns) ? swap : nearestFree(card.id, card, card.w, card.h, placed, columns));
  }
  return new Map(placed.map((p) => [p.id, p]));
}

/** The first free spot for a new card of a size. */
export function firstFreeSpot(layout: Layout, size: { w: number; h: number }, columns: number) {
  return firstFree("", size.w, size.h, [...layout.values()], columns);
}

/** Rows the layout uses. */
export function rowCount(layout: Layout) {
  let rows = 0;
  for (const p of layout.values()) rows = Math.max(rows, p.y + p.h);
  return rows;
}

/** Writes a layout back onto the cards as saved positions. */
export function applyLayout(widgets: WidgetInstance[], layout: Layout): WidgetInstance[] {
  return widgets.map((widget) => {
    const p = layout.get(widget.id);
    if (!p) return widget;
    if (widget.pos?.x === p.x && widget.pos?.y === p.y) return widget;
    return { ...widget, pos: { x: p.x, y: p.y } };
  });
}

/** The allowed size nearest to a width and height in cells (for drag-resizing). */
export function nearestSize(w: number, h: number, allowed: TileSize[]): TileSize {
  let best = allowed[0] ?? "small";
  let bestScore = Infinity;
  for (const size of allowed) {
    const cells = SIZE_CELLS[size];
    const score = Math.abs(cells.w - w) + Math.abs(cells.h - h);
    if (score < bestScore) {
      bestScore = score;
      best = size;
    }
  }
  return best;
}
