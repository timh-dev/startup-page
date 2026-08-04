import { describe, expect, it } from "vitest";
import { deepEqual, mergeSettings, mergeSettingsSnapshots, normalizeSettingsShape } from "./settings";

describe("deepEqual", () => {
  it("treats identical primitives as equal", () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual("a", "a")).toBe(true);
    expect(deepEqual(1, 2)).toBe(false);
    expect(deepEqual("a", "b")).toBe(false);
  });

  it("is order-independent for object keys", () => {
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it("is order-sensitive for arrays", () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(deepEqual([1, 2, 3], [3, 2, 1])).toBe(false);
  });

  it("recurses into nested structures", () => {
    const a = { widgets: [{ id: "x", config: { groupId: "g1" } }] };
    const b = { widgets: [{ id: "x", config: { groupId: "g1" } }] };
    const c = { widgets: [{ id: "x", config: { groupId: "g2" } }] };
    expect(deepEqual(a, b)).toBe(true);
    expect(deepEqual(a, c)).toBe(false);
  });

  it("treats null and non-null as unequal even when typeof matches", () => {
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual(null, {})).toBe(false);
    expect(deepEqual({}, null)).toBe(false);
  });

  it("rejects objects with different key counts", () => {
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
});

describe("mergeSettings", () => {
  it("fills missing keys from the default and keeps saved overrides", () => {
    const result = mergeSettings({ a: 1, b: 2 }, { a: 99 });
    expect(result).toEqual({ a: 99, b: 2 });
  });

  it("falls back to the whole default object when saved isn't a plain object", () => {
    expect(mergeSettings({ a: 1 }, null)).toEqual({ a: 1 });
    expect(mergeSettings({ a: 1 }, "nope")).toEqual({ a: 1 });
  });

  it("recurses into nested default objects", () => {
    const result = mergeSettings({ ui: { theme: "zen", size: 9 } }, { ui: { theme: "sunset" } });
    expect(result).toEqual({ ui: { theme: "sunset", size: 9 } });
  });

  it("falls back to the default array when saved isn't an array", () => {
    expect(mergeSettings({ list: [1, 2] }, { list: "nope" })).toEqual({ list: [1, 2] });
  });

  it("merges array items positionally against the default template, keeping extras", () => {
    const defaultValue = [{ a: 1, b: 2 }];
    const saved = [{ a: 99 }, { a: 5, b: 6 }];
    expect(mergeSettings(defaultValue, saved)).toEqual([{ a: 99, b: 2 }, { a: 5, b: 6 }]);
  });

  it("keeps a defined primitive override and falls back to default when undefined", () => {
    expect(mergeSettings("default", "override")).toBe("override");
    expect(mergeSettings("default", undefined)).toBe("default");
  });
});

describe("normalizeSettingsShape", () => {
  it("preserves an explicit widgets array instead of synthesizing one", () => {
    const widgets = [{ id: "w1", type: "clock", size: "small", config: {} }];
    const result = normalizeSettingsShape({ widgets });
    expect(result.widgets).toEqual(widgets);
  });

  it("synthesizes a non-empty widgets array from legacy layout when widgets is missing", () => {
    const result = normalizeSettingsShape({});
    expect(Array.isArray(result.widgets)).toBe(true);
    expect(result.widgets.length).toBeGreaterThan(0);
    // The legacy migration always includes a search tile and at least one bookmark tile.
    expect(result.widgets.some((w: any) => w.type === "search")).toBe(true);
    expect(result.widgets.some((w: any) => w.type === "bookmark")).toBe(true);
  });

  it("does not re-synthesize widgets for a record that already has an (empty) widgets array", () => {
    const result = normalizeSettingsShape({ widgets: [] });
    expect(result.widgets).toEqual([]);
  });

  it("backfills bookmark ids", () => {
    const result = normalizeSettingsShape({
      bookmark: [{ title: "Folder", content: [{ name: "Example", url: "https://example.com" }] }],
    });
    expect(result.bookmark[0].id).toBeTruthy();
    expect(result.bookmark[0].content[0].id).toBeTruthy();
  });

  it("migrates a legacy single decorativeVideo.url into the urls array once urls is explicitly empty", () => {
    // `urls` merges in from the default (non-empty) template when it's simply
    // absent, so the legacy `url` fallback only actually kicks in once the
    // saved record has an explicit empty `urls` array to override that default.
    const result = normalizeSettingsShape({ decorativeVideo: { url: "https://example.com/clip.mp4", urls: [] } });
    expect(result.decorativeVideo.urls).toEqual(["https://example.com/clip.mp4"]);
  });

  it("keeps the default decorativeVideo urls when only a legacy url is given with no explicit empty urls array", () => {
    const result = normalizeSettingsShape({ decorativeVideo: { url: "https://example.com/clip.mp4" } });
    expect(result.decorativeVideo.urls).not.toEqual(["https://example.com/clip.mp4"]);
    expect(result.decorativeVideo.urls.length).toBeGreaterThan(0);
  });

  it("drops blank/whitespace-only decorativeVideo urls and caps the list at 10", () => {
    const urls = [" ", "", ...Array.from({ length: 12 }, (_, i) => `https://example.com/${i}.mp4`)];
    const result = normalizeSettingsShape({ decorativeVideo: { urls } });
    expect(result.decorativeVideo.urls).toHaveLength(10);
    expect(result.decorativeVideo.urls.every((u: string) => u.trim() !== "")).toBe(true);
  });
});

