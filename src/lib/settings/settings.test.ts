import { describe, expect, it } from "vitest";
import {
  deepEqual,
  mergeImportedDomains,
  mergeSettings,
  normalizeSettingsShape,
  pickSettingsDomain,
  previewImportPayload,
} from ".";

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

describe("pickSettingsDomain", () => {
  it("keeps only the requested keys that are present", () => {
    const settings = { bookmark: ["a"], vaultItems: ["b"], ui: { themeMode: "dark" } };
    expect(pickSettingsDomain(settings, ["bookmark", "vaultItems"])).toEqual({
      bookmark: ["a"],
      vaultItems: ["b"],
    });
  });

  it("omits requested keys that don't exist on the source object", () => {
    expect(pickSettingsDomain({ bookmark: ["a"] }, ["bookmark", "readItems"])).toEqual({ bookmark: ["a"] });
  });
});

describe("mergeImportedDomains", () => {
  it("only overwrites keys belonging to the selected domains, leaving the rest of current untouched", () => {
    const current = { bookmark: ["current-bookmark"], vaultItems: ["current-vault"], ui: { themeMode: "dark" } };
    const imported = { bookmark: ["imported-bookmark"], vaultItems: ["imported-vault"], ui: { themeMode: "light" } };

    const merged = mergeImportedDomains(current, imported, ["bookmarks"]);

    expect(merged.bookmark).toEqual(["imported-bookmark"]);
    expect(merged.vaultItems).toEqual(["current-vault"]);
    expect(merged.ui).toEqual({ themeMode: "dark" });
  });

  it("applies multiple selected domains at once", () => {
    const current = { bookmark: ["current"], readItems: ["current"] };
    const imported = { bookmark: ["imported"], readItems: ["imported"] };

    const merged = mergeImportedDomains(current, imported, ["bookmarks", "readItems"]);

    expect(merged).toEqual({ bookmark: ["imported"], readItems: ["imported"] });
  });

  it("is a no-op when no domains are selected", () => {
    const current = { bookmark: ["current"] };
    const imported = { bookmark: ["imported"] };
    expect(mergeImportedDomains(current, imported, [])).toEqual(current);
  });
});

describe("previewImportPayload", () => {
  it("detects only the domains actually present in the raw file, not every default key", () => {
    const raw = JSON.stringify({ settings: { bookmark: [{ id: "a" }] } });
    const preview = previewImportPayload(raw);
    expect(preview.presentDomains).toEqual(["bookmarks"]);
  });

  it("groups widgets and layout under the same domain", () => {
    const raw = JSON.stringify({ settings: { layout: { hiddenBoxes: {} } } });
    const preview = previewImportPayload(raw);
    expect(preview.presentDomains).toEqual(["widgets"]);
  });

  it("detects multiple domains and a preferences-only key", () => {
    const raw = JSON.stringify({ settings: { vaultItems: [], units: "metric" } });
    const preview = previewImportPayload(raw);
    expect(preview.presentDomains.sort()).toEqual(["preferences", "vaultItems"]);
  });

  it("reports no domains for a file with no recognized keys", () => {
    const raw = JSON.stringify({ settings: { someUnknownField: true } });
    expect(previewImportPayload(raw).presentDomains).toEqual([]);
  });

  it("still returns a fully normalized settings object for reference/apply", () => {
    const raw = JSON.stringify({ settings: { bookmark: [] } });
    const preview = previewImportPayload(raw);
    expect(preview.settings).toHaveProperty("widgets");
    expect(preview.settings).toHaveProperty("ui");
  });

  it("throws on invalid JSON", () => {
    expect(() => previewImportPayload("not json")).toThrow();
  });
});
