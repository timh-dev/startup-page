import { describe, expect, it } from "vitest";
import defaultSettings from "../../src/config/settings.json";
import { SETTINGS_DOMAINS, sliceSettings } from "../../shared/settingsDomains";
import { domainDataSchemas, settingsPutSchema } from "./settingsSchema";

describe("domainDataSchemas", () => {
  it("has a schema for every domain", () => {
    expect(Object.keys(domainDataSchemas).sort()).toEqual(Object.keys(SETTINGS_DOMAINS).sort());
  });

  it("covers exactly the keys of each multi-key domain", () => {
    expect(Object.keys(domainDataSchemas.preferences.shape).sort()).toEqual([...SETTINGS_DOMAINS.preferences.keys].sort());
    expect(Object.keys(domainDataSchemas.widgets.shape).sort()).toEqual([...SETTINGS_DOMAINS.widgets.keys].sort());
  });

  it("accepts every domain of the app's default settings", () => {
    const slices = sliceSettings(defaultSettings);
    for (const [id, schema] of Object.entries(domainDataSchemas)) {
      expect(schema.safeParse(slices[id as keyof typeof slices]).success, id).toBe(true);
    }
  });

  it("accepts coordinates stored as strings by older clients", () => {
    expect(domainDataSchemas.preferences.safeParse({ latitude: "40.7", longitude: "-74" }).success).toBe(true);
  });

  it("drops keys a domain doesn't hold, including old API key settings", () => {
    expect(domainDataSchemas.preferences.parse({ units: "metric", unsplashCredential: "secret" })).toEqual({ units: "metric" });
  });
});

describe("settingsPutSchema", () => {
  it("accepts changed domains with their base versions", () => {
    const result = settingsPutSchema.safeParse({
      domains: { bookmarks: { data: [], base_version: 3 }, preferences: { data: { units: "metric" }, base_version: 0 } },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a domain whose data has the wrong shape", () => {
    const result = settingsPutSchema.safeParse({ domains: { bookmarks: { data: "not a list", base_version: 1 } } });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["domains", "bookmarks", "data"]);
  });

  it("requires a non-negative integer base version", () => {
    expect(settingsPutSchema.safeParse({ domains: { themes: { data: [] } } }).success).toBe(false);
    expect(settingsPutSchema.safeParse({ domains: { themes: { data: [], base_version: -1 } } }).success).toBe(false);
    expect(settingsPutSchema.safeParse({ domains: { themes: { data: [], base_version: 1.5 } } }).success).toBe(false);
  });
});
