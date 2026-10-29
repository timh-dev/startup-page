import { afterEach, describe, expect, it, vi } from "vitest";
import { motionTime, useMotionStore } from "./motion";

afterEach(() => {
  vi.useRealTimers();
  useMotionStore.setState({ speed: 1 });
});

describe("motionTime", () => {
  it("runs at the chosen speed and stops when paused", () => {
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const start = motionTime();
    now += 1000;
    expect(motionTime() - start).toBeCloseTo(1, 5);
    useMotionStore.getState().setSpeed(0.5);
    now += 1000;
    expect(motionTime() - start).toBeCloseTo(1.5, 5);
    useMotionStore.getState().setSpeed(0);
    now += 5000;
    expect(motionTime() - start).toBeCloseTo(1.5, 5);
  });
});
