import { describe, expect, it } from "vitest";
import { conditionsAt, headline, highLow, rangeLabel, summary, type HourSample } from "./timeline";

const HOUR = 3_600_000;
const dayStart = new Date(2026, 9, 30).getTime();
const at = (hour: number) => dayStart + hour * HOUR;
const daylight = (time: number) => {
  const hour = (time - dayStart) / HOUR;
  return hour >= 7 && hour < 18;
};

function day(spec: (hour: number) => Partial<HourSample>, step = 1): HourSample[] {
  const out: HourSample[] = [];
  for (let hour = 0; hour <= 24; hour += step) {
    out.push({ time: at(hour), temp: 50 + hour, cloud: 0, precip: "none", rate: 0, chance: 0, obscured: "none", wind: 2, ...spec(hour) });
  }
  return out;
}

describe("conditionsAt", () => {
  it("eases between 3-hourly points and fades rain in", () => {
    const samples = day((h) => (h === 6 ? { precip: "rain", rate: 4, chance: 0.9, cloud: 1 } : {}), 3);
    const mid = conditionsAt(samples, at(4.5));
    expect(mid.temp).toBeCloseTo(54.5);
    expect(mid.precip).toBe("rain");
    expect(mid.intensity).toBeGreaterThan(0);
    expect(mid.intensity).toBeLessThan(conditionsAt(samples, at(6)).intensity);
  });

  it("knows nothing far from any data", () => {
    const samples = day(() => ({}), 3).filter((s) => s.time >= at(12));
    expect(conditionsAt(samples, at(2)).known).toBe(false);
    expect(conditionsAt(samples, at(10)).known).toBe(true);
  });
});

describe("headline", () => {
  it("leads with rain coming", () => {
    const samples = day((h) => (h >= 18 && h < 21 ? { precip: "storm", rate: 5, chance: 0.8, cloud: 1 } : {}));
    expect(headline(samples, dayStart, at(9), daylight)).toBe(`Storms likely ${rangeLabel(at(17.5), at(21))}`);
  });

  it("hedges a low chance", () => {
    const samples = day((h) => (h >= 14 && h < 16 ? { precip: "rain", rate: 1, chance: 0.4, cloud: 0.8 } : {}));
    expect(headline(samples, dayStart, at(9), daylight)).toMatch(/^Chance of rain /);
  });

  it("says when rain stops", () => {
    const samples = day((h) => (h < 11 ? { precip: "rain", rate: 3, chance: 0.9, cloud: 1 } : { cloud: 0.1 }));
    expect(headline(samples, dayStart, at(8), daylight)).toMatch(/^Rain until /);
  });

  it("says fog lifts, and clouds come", () => {
    const fog = day((h) => (h < 10 ? { obscured: "fog", cloud: 0.6 } : {}));
    expect(headline(fog, dayStart, at(7), daylight)).toMatch(/^Fog until /);
    const clouding = day((h) => (h >= 15 ? { cloud: 0.7 } : {}));
    expect(headline(clouding, dayStart, at(9), daylight)).toMatch(/^Sunny, cloudy from /);
  });

  it("calls a clear evening clear, not sunny", () => {
    const samples = day(() => ({}));
    expect(headline(samples, dayStart, at(20), daylight)).toBe("Clear tonight");
    expect(headline(samples, dayStart, null, daylight)).toBe("Sunny all day");
  });
});

describe("the rest", () => {
  it("finds the high and low", () => {
    expect(highLow(day(() => ({})), dayStart)).toEqual({ high: 74, low: 50 });
  });

  it("writes the day out", () => {
    const samples = day((h) => (h >= 12 && h < 15 ? { precip: "rain", rate: 3, chance: 0.9, cloud: 1 } : {}));
    expect(summary(samples, dayStart, daylight)).toMatch(/^Clear until .+, sunny until .+, rain until .+, sunny until .+, clear from .+\.$/);
  });

  it("shortens a range within one half of the day", () => {
    expect(rangeLabel(at(18), at(22))).toMatch(/^6–10\sPM$/);
    expect(rangeLabel(at(11), at(14))).toMatch(/AM–2\sPM$/);
  });
});
