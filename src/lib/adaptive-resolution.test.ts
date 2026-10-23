import { afterEach, describe, expect, it } from "vitest";
import { createAdaptiveResolution } from "./adaptive-resolution";

function setDensity(value: number) {
  Object.defineProperty(window, "devicePixelRatio", { value, configurable: true });
}

afterEach(() => setDensity(1));

function run(resolution: ReturnType<typeof createAdaptiveResolution>, frames: number, gapMs: number, start = 1000) {
  let changed = false;
  let now = start;
  for (let i = 0; i <= frames; i++) {
    changed = resolution.sample(now) || changed;
    now += gapMs;
  }
  return { changed, now };
}

describe("createAdaptiveResolution", () => {
  it("starts at the screen density, capped at 2", () => {
    setDensity(3);
    expect(createAdaptiveResolution().scale).toBe(2);
    setDensity(1.5);
    expect(createAdaptiveResolution().scale).toBe(1.5);
  });

  it("supersamples above the screen density up to the cap", () => {
    setDensity(2);
    expect(createAdaptiveResolution({ supersample: 2, max: 4 }).scale).toBe(4);
    setDensity(1);
    expect(createAdaptiveResolution({ supersample: 2, max: 4 }).scale).toBe(2);
    setDensity(3);
    expect(createAdaptiveResolution({ supersample: 2, max: 4 }).scale).toBe(4);
  });

  it("keeps full resolution while frames stay smooth", () => {
    setDensity(2);
    const resolution = createAdaptiveResolution();
    expect(run(resolution, 200, 16.7).changed).toBe(false);
    expect(resolution.scale).toBe(2);
  });

  it("steps down when frames are slow, but never below 1", () => {
    setDensity(2);
    const resolution = createAdaptiveResolution();
    expect(run(resolution, 50, 33).changed).toBe(true);
    expect(resolution.scale).toBe(1.5);
    run(resolution, 500, 33);
    expect(resolution.scale).toBe(1);
  });

  it("ignores long gaps from a hidden tab", () => {
    setDensity(2);
    const resolution = createAdaptiveResolution();
    run(resolution, 100, 1000);
    expect(resolution.scale).toBe(2);
  });
});
