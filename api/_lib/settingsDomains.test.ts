import { describe, expect, it } from "vitest";
import { assembleSettings, maxTimestamp, sliceSettingsIntoDomains } from "./settingsDomains";

describe("sliceSettingsIntoDomains / assembleSettings", () => {
  const exampleSettings = {
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
    unsplashCredential: "unsplash-key",
    openWeatherCredential: "weather-key",
    featurePanel: { mode: "windy" },
    search: { engines: [] },
    decorativeVideo: { urls: [] },
    news: { subreddit: "worldnews" },
    timer: { focusMinutes: 25 },
    unsplash: { unsplashBox1: ["desert"] },
  };

  it("round-trips a full settings object through slice → assemble unchanged", () => {
    const sliced = sliceSettingsIntoDomains(exampleSettings);
    const rows = {
      bookmarks: { data: sliced.bookmarks, clientUpdatedAt: null, serverUpdatedAt: new Date() },
      widgets: { data: sliced.widgets, clientUpdatedAt: null, serverUpdatedAt: new Date() },
      vaultItems: { data: sliced.vaultItems, clientUpdatedAt: null, serverUpdatedAt: new Date() },
      readItems: { data: sliced.readItems, clientUpdatedAt: null, serverUpdatedAt: new Date() },
      themes: { data: sliced.themes, clientUpdatedAt: null, serverUpdatedAt: new Date() },
      preferences: { data: sliced.preferences, clientUpdatedAt: null, serverUpdatedAt: new Date() },
    };

    expect(assembleSettings(rows)).toEqual(exampleSettings);
  });

  it("keeps widgets and layout bundled together in the same domain", () => {
    const sliced = sliceSettingsIntoDomains(exampleSettings);
    expect(sliced.widgets).toEqual({ widgets: exampleSettings.widgets, layout: exampleSettings.layout });
  });

  it("buckets every non-dedicated key under preferences", () => {
    const sliced = sliceSettingsIntoDomains(exampleSettings);
    expect(sliced.preferences).toMatchObject({
      latitude: 40.7,
      units: "imperial",
      openWeatherCredential: "weather-key",
    });
    expect(sliced.preferences).not.toHaveProperty("bookmark");
    expect(sliced.preferences).not.toHaveProperty("vaultItems");
  });

  it("defaults every domain to an empty shape when no rows exist yet", () => {
    expect(assembleSettings({})).toEqual({
      bookmark: [],
      widgets: [],
      layout: {},
      vaultItems: [],
      readItems: [],
      customThemes: [],
    });
  });
});

describe("maxTimestamp", () => {
  it("returns the latest of several row timestamps", () => {
    const rows = [
      { data: null, clientUpdatedAt: new Date("2024-01-01"), serverUpdatedAt: new Date("2024-01-01") },
      { data: null, clientUpdatedAt: new Date("2024-03-01"), serverUpdatedAt: new Date("2024-03-01") },
      undefined,
    ];
    expect(maxTimestamp(rows, "clientUpdatedAt")?.toISOString()).toBe(new Date("2024-03-01").toISOString());
  });

  it("returns null when no row has that field set", () => {
    const rows = [undefined, { data: null, clientUpdatedAt: null, serverUpdatedAt: new Date() }];
    expect(maxTimestamp(rows, "clientUpdatedAt")).toBeNull();
  });
});
