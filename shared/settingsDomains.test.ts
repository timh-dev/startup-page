import { describe, expect, it } from "vitest";
import { DOMAIN_SETTINGS_KEYS, SETTINGS_DOMAINS, assembleSettings, sliceSettings } from "./settingsDomains";

const example = {
  bookmark: [{ id: "b1", title: "Group", content: [] }],
  widgets: [{ id: "w1", type: "clock", size: "small", config: {} }],
  layout: { hiddenBoxes: { clock: true } },
  vaultItems: [{ id: "v1", kind: "code", title: "Snippet" }],
  readItems: [{ id: "r1", url: "https://example.com" }],
  customThemes: [{ id: "t1", name: "Custom" }],
  ui: { themeMode: "dark" },
  latitude: 40.7,
  longitude: -74,
  units: "imperial",
  featurePanel: { mode: "windy" },
  search: { engines: [] },
  decorativeVideo: { urls: [] },
  news: { subreddit: "worldnews" },
  timer: { focusMinutes: 25 },
  unsplash: { unsplashBox1: ["desert"] },
};

describe("sliceSettings / assembleSettings", () => {
  it("round-trips every domain key", () => {
    expect(assembleSettings(sliceSettings(example))).toEqual(example);
  });

  it("uses the key's value for single-key domains and an object for multi-key ones", () => {
    const slices = sliceSettings(example);
    expect(slices.bookmarks).toBe(example.bookmark);
    expect(slices.widgets).toEqual({ widgets: example.widgets, layout: example.layout });
    expect(slices.preferences).toMatchObject({ units: "imperial", ui: { themeMode: "dark" } });
    expect(slices.preferences).not.toHaveProperty("bookmark");
  });

  it("leaves out keys that aren't domain settings", () => {
    expect(sliceSettings({ ...example, somethingElse: 1 } as Record<string, unknown>)).toEqual(sliceSettings(example));
  });

  it("assembles only the domains given", () => {
    expect(assembleSettings({ themes: [] })).toEqual({ customThemes: [] });
  });

  it("lists every domain key once", () => {
    const keys = Object.values(SETTINGS_DOMAINS).flatMap((domain) => domain.keys);
    expect([...DOMAIN_SETTINGS_KEYS].sort()).toEqual([...keys].sort());
    expect(new Set(keys).size).toBe(keys.length);
  });
});
