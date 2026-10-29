import { describe, expect, it } from "vitest";
import { apply, earthToView, shotFor, targetFor } from "./framing";
import { toVector } from "./sun";

const chicago = { lat: 41.88, lon: -87.63 };

describe("earthToView", () => {
  it("turns the viewer's location to face the camera with north up (globe view)", () => {
    const m = earthToView(chicago.lat, chicago.lon, [0, 0, 1]);
    const here = apply(m, toVector(chicago.lat, chicago.lon));
    expect(here[2]).toBeCloseTo(1, 6);
    // A point a little north appears higher on screen.
    const north = apply(m, toVector(chicago.lat + 5, chicago.lon));
    expect(north[1]).toBeGreaterThan(0.05);
    expect(Math.abs(north[0])).toBeLessThan(1e-6);
    // East is to the right.
    expect(apply(m, toVector(chicago.lat, chicago.lon + 5))[0]).toBeGreaterThan(0.05);
  });

  it("puts the viewer's location on the visible limb in the limb view", () => {
    const shot = shotFor("limb", 1);
    const target = targetFor(shot, 1);
    // On the near side, close to the edge (the normal is nearly side-on).
    expect(target[2]).toBeGreaterThan(0);
    expect(target[2]).toBeLessThan(0.6);
    const m = earthToView(chicago.lat, chicago.lon, target);
    const here = apply(m, toVector(chicago.lat, chicago.lon));
    for (let i = 0; i < 3; i++) expect(here[i]).toBeCloseTo(target[i], 6);
  });

  it("copes with the poles", () => {
    const m = earthToView(90, 0, [0, 0, 1]);
    expect(apply(m, [0, 0, 1])[2]).toBeCloseTo(1, 6);
  });
});
