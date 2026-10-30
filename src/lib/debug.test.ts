import { afterEach, describe, expect, it } from "vitest";
import { debugNow, fromWallClock, useDebugStore, wallClock } from "./debug";

afterEach(() => useDebugStore.getState().reset());

describe("debug time", () => {
  it("shifts now and keeps running from the chosen moment", () => {
    const target = new Date("2026-12-21T18:00:00Z");
    useDebugStore.getState().setTime(target);
    expect(Math.abs(debugNow().getTime() - target.getTime())).toBeLessThan(50);
    useDebugStore.getState().setTime(null);
    expect(Math.abs(debugNow().getTime() - Date.now())).toBeLessThan(50);
  });
});

describe("wallClock", () => {
  it("reads local time in a time zone, with its offset", () => {
    const moment = new Date("2026-06-21T12:00:00Z");
    expect(wallClock(moment, "Asia/Tokyo")).toMatchObject({ hours: 21, minutes: 0, offsetHours: 9 });
    expect(wallClock(moment, "America/Chicago")).toMatchObject({ hours: 7, offsetHours: -5 });
    expect(wallClock(new Date("2026-12-21T12:00:00Z"), "America/Chicago").offsetHours).toBe(-6);
  });

  it("round-trips through fromWallClock", () => {
    const moment = fromWallClock(2026, 12, 21, 13, 30, "America/Anchorage");
    expect(wallClock(moment, "America/Anchorage")).toMatchObject({ year: 2026, month: 12, day: 21, hours: 13, minutes: 30 });
  });
});
