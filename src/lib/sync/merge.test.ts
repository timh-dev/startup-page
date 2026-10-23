import { describe, expect, it } from "vitest";
import { merge3 } from "./merge";

describe("merge3", () => {
  it("takes whichever side changed", () => {
    expect(merge3("a", "a", "b").value).toBe("b");
    expect(merge3("a", "b", "a").value).toBe("b");
    expect(merge3("a", "b", "b").value).toBe("b");
  });

  it("merges different keys changed on each side", () => {
    const base = { themeMode: "light", cardStyle: "rounded" };
    const result = merge3(base, { ...base, themeMode: "dark" }, { ...base, cardStyle: "sharp" });
    expect(result.value).toEqual({ themeMode: "dark", cardStyle: "sharp" });
    expect(result.conflicts).toEqual([]);
  });

  it("merges nested objects key by key", () => {
    const base = { ui: { themeMode: "light", tileSize: 9 }, units: "imperial" };
    const result = merge3(base, { ...base, ui: { ...base.ui, tileSize: 11 } }, { ...base, ui: { ...base.ui, themeMode: "dark" } });
    expect(result.value).toEqual({ ui: { themeMode: "dark", tileSize: 11 }, units: "imperial" });
  });

  it("keeps a key deleted on one side when it wasn't changed on the other", () => {
    expect(merge3({ a: 1, b: 2 }, { a: 1 }, { a: 1, b: 2 }).value).toEqual({ a: 1 });
  });

  it("keeps an edit over a delete", () => {
    expect(merge3({ a: 1, b: 2 }, { a: 1 }, { a: 1, b: 3 }).value).toEqual({ a: 1, b: 3 });
  });

  it("reports a same-value conflict and keeps local", () => {
    const result = merge3({ units: "imperial" }, { units: "metric" }, { units: "kelvin" });
    expect(result.value).toEqual({ units: "metric" });
    expect(result.conflicts).toEqual([["units"]]);
  });

  describe("lists of entries with ids", () => {
    const a = { id: "a", title: "A" };
    const b = { id: "b", title: "B" };
    const c = { id: "c", title: "C" };

    it("keeps edits to different entries", () => {
      const result = merge3([a, b], [{ ...a, title: "A2" }, b], [a, { ...b, title: "B2" }]);
      expect(result.value).toEqual([{ id: "a", title: "A2" }, { id: "b", title: "B2" }]);
      expect(result.conflicts).toEqual([]);
    });

    it("keeps edits to different fields of the same entry", () => {
      const base = { id: "a", title: "A", body: "x" };
      const result = merge3([base], [{ ...base, title: "A2" }], [{ ...base, body: "y" }]);
      expect(result.value).toEqual([{ id: "a", title: "A2", body: "y" }]);
    });

    it("keeps additions from both sides, each next to its neighbour", () => {
      expect(merge3([a], [a, b], [a, c]).value).toEqual([a, b, c]);
      // Newest-first lists (the vault prepends) keep both new entries on top.
      expect(merge3([a], [b, a], [c, a]).value).toEqual([b, c, a]);
    });

    it("applies a delete from either side", () => {
      expect(merge3([a, b, c], [a, c], [a, b, c]).value).toEqual([a, c]);
      expect(merge3([a, b, c], [a, b, c], [a, b]).value).toEqual([a, b]);
    });

    it("keeps an entry edited on one side and deleted on the other", () => {
      expect(merge3([a, b], [a], [a, { ...b, title: "B2" }]).value).toEqual([a, { id: "b", title: "B2" }]);
    });

    it("keeps a local reorder when remote didn't reorder", () => {
      expect(merge3([a, b, c], [c, a, b], [a, b, c]).value).toEqual([c, a, b]);
    });

    it("resolves a same-field conflict by the entry's updatedAt", () => {
      const base = { id: "a", title: "A", updatedAt: "2026-10-01T00:00:00.000Z" };
      const local = { ...base, title: "local", updatedAt: "2026-10-02T00:00:00.000Z" };
      const remote = { ...base, title: "remote", updatedAt: "2026-10-03T00:00:00.000Z" };
      const result = merge3([base], [local], [remote]);
      expect(result.value).toEqual([remote]);
      expect(result.conflicts).toEqual([["a", "title"]]);
    });

    it("merges nested lists (bookmark groups and their links)", () => {
      const link1 = { id: "l1", url: "https://one" };
      const link2 = { id: "l2", url: "https://two" };
      const group = { id: "g", title: "Group", content: [link1] };
      const result = merge3(
        [group],
        [{ ...group, content: [link1, link2] }],
        [{ ...group, title: "Renamed" }],
      );
      expect(result.value).toEqual([{ id: "g", title: "Renamed", content: [link1, link2] }]);
    });
  });

  it("treats lists without ids as single values", () => {
    const result = merge3(["a"], ["a", "b"], ["a", "c"]);
    expect(result.value).toEqual(["a", "b"]);
    expect(result.conflicts).toEqual([[]]);
  });
});
