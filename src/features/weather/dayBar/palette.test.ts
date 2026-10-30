import { describe, expect, it } from "vitest";
import { CONDITION_CASES, MUST_DIFFER, PHASES } from "./catalog";
import { baseColor, deltaE, deuteranopia, skyColor } from "./palette";

const byId = Object.fromEntries(CONDITION_CASES.map((c) => [c.id, c.conditions]));

describe("day bar colours", () => {
  // Floors from tuning (OKLab ΔE × 100; ~2 is just noticeable, 10+ clearly
  // different). Colour carries most of it; the texture (cloud lumps, rain
  // streaks, snow, flashes) and motion carry the rest, which is why the
  // floors aren't higher.
  it.each(PHASES.map((phase) => [phase.label, phase.elevation] as const))("keeps conditions apart at %s", (_label, elevation) => {
    for (const [a, b] of MUST_DIFFER) {
      const ca = baseColor(byId[a], elevation);
      const cb = baseColor(byId[b], elevation);
      expect(deltaE(ca, cb), `${a} / ${b}`).toBeGreaterThanOrEqual(5);
      // Partly cloudy against overcast at dusk relies on its texture for colour-blind eyes.
      const cvdFloor = a === "partly" && b === "overcast" ? 2.5 : 4;
      expect(deltaE(deuteranopia(ca), deuteranopia(cb)), `${a} / ${b}, deuteranopia`).toBeGreaterThanOrEqual(cvdFloor);
    }
  });

  it("never paints a clear day blue: blue is for water", () => {
    for (const elevation of [10, 30, 60]) {
      const [r, , b] = skyColor(elevation);
      expect(r).toBeGreaterThan(b);
    }
  });

  it("runs gold, coral, pink and violet through sunset into navy", () => {
    const [r1, g1] = skyColor(4);
    const [r2, , b2] = skyColor(-1.5);
    const [, , b3] = skyColor(-6);
    const night = skyColor(-30);
    expect(g1).toBeGreaterThan(120); // gold
    expect(r2).toBeGreaterThan(b2); // pink
    expect(b3).toBeGreaterThan(140); // violet-blue
    expect(Math.max(...night)).toBeLessThan(80); // navy
    expect(night[2]).toBeGreaterThan(night[0] * 2);
  });
});
