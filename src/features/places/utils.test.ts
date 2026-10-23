import { describe, expect, it } from "vitest";
import { normalizePlaces } from "./utils";

describe("normalizePlaces", () => {
  it("drops items with no name or invalid lat/lng", () => {
    const result = normalizePlaces([
      { name: "", lat: 35, lng: 139 },
      { name: "No coords" },
      { name: "Bad lat", lat: 999, lng: 139 },
      { name: "Bad lng", lat: 35, lng: -999 },
      { name: "Kept", lat: 35.6446, lng: 139.6989 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Kept");
  });

  it("defaults an unrecognized tag to 'Other'", () => {
    const [item] = normalizePlaces([{ name: "x", lat: 1, lng: 1, tag: "NotARealTag" }]);
    expect(item.tag).toBe("Other");
  });

  it("preserves a valid tag", () => {
    const [item] = normalizePlaces([{ name: "x", lat: 1, lng: 1, tag: "Cafe" }]);
    expect(item.tag).toBe("Cafe");
  });

  it("defaults source to 'search' unless explicitly 'manual'", () => {
    const [searchItem] = normalizePlaces([{ name: "x", lat: 1, lng: 1, source: "whatever" }]);
    const [manualItem] = normalizePlaces([{ name: "y", lat: 1, lng: 1, source: "manual" }]);
    expect(searchItem.source).toBe("search");
    expect(manualItem.source).toBe("manual");
  });

  it("defaults osmId to null when missing", () => {
    const [item] = normalizePlaces([{ name: "x", lat: 1, lng: 1 }]);
    expect(item.osmId).toBeNull();
  });

  it("generates an id and timestamps when missing, and reuses a valid createdAt for updatedAt", () => {
    const [item] = normalizePlaces([{ name: "x", lat: 1, lng: 1, createdAt: "2024-01-01T00:00:00.000Z" }]);
    expect(item.id).toBeTruthy();
    expect(item.createdAt).toBe("2024-01-01T00:00:00.000Z");
    expect(item.updatedAt).toBe("2024-01-01T00:00:00.000Z");
  });

  it("accepts a { places: [...] } or { items: [...] } wrapper as well as a bare array", () => {
    const fromPlaces = normalizePlaces({ places: [{ name: "x", lat: 1, lng: 1 }] });
    const fromItems = normalizePlaces({ items: [{ name: "x", lat: 1, lng: 1 }] });
    expect(fromPlaces).toHaveLength(1);
    expect(fromItems).toHaveLength(1);
  });

  it("returns an empty array for unrecognized input shapes", () => {
    expect(normalizePlaces(null)).toEqual([]);
    expect(normalizePlaces("nope")).toEqual([]);
  });
});
