import { describe, expect, it } from "vitest";
import {
  buildGoogleEarthUrl,
  googleMapsSatelliteEmbedUrl,
  normalizeLocations,
  parseGoogleEarthUrl,
  parseTagsInput,
} from "./utils";

describe("parseGoogleEarthUrl", () => {
  it("reads latitude/longitude out of a real Google Earth Web share link", () => {
    const url =
      "https://earth.google.com/web/@61.57948147,-125.32754782,1052.35287405a,113081.50324836d,35y,0h,0t,0r/data=CjwaNhIwCiUweDUzZTEzZDNhMDg5MGJiYzk6MHg5ZWQwMjFhZTg4MTczYWEwKgdOYWhhbm5pGAIgAUICCAFCAggASg0I____________ARAA";
    expect(parseGoogleEarthUrl(url)).toEqual({ latitude: 61.57948147, longitude: -125.32754782 });
  });

  it("handles positive longitudes", () => {
    expect(parseGoogleEarthUrl("https://earth.google.com/web/@35.6586,139.7454,100a,500d,0y,0h,0t,0r")).toEqual({
      latitude: 35.6586,
      longitude: 139.7454,
    });
  });

  it("returns null for a non-Earth URL or malformed link", () => {
    expect(parseGoogleEarthUrl("https://en.wikipedia.org/wiki/Nahanni_National_Park_Reserve")).toBeNull();
    expect(parseGoogleEarthUrl("")).toBeNull();
    expect(parseGoogleEarthUrl("not a url")).toBeNull();
  });

  it("returns null when the parsed coordinates are out of range", () => {
    expect(parseGoogleEarthUrl("https://earth.google.com/web/@191.5,-125.3,100a,500d,0y,0h,0t,0r")).toBeNull();
  });
});

describe("parseTagsInput", () => {
  it("splits on commas, trims, dedupes, and drops blanks", () => {
    expect(parseTagsInput("glacial, hiking, , hiking ,remote")).toEqual(["glacial", "hiking", "remote"]);
  });

  it("returns an empty array for blank input", () => {
    expect(parseTagsInput("")).toEqual([]);
    expect(parseTagsInput("   ")).toEqual([]);
  });
});

describe("normalizeLocations", () => {
  it("drops entries without a name", () => {
    expect(normalizeLocations([{ latitude: 1, longitude: 2 }])).toEqual([]);
  });

  it("fills in defaults and coerces types for a minimal entry", () => {
    const [location] = normalizeLocations([{ name: "Scimitar Canyon" }]);
    expect(location.name).toBe("Scimitar Canyon");
    expect(location.latitude).toBeNull();
    expect(location.longitude).toBeNull();
    expect(location.tags).toEqual([]);
    expect(location.continent).toBe("");
    expect(typeof location.id).toBe("string");
    expect(location.id).not.toBe("");
  });

  it("rejects an unknown continent value instead of trusting untrusted input", () => {
    const [location] = normalizeLocations([{ name: "Somewhere", continent: "Atlantis" }]);
    expect(location.continent).toBe("");
  });

  it("keeps a valid continent and coordinate pair", () => {
    const [location] = normalizeLocations([
      { name: "Scimitar Canyon", continent: "North America", latitude: 61.58, longitude: -125.33 },
    ]);
    expect(location.continent).toBe("North America");
    expect(location.latitude).toBe(61.58);
    expect(location.longitude).toBe(-125.33);
  });

  it("accepts a settings-shaped wrapper object as well as a bare array", () => {
    expect(normalizeLocations({ locations: [{ name: "Wrapped" }] })).toHaveLength(1);
  });

  it("ignores non-array, non-wrapper input", () => {
    expect(normalizeLocations(null)).toEqual([]);
    expect(normalizeLocations(undefined)).toEqual([]);
    expect(normalizeLocations("nonsense")).toEqual([]);
  });
});

describe("buildGoogleEarthUrl", () => {
  it("produces a link parseGoogleEarthUrl can round-trip", () => {
    const url = buildGoogleEarthUrl(27.99583333, 86.87277778);
    expect(parseGoogleEarthUrl(url)).toEqual({ latitude: 27.99583333, longitude: 86.87277778 });
  });
});

describe("googleMapsSatelliteEmbedUrl", () => {
  it("builds a Maps Embed API 'view' URL with satellite imagery", () => {
    const url = googleMapsSatelliteEmbedUrl("test-key", 61.58, -125.33, 12);
    expect(url).toBe(
      "https://www.google.com/maps/embed/v1/view?key=test-key&center=61.58%2C-125.33&zoom=12&maptype=satellite",
    );
  });
});
