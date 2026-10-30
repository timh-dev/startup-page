import React from "react";
import { Link } from "react-router-dom";
import { HiArrowLeft } from "react-icons/hi2";

import { DayBar } from "@/features/weather/dayBar/DayBar";
import { DayCard } from "@/features/weather/dayBar/DayCard";
import { CONDITION_CASES, MUST_DIFFER, PHASES } from "@/features/weather/dayBar/catalog";
import { baseColor, cloudColor, deltaE, deuteranopia, skyColor } from "@/features/weather/dayBar/palette";
import type { Column } from "@/features/weather/dayBar/paint";
import { startOfDay, type HourSample } from "@/features/weather/dayBar/timeline";

// Dev only: every condition at every sun phase, how far apart their colours
// are, and whole sample days in the real card, for tuning the day bar.

const PLACE = { latitude: 41.88, longitude: -87.63 };
const HOUR = 3_600_000;

type Hour = Partial<Omit<HourSample, "time">>;

/** A day of samples every `step` hours from `spec(hour)`. */
function day(dayStart: number, spec: (hour: number) => Hour, step = 1): HourSample[] {
  const samples: HourSample[] = [];
  for (let hour = 0; hour <= 24; hour += step) {
    const temp = 48 + 14 * Math.sin(((hour - 9) / 24) * Math.PI * 2);
    samples.push({ time: dayStart + hour * HOUR, temp, cloud: 0, precip: "none", rate: 0, chance: 0, obscured: "none", wind: 3, ...spec(hour) });
  }
  return samples;
}

const between = (hour: number, from: number, to: number) => hour >= from && hour < to;

const SCENARIOS: Array<{ name: string; spec: (hour: number) => Hour; step?: number }> = [
  {
    name: "Sunny, storms in the evening",
    spec: (h) =>
      between(h, 19, 22)
        ? { cloud: 1, precip: "storm", rate: 6, chance: 0.8, wind: 11 }
        : between(h, 15, 19)
          ? { cloud: 0.2 + (h - 15) * 0.2 }
          : between(h, 22, 25)
            ? { cloud: 0.4 }
            : {},
  },
  {
    name: "Foggy morning that clears",
    spec: (h) => (h < 10 ? { cloud: 0.7, obscured: "fog" } : between(h, 10, 14) ? { cloud: 0.4 } : { cloud: 0.05 }),
  },
  {
    name: "Overcast with drizzle",
    spec: (h) => (between(h, 8, 17) ? { cloud: 1, precip: "drizzle", rate: 0.3, chance: 0.7 } : { cloud: 0.95 }),
  },
  {
    name: "Rain all afternoon",
    spec: (h) => (between(h, 12, 20) ? { cloud: 1, precip: "rain", rate: 4, chance: 0.9 } : { cloud: 0.8 }),
  },
  {
    name: "Showers on and off (30–50%)",
    spec: (h) => (h % 6 < 3 ? { cloud: 0.7, precip: "rain", rate: 1.5, chance: 0.3 + (h % 3) * 0.1 } : { cloud: 0.45 }),
  },
  {
    name: "Snow day",
    spec: (h) => (between(h, 3, 15) ? { cloud: 1, precip: "snow", rate: 1.5, chance: 0.9, temp: 28 } : { cloud: 0.9, temp: 26 }),
  },
  {
    name: "Clear and windy",
    spec: () => ({ cloud: 0.1, wind: 14 }),
  },
  {
    name: "Partly cloudy, as OpenWeather sends it (every 3 hours)",
    step: 3,
    spec: (h) => ({ cloud: [0.1, 0.4, 0.6, 0.3, 0.5, 0.8, 0.4, 0.2, 0.1][h / 3] ?? 0.2 }),
  },
];

function swatch(conditions: (typeof CONDITION_CASES)[number]["conditions"], elevation: number) {
  return (width: number): Column[] =>
    Array.from({ length: width }, () => ({
      time: 0,
      elevation,
      conditions,
      color: baseColor(conditions, elevation),
      cloud: cloudColor(elevation, skyColor(elevation)),
      past: false,
    }));
}

