import { describe, expect, it } from "vitest";
import type { WidgetInstance } from "@/lib/dashboard-dimensions";
import { applyLayout, nearestSize, placeTile, resolveLayout, rowCount } from "./grid";

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