describe("mergeSettingsSnapshots", () => {
  it("keeps independent edits to different keys from both devices — the motivating case", () => {
    const base = { widgets: ["a"], bookmark: ["x"], ui: { theme: "zen" } };
    const local = { widgets: ["a", "desktop-added"], bookmark: ["x"], ui: { theme: "zen" } };
    const cloud = { widgets: ["a"], bookmark: ["x", "phone-added"], ui: { theme: "zen" } };

    const { merged, conflictKeys, localHasUniqueChanges } = mergeSettingsSnapshots(base, local, cloud, 100, 200);

    expect(merged.widgets).toEqual(["a", "desktop-added"]);
    expect(merged.bookmark).toEqual(["x", "phone-added"]);
    expect(conflictKeys).toEqual([]);
    expect(localHasUniqueChanges).toBe(true);
  });

  it("adopts a cloud-only change with no conflict and nothing to push", () => {
    const base = { widgets: ["a"] };
    const { merged, conflictKeys, localHasUniqueChanges } = mergeSettingsSnapshots(
      base,
      { widgets: ["a"] },
      { widgets: ["a", "b"] },
      500,
      100,
    );
    expect(merged.widgets).toEqual(["a", "b"]);
    expect(conflictKeys).toEqual([]);
    expect(localHasUniqueChanges).toBe(false);
  });

  it("keeps a local-only offline edit and flags it for push", () => {
    const base = { widgets: ["a"] };
    const { merged, conflictKeys, localHasUniqueChanges } = mergeSettingsSnapshots(
      base,
      { widgets: ["a", "offline-edit"] },
      { widgets: ["a"] },
      100,
      500,
    );
    expect(merged.widgets).toEqual(["a", "offline-edit"]);
    expect(conflictKeys).toEqual([]);
    expect(localHasUniqueChanges).toBe(true);
  });

  it("resolves a genuine same-key conflict in favor of whichever side is newer", () => {
    const base = { ui: { theme: "zen" } };
    const local = { ui: { theme: "sunset" } };
    const cloud = { ui: { theme: "midnight" } };

    const cloudNewer = mergeSettingsSnapshots(base, local, cloud, 500, 100);
    expect(cloudNewer.merged.ui).toEqual({ theme: "midnight" });
    expect(cloudNewer.conflictKeys).toEqual(["ui"]);

    const localNewer = mergeSettingsSnapshots(base, local, cloud, 100, 500);
    expect(localNewer.merged.ui).toEqual({ theme: "sunset" });
    expect(localNewer.conflictKeys).toEqual(["ui"]);
  });

  it("does not flag a conflict when both sides changed a key to the same value", () => {
    const base = { timer: { focusMinutes: 25 } };
    const { merged, conflictKeys } = mergeSettingsSnapshots(
      base,
      { timer: { focusMinutes: 50 } },
      { timer: { focusMinutes: 50 } },
      100,
      200,
    );
    expect(merged.timer).toEqual({ focusMinutes: 50 });
    expect(conflictKeys).toEqual([]);
  });

  it("leaves a key untouched by either side alone", () => {
    const base = { unsplashCredential: "abc123" };
    const { merged, conflictKeys, localHasUniqueChanges } = mergeSettingsSnapshots(
      base,
      { unsplashCredential: "abc123" },
      { unsplashCredential: "abc123" },
      100,
      100,
    );
    expect(merged.unsplashCredential).toBe("abc123");
    expect(conflictKeys).toEqual([]);
    expect(localHasUniqueChanges).toBe(false);
  });

  it("handles a key that exists only in one side's snapshot (e.g. a newly added settings field)", () => {
    const base = {};
    const { merged, conflictKeys } = mergeSettingsSnapshots(base, { newField: "local" }, {}, 100, 100);
    expect(merged.newField).toBe("local");
    expect(conflictKeys).toEqual([]);
  });
});
