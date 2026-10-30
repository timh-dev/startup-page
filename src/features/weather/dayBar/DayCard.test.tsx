import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DayCard } from "./DayCard";
import { momentAt, type HourSample } from "./timeline";

// jsdom has no ResizeObserver; the bar only uses it to size its canvases.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const HOUR = 3_600_000;
const dayStart = new Date(2026, 9, 30).getTime();
const at = (hour: number) => dayStart + hour * HOUR;
// On the equator at the test machine's own time-zone longitude, so local hours match the sun anywhere.
const place = { latitude: 0, longitude: -new Date(dayStart).getTimezoneOffset() / 4 };

const samples: HourSample[] = Array.from({ length: 25 }, (_, hour) => ({
  time: at(hour),
  temp: 40 + hour,
  cloud: hour >= 12 && hour < 15 ? 1 : 0.05,
  precip: hour >= 12 && hour < 15 ? "rain" : "none",
  rate: hour >= 12 && hour < 15 ? 3 : 0,
  chance: hour >= 12 && hour < 15 ? 0.7 : 0,
  obscured: "none",
  wind: hour === 20 ? 12 : 3,
}));
const daylight = (time: number) => time >= at(7) && time < at(18);

describe("momentAt", () => {
  it("reads one moment: time, condition, temperature and the chance of rain", () => {
    const moment = momentAt(samples, at(13), daylight, "F");
    expect(moment).toMatchObject({ label: "Rain", temp: 53, detail: "70% rain" });
    expect(moment.time).toMatch(/^1\sPM$/);
  });

  it("gives the wind when it's strong, in the card's units", () => {
    expect(momentAt(samples, at(20), daylight, "F").detail).toBe("27 mph wind");
    expect(momentAt(samples, at(20), daylight, "C").detail).toBe("43 km/h wind");
    expect(momentAt(samples, at(9), daylight, "F").detail).toBeNull();
  });

  it("rounds to the quarter hour and names clear nights", () => {
    const moment = momentAt(samples, at(22) + 17 * 60_000, daylight, "F");
    expect(moment.time).toMatch(/^10:15\sPM$/);
    expect(moment.label).toBe("Clear");
  });
});

describe("DayCard", () => {
  it("steps through the day with the arrow keys and goes back to the headline", () => {
    render(<DayCard samples={samples} dayStart={dayStart} now={at(9)} place={place} unit="F" still />);
    const timeline = screen.getByRole("slider");
    const headline = () => document.querySelector(".day-card-headline")!.textContent;
    expect(headline()).toMatch(/^Rain likely /);

    fireEvent.keyDown(timeline, { key: "ArrowRight" });
    expect(headline()).toMatch(/^10\sAM · Sunny$/);
    fireEvent.keyDown(timeline, { key: "ArrowRight" });
    fireEvent.keyDown(timeline, { key: "ArrowRight" });
    fireEvent.keyDown(timeline, { key: "ArrowRight" });
    expect(headline()).toMatch(/^1\sPM · Rain$/);
    expect(timeline.getAttribute("aria-valuetext")).toMatch(/Rain, 53°, 70% rain$/);

    fireEvent.keyDown(timeline, { key: "Escape" });
    expect(headline()).toMatch(/^Rain likely /);
  });
});