export default function DayBarPreview() {
  const [now, setNow] = React.useState(() => Date.now());
  const today = startOfDay(now);
  const [hourOffset, setHourOffset] = React.useState(0);
  const shownNow = today + ((new Date(now).getHours() + new Date(now).getMinutes() / 60 + hourOffset + 24) % 24) * HOUR;
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const byId = Object.fromEntries(CONDITION_CASES.map((c) => [c.id, c.conditions]));
  const samplesFor = React.useMemo(() => SCENARIOS.map((scenario) => day(today, scenario.spec, scenario.step)), [today]);

  return (
    <main className="day-bar-preview min-h-screen bg-background p-8 text-foreground">
      <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <HiArrowLeft /> Dashboard
      </Link>
      <h1 className="mb-1 text-2xl font-semibold">Day bar</h1>
      <p className="mb-8 max-w-2xl text-sm text-muted-foreground">
        Each condition at each point of the sun's day, then sample days in the card. Colours live in
        <code className="mx-1">src/features/weather/dayBar/palette.ts</code>; textures in <code>paint.ts</code>.
      </p>

      <h2 className="mb-3 text-lg font-semibold">Sample days</h2>
      <label className="mb-4 flex items-center gap-3 text-sm">
        Move now
        <input type="range" min={-12} max={12} step={0.5} value={hourOffset} onChange={(e) => setHourOffset(Number(e.target.value))} />
        <span className="tabular-nums">{new Date(shownNow).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
      </label>
      <div className="mb-12 grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(17rem, 1fr))" }}>
        {SCENARIOS.map((scenario, index) => (
          <figure key={scenario.name} className="grid gap-2">
            <div className="overflow-hidden rounded-[1.6rem]" style={{ width: "17rem", height: "8rem" }}>
              <DayCard samples={samplesFor[index]} dayStart={today} now={shownNow} place={PLACE} unit="F" />
            </div>
            <figcaption className="text-xs text-muted-foreground">{scenario.name}</figcaption>
          </figure>
        ))}
        <figure className="grid gap-2">
          <div className="overflow-hidden rounded-[1.6rem]" style={{ width: "17rem", height: "8rem" }}>
            <DayCard samples={samplesFor[0]} dayStart={today} now={null} place={PLACE} unit="F" dayName="Saturday" onBackToToday={() => {}} />
          </div>
          <figcaption className="text-xs text-muted-foreground">Another day, picked on the weather card</figcaption>
        </figure>
        <figure className="grid gap-2">
          <div className="overflow-hidden rounded-[1.6rem]" style={{ width: "17rem", height: "17rem" }}>
            <DayCard samples={samplesFor[0]} dayStart={today} now={shownNow} place={PLACE} unit="F" />
          </div>
          <figcaption className="text-xs text-muted-foreground">2 × 2</figcaption>
        </figure>
      </div>

      <h2 className="mb-3 text-lg font-semibold">Conditions by sun phase</h2>
      <div className="mb-12 overflow-x-auto">
        <table className="border-separate border-spacing-2 text-xs">
          <thead>
            <tr>
              <th />
              {PHASES.map((phase) => (
                <th key={phase.id} className="font-medium text-muted-foreground">
                  {phase.label} ({phase.elevation}°)
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CONDITION_CASES.map((c) => (
              <tr key={c.id}>
                <th className="pr-2 text-right font-medium">{c.label}</th>
                {PHASES.map((phase) => (
                  <td key={phase.id}>
                    <div className="day-bar-swatch">
                      <DayBar samples={[]} dayStart={today} now={null} place={PLACE} label={`${c.label}, ${phase.label}`} makeColumns={swatch(c.conditions, phase.elevation)} />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-3 text-lg font-semibold">How different the colours look (OKLab ΔE × 100; deuteranopia in brackets)</h2>
      <p className="mb-3 max-w-2xl text-xs text-muted-foreground">About 2 is just noticeable, 10+ clearly different. Texture and motion add to these.</p>
      <table className="mb-12 text-xs tabular-nums">
        <thead>
          <tr>
            <th className="pr-4 text-left font-medium">Pair</th>
            {PHASES.map((phase) => (
              <th key={phase.id} className="px-2 font-medium">
                {phase.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MUST_DIFFER.map(([a, b]) => (
            <tr key={`${a}-${b}`}>
              <td className="pr-4">
                {a} / {b}
              </td>
              {PHASES.map((phase) => {
                const ca = baseColor(byId[a], phase.elevation);
                const cb = baseColor(byId[b], phase.elevation);
                const d = deltaE(ca, cb);
                return (
                  <td key={phase.id} className="px-2 text-center" style={{ color: d < 8 ? "var(--destructive)" : undefined }}>
                    {d.toFixed(1)} ({deltaE(deuteranopia(ca), deuteranopia(cb)).toFixed(1)})
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
