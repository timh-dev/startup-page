import { describe, expect, it } from "vitest";
import type { WidgetInstance } from "@/lib/dashboard-dimensions";
import { PAGE_ROWS, applyLayout, nearestSize, pageCount, placeGroup, placeTile, reflowRows, resolveLayout, rowCount } from "./grid";

const card = (id: string, size: WidgetInstance["size"] = "small", pos?: { x: number; y: number }): WidgetInstance => ({ id, type: "clock", size, config: {}, ...(pos ? { pos } : {}) });

describe("resolveLayout", () => {
  it("packs cards without positions densely, in order", () => {
    const layout = resolveLayout([card("a", "large"), card("b"), card("c"), card("d", "wide")], 4);
    expect(layout.get("a")).toMatchObject({ x: 0, y: 0, w: 2, h: 2 });
    expect(layout.get("b")).toMatchObject({ x: 2, y: 0 });
    expect(layout.get("c")).toMatchObject({ x: 3, y: 0 });
    expect(layout.get("d")).toMatchObject({ x: 2, y: 1 });
  });

  it("keeps saved positions, gaps and all", () => {
    const layout = resolveLayout([card("a", "small", { x: 3, y: 2 }), card("b")], 5);
    expect(layout.get("a")).toMatchObject({ x: 3, y: 2 });
    expect(layout.get("b")).toMatchObject({ x: 0, y: 0 });
  });

  it("re-places cards that collide or fall off a narrower grid", () => {
    const layout = resolveLayout([card("a", "small", { x: 0, y: 0 }), card("b", "small", { x: 0, y: 0 }), card("c", "wide", { x: 6, y: 0 })], 5);
    expect(layout.get("a")).toMatchObject({ x: 0, y: 0 });
    expect(layout.get("b")).toMatchObject({ x: 1, y: 0 });
    expect(layout.get("c")).toMatchObject({ x: 2, y: 0 });
  });
});

describe("placeTile", () => {
  it("moves a card to a free spot without touching the others", () => {
    const layout = resolveLayout([card("a"), card("b"), card("c")], 4);
    const next = placeTile(layout, "a", { x: 3, y: 2 }, { w: 1, h: 1 }, 4);
    expect(next.get("a")).toMatchObject({ x: 3, y: 2 });
    expect(next.get("b")).toMatchObject({ x: 1, y: 0 });
    expect(next.get("c")).toMatchObject({ x: 2, y: 0 });
  });

  it("swaps with the card it lands on when that fits", () => {
    const layout = resolveLayout([card("a"), card("b"), card("c")], 4);
    const next = placeTile(layout, "c", { x: 0, y: 0 }, { w: 1, h: 1 }, 4);
    expect(next.get("c")).toMatchObject({ x: 0, y: 0 });
    expect(next.get("a")).toMatchObject({ x: 2, y: 0 });
    expect(next.get("b")).toMatchObject({ x: 1, y: 0 });
  });

  it("otherwise pushes cards to the free spot nearest where they were", () => {
    const layout = resolveLayout([card("a", "tall"), card("b"), card("c")], 4);
    // b moves onto the tall card a; a can't fit in b's 1x1 spot, so it shifts
    // to the nearest free column instead.
    const next = placeTile(layout, "b", { x: 0, y: 0 }, { w: 1, h: 1 }, 4);
    expect(next.get("b")).toMatchObject({ x: 0, y: 0 });
    expect(next.get("a")).toMatchObject({ x: 1, y: 0 });
    expect(next.get("c")).toMatchObject({ x: 2, y: 0 });
  });

  it("clamps to the grid and never overlaps after a resize", () => {
    const layout = resolveLayout([card("a"), card("b"), card("c"), card("d")], 4);
    const next = placeTile(layout, "d", { x: 3, y: 0 }, { w: 2, h: 2 }, 4);
    expect(next.get("d")).toMatchObject({ x: 2, y: 0, w: 2, h: 2 });
    const cells = new Set<string>();
    for (const p of next.values()) for (let x = p.x; x < p.x + p.w; x++) for (let y = p.y; y < p.y + p.h; y++) {
      expect(cells.has(`${x},${y}`)).toBe(false);
      cells.add(`${x},${y}`);
    }
    expect(rowCount(next)).toBeGreaterThanOrEqual(2);
  });
});

