import { describe, expect, it } from "vitest";
import { SETTINGS_DOMAINS } from "../../shared/settingsDomains";
import { DOMAIN_TABLE_ENTRIES } from "./settingsDomains";

describe("DOMAIN_TABLE_ENTRIES", () => {
  it("has a table for every shared settings domain", () => {
    expect(DOMAIN_TABLE_ENTRIES.map((entry) => entry.key).sort()).toEqual(Object.keys(SETTINGS_DOMAINS).sort());
  });
});
