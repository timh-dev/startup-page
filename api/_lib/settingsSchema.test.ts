import { describe, expect, it } from "vitest";
import defaultSettings from "../../src/config/settings.json";
import { SETTINGS_DOMAINS } from "../../shared/settingsDomains";
import { settingsPutSchema, settingsSchema } from "./settingsSchema";

describe("settingsSchema", () => {
  it("covers exactly the keys the settings domains define", () => {
    const domainKeys = Object.values(SETTINGS_DOMAINS).flatMap((domain) => domain.keys).sort();
    expect(Object.keys(settingsSchema.shape).sort()).toEqual(domainKeys);
  });

  it("accepts the app's default settings", () => {
    expect(settingsSchema.safeParse(defaultSettings).success).toBe(true);
  });

  it("accepts coordinates stored as strings by older clients", () => {
    expect(settingsSchema.safeParse({ latitude: "40.7", longitude: "-74" }).success).toBe(true);
  });

  it("rejects a top-level value of the wrong type", () => {
    const result = settingsSchema.safeParse({ bookmark: "not a list" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["bookmark"]);
  });

  it("drops unknown top-level keys", () => {
    const result = settingsSchema.parse({ units: "metric", somethingElse: 1 });
    expect(result).toEqual({ units: "metric" });
  });
});

describe("settingsPutSchema", () => {
  it("requires a settings object", () => {
    expect(settingsPutSchema.safeParse({}).success).toBe(false);
    expect(settingsPutSchema.safeParse({ settings: [] }).success).toBe(false);
  });

  it("accepts an ISO timestamp or null for client_updated_at", () => {
    expect(settingsPutSchema.safeParse({ settings: {}, client_updated_at: "2026-10-22T12:00:00.000Z" }).success).toBe(true);
    expect(settingsPutSchema.safeParse({ settings: {}, client_updated_at: null }).success).toBe(true);
    expect(settingsPutSchema.safeParse({ settings: {}, client_updated_at: "yesterday" }).success).toBe(false);
  });
});
