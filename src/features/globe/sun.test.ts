import { describe, expect, it } from "vitest";
import { subsolarPoint, sunElevation } from "./sun";

describe("subsolarPoint", () => {
  it("follows the tilt: over the Tropic of Cancer in June, Capricorn in December", () => {
    expect(subsolarPoint(new Date("2026-06-21T12:00:00Z")).latitude).toBeCloseTo(23.44, 0);
    expect(subsolarPoint(new Date("2026-12-21T12:00:00Z")).latitude).toBeCloseTo(-23.44, 0);
    expect(Math.abs(subsolarPoint(new Date("2026-03-20T12:00:00Z")).latitude)).toBeLessThan(0.6);
  });

  it("is near Greenwich at 12:00 UTC and moves west 15° an hour", () => {
    // The equation of time keeps it within ~4° of 0°.
    expect(Math.abs(subsolarPoint(new Date("2026-06-21T12:00:00Z")).longitude)).toBeLessThan(4.5);
    const noon = subsolarPoint(new Date("2026-06-21T12:00:00Z")).longitude;
    const later = subsolarPoint(new Date("2026-06-21T13:00:00Z")).longitude;
    expect(noon - later).toBeCloseTo(15, 0);
  });
});

describe("sunElevation", () => {
  const utqiagvik = { lat: 71.29, lon: -156.79 }; // northern Alaska

  it("gives Alaska 24-hour sun in June and none in December", () => {
    const hours = Array.from({ length: 24 }, (_, h) => h);
    const june = hours.map((h) => sunElevation(utqiagvik.lat, utqiagvik.lon, new Date(Date.UTC(2026, 5, 21, h))));
    const december = hours.map((h) => sunElevation(utqiagvik.lat, utqiagvik.lon, new Date(Date.UTC(2026, 11, 21, h))));
    expect(Math.min(...june)).toBeGreaterThan(0);
    expect(Math.max(...december)).toBeLessThan(0);
  });

  it("puts the sun high at local noon on the equator at the equinox", () => {
    expect(sunElevation(0, 0, new Date("2026-03-20T12:07:00Z"))).toBeGreaterThan(85);
  });
});
