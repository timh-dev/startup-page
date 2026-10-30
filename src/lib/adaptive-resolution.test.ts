import { afterEach, describe, expect, it, vi } from "vitest";
import { createAdaptiveResolution } from "./adaptive-resolution";

const power = vi.hoisted(() => ({ onBattery: false }));
vi.mock("./power", () => ({ isOnBattery: () => power.onBattery }));

function setDensity(value: number) {
  Object.defineProperty(window, "devicePixelRatio", { value, configurable: true });
}

afterEach(() => {
  setDensity(1);
  power.onBattery = false;
});

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

  it("drops supersampling when frames are slow, but never goes below the screen density", () => {
    setDensity(2);
    const resolution = createAdaptiveResolution({ supersample: 2, max: 4 });
    // The first two seconds are load time and don't count.
    expect(run(resolution, 60, 33).changed).toBe(false);
    expect(run(resolution, 50, 33, 3000).changed).toBe(true);
    expect(resolution.scale).toBe(3.5);
    run(resolution, 2000, 33, 5000);
    expect(resolution.scale).toBe(2);
  });

  it("does not step a native-density canvas down at all", () => {
    setDensity(2);
    const resolution = createAdaptiveResolution();
    run(resolution, 2000, 33);
    expect(resolution.scale).toBe(2);
  });

  it("ignores long gaps from a hidden tab", () => {
    setDensity(2);
    const resolution = createAdaptiveResolution();
    run(resolution, 100, 1000);
    expect(resolution.scale).toBe(2);
  });

  it("renders at the screen density on battery, and follows power changes", () => {
    setDensity(2);
    power.onBattery = true;
    const resolution = createAdaptiveResolution({ supersample: 2, max: 4 });
    expect(resolution.scale).toBe(2);

    power.onBattery = false;
    expect(resolution.sample(1000)).toBe(true);
    expect(resolution.scale).toBe(4);
    expect(resolution.sample(1016)).toBe(false);
  });
});
