import { describe, expect, it } from "vitest";
import { activeSeams, adjacentSeams, groupOutline, groupsOf, seamBetween, seamPx } from "./joins";
import type { Placement } from "./grid";

const p = (id: string, x: number, y: number, w = 1, h = 1): Placement => ({ id, x, y, w, h });

describe("seams", () => {
  it("finds side-by-side and stacked neighbours, with their shared span", () => {
    expect(seamBetween(p("a", 0, 0, 2, 1), p("b", 2, 0))).toMatchObject({ a: "a", b: "b", orientation: "v", line: 2, from: 0, to: 1 });
    expect(seamBetween(p("a", 0, 0, 2, 1), p("b", 1, 1))).toMatchObject({ a: "a", b: "b", orientation: "h", line: 1, from: 1, to: 2 });
    expect(seamBetween(p("a", 0, 0), p("b", 2, 0))).toBeNull(); // a column apart
    expect(seamBetween(p("a", 0, 3), p("b", 0, 4))).toBeNull(); // different pages
  });

  it("keeps only joins that still touch, and groups chains", () => {
    const layout = new Map([p("a", 0, 0), p("b", 1, 0), p("c", 2, 0), p("d", 5, 0)].map((q) => [q.id, q]));
    expect(adjacentSeams(layout)).toHaveLength(2);
    const seams = activeSeams(layout, [["a", "b"], ["b", "c"], ["c", "d"]]);
    expect(seams).toHaveLength(2);
    expect(groupsOf(seams).get("a")?.sort()).toEqual(["a", "b", "c"]);
    expect(groupsOf(seams).has("d")).toBe(false);
  });
});

describe("geometry", () => {
  const m = { cell: 110, gap: 10, span: (n: number) => n * 100 + (n - 1) * 10, rowTop: (r: number) => r * 110 };

  it("puts a seam's centre line in the middle of the gap", () => {
    const s = seamPx({ a: "a", b: "b", orientation: "v", line: 1, from: 0, to: 1 }, m);
    expect(s.center).toBe(105);
    expect([s.from, s.to]).toEqual([0, 100]);
  });

  it("traces one outline around an L-shaped group", () => {
    // A 2x1 over a 1x1 at the left, joined across the gap.
    const d = groupOutline([{ x: 0, y: 0, w: 210, h: 100 }, { x: 0, y: 110, w: 100, h: 100 }, { x: 0, y: 100, w: 100, h: 10 }], 12);
    expect(d.match(/M/g)).toHaveLength(1);
    expect(d.match(/Q/g)).toHaveLength(6); // an L has six corners
  });
});