describe("applyLayout / nearestSize", () => {
  it("writes positions back", () => {
    const widgets = [card("a"), card("b")];
    expect(applyLayout(widgets, resolveLayout(widgets, 4))[1].pos).toEqual({ x: 1, y: 0 });
  });

  it("snaps a dragged size to the closest allowed one", () => {
    expect(nearestSize(2, 2, ["small", "wide", "tall", "large", "feature"])).toBe("large");
    expect(nearestSize(3, 1, ["small", "wide", "large"])).toBe("wide");
    expect(nearestSize(3, 2, ["feature"])).toBe("feature");
  });
});

describe("pages", () => {
  it("continues onto a second page past four rows, never splitting a card", () => {
    // Seven 1x2 cards in a 2-column grid: rows 0-1 and 2-3 fill page one,
    // the rest start page two (row 4) rather than straddling.
    const widgets = Array.from({ length: 7 }, (_, i) => card(`t${i}`, "tall"));
    const layout = resolveLayout(widgets, 2);
    for (const p of layout.values()) expect(Math.floor(p.y / PAGE_ROWS)).toBe(Math.floor((p.y + p.h - 1) / PAGE_ROWS));
    expect(layout.get("t4")).toMatchObject({ x: 0, y: 4 });
    expect(pageCount(layout)).toBe(2);
  });

  it("pulls a card up rather than let it hang onto the next page", () => {
    const layout = resolveLayout([card("a", "tall"), card("b")], 3);
    const next = placeTile(layout, "a", { x: 2, y: 3 }, { w: 1, h: 2 }, 3);
    expect(next.get("a")).toMatchObject({ x: 2, y: 2 });
  });
});

describe("placeGroup", () => {
  it("moves joined cards together, keeping their shape", () => {
    const layout = resolveLayout([card("a", "wide"), card("b"), card("c")], 4);
    // a (0,0 2x1) and b (2,0) move down one row together.
    const next = placeGroup(layout, [{ id: "a", x: 0, y: 1, w: 2, h: 1 }, { id: "b", x: 2, y: 1, w: 1, h: 1 }], 4);
    expect(next.get("a")).toMatchObject({ x: 0, y: 1 });
    expect(next.get("b")).toMatchObject({ x: 2, y: 1 });
    expect(next.get("c")).toMatchObject({ x: 3, y: 0 });
  });
});

describe("rows per page", () => {
  const card = (id: string, y: number, size: WidgetInstance["size"] = "small"): WidgetInstance => ({ id, type: "clock", size, config: {}, pos: { x: 0, y } });

  it("keeps each card on its page and row when rows change", () => {
    // Page 2 starts at row 4 with four rows, at row 5 with five.
    const next = reflowRows([card("a", 1), card("b", 4), card("c", 6)], 4, 5);
    expect(next.map((w) => w.pos?.y)).toEqual([1, 5, 7]);
  });

  it("frees cards whose row is gone, or that would hang over the new bottom", () => {
    const next = reflowRows([card("a", 3), card("b", 2, "tall"), card("c", 0, "tall")], 4, 3);
    expect(next.map((w) => w.pos)).toEqual([undefined, undefined, { x: 0, y: 0 }]);
  });

  it("pages and placement follow the number of rows", () => {
    const widgets = [card("a", 0), card("b", 5)];
    expect(pageCount(resolveLayout(widgets, 7, 6), 6)).toBe(1);
    expect(pageCount(resolveLayout(widgets, 7, 4), 4)).toBe(2);
    // A tall card can't straddle the page edge at row 3 of a 3-row page.
    const moved = placeTile(resolveLayout([card("t", 0, "tall")], 7, 3), "t", { x: 0, y: 2 }, { w: 1, h: 2 }, 7, 3);
    expect(moved.get("t")).toMatchObject({ y: 1 });
  });
});
