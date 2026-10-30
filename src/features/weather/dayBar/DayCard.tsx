import React from "react";
import { HiArrowUturnLeft } from "react-icons/hi2";

import { sunElevation } from "@/features/globe/sun";
import { FrostedBackground, type FrostedCategory } from "@/features/weather/components/FrostedBackground";
import { DayBar } from "./DayBar";
import { conditionsAt, endOfDay, headline, highLow, momentAt, summary, type Conditions, type HourSample } from "./timeline";

export interface DayCardProps {
  samples: HourSample[];
  /** Local midnight of the day shown. */
  dayStart: number;
  /** Now, when the day is today; null for another day. */
  now: number | null;
  place: { latitude: number; longitude: number };
  /** "F" or "C". */
  unit: string;
  /** Another day's name ("Saturday"); not given for today. */
  dayName?: string;
  /** Shown with another day: goes back to today. */
  onBackToToday?: () => void;
  /** Holds the bar's texture still. */
  still?: boolean;
}

const HOUR = 3_600_000;
/** Temperatures every 3 hours, leaving the midnights at the ends to the edges. */
const TEMP_HOURS = [3, 6, 9, 12, 15, 18, 21];
const HOUR_MARKS: Array<[number, string]> = [
  [6, "6 AM"],
  [12, "Noon"],
  [18, "6 PM"],
];

function backdropFor(conditions: Conditions): FrostedCategory {
  if (conditions.precip === "snow" || conditions.precip === "sleet") return "snowy";
  if (conditions.precip !== "none" && conditions.chance >= 0.3) return "rainy";
  if (conditions.wind > 0.55) return "windy";
  if (conditions.cloud < 0.25 && conditions.obscured === "none") return "sunny";
  return "cloudy";
}

/**
 * The frosted weather card: a whole day, midnight to midnight, as a blurred
 * band of sky and weather, with temperatures every three hours and a line
 * through now. Hover (or drag, or arrow along) the band to read any moment
 * of the day in the headline.
 */
export function DayCard({ samples, dayStart, now, place, unit, dayName, onBackToToday, still }: DayCardProps) {
  const dayEnd = endOfDay(dayStart);
  const span = dayEnd - dayStart;
  const at = (time: number) => `${((time - dayStart) / span) * 100}%`;
  const isDaylight = React.useCallback((time: number) => sunElevation(place.latitude, place.longitude, new Date(time)) > -0.833, [place.latitude, place.longitude]);

  const focus = now ?? dayStart + 12 * HOUR;
  const focusConditions = conditionsAt(samples, focus);
  const night = !isDaylight(focus);
  const title = headline(samples, dayStart, now, isDaylight);
  const said = summary(samples, dayStart, isDaylight);
  const range = highLow(samples, dayStart);
  const nowTemp = now != null ? conditionsAt(samples, now).temp : null;
  const degrees = (temp: number) => `${Math.round(temp)}°`;

  // The moment being read: from the pointer over the timeline, or the arrow keys.
  const timelineRef = React.useRef<HTMLDivElement>(null);
  const [scrub, setScrub] = React.useState<number | null>(null);
  const clampTime = (time: number) => Math.max(dayStart, Math.min(dayEnd - 60_000, time));
  const scrubTo = (clientX: number) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect || !rect.width) return;
    setScrub(clampTime(dayStart + ((clientX - rect.left) / rect.width) * span));
  };
  const onKeyDown = (event: React.KeyboardEvent) => {
    const from = scrub ?? focus;
    const step = { ArrowLeft: -HOUR, ArrowRight: HOUR }[event.key];
    if (step) {
      event.preventDefault();
      setScrub(clampTime(Math.round((from + step) / HOUR) * HOUR));
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setScrub(event.key === "Home" ? dayStart : dayEnd - HOUR);
    } else if (event.key === "Escape") {
      setScrub(null);
    }
  };
  const moment = scrub != null ? momentAt(samples, scrub, isDaylight, unit) : null;
  const momentText = moment ? [moment.time, moment.label, moment.temp != null ? degrees(moment.temp) : null, moment.detail].filter(Boolean).join(", ") : said;

  return (
    <div className="weather-v2-card day-card relative isolate h-full w-full overflow-hidden rounded-[inherit]" data-category={backdropFor(focusConditions)} data-night={night || undefined}>
      <div className="weather-v2-bg-layer absolute inset-0" aria-hidden="true">
        <FrostedBackground category={backdropFor(focusConditions)} night={night} />
      </div>
      <div className="weather-v2-glass absolute inset-0" aria-hidden="true" />

      <div className="day-card-content">
        {moment ? (
          <div className="day-card-head" data-scrubbing>
            <p className="day-card-headline">
              <span className="day-card-day">{moment.time} · </span>
              {moment.label}
            </p>
            <p className="day-card-range">
              {moment.temp != null && <span className="day-card-moment-temp">{degrees(moment.temp)}</span>}
              {moment.detail && <span>{moment.detail}</span>}
            </p>
          </div>
        ) : (
        <div className="day-card-head">
          <p className="day-card-headline">
            {dayName && <span className="day-card-day">{dayName} · </span>}
            {title}
          </p>
          {dayName && onBackToToday ? (
            <button type="button" className="day-card-today" onClick={onBackToToday} title="Back to today">
              <HiArrowUturnLeft aria-hidden="true" /> Today
            </button>
          ) : (
            range && (
              <p className="day-card-range">
                <span aria-label={`High ${degrees(range.high)}`}>H {degrees(range.high)}</span>
                <span aria-label={`Low ${degrees(range.low)}`}>L {degrees(range.low)}</span>
              </p>
            )
          )}
        </div>
        )}

        <div
          ref={timelineRef}
          className="day-card-timeline"
          tabIndex={0}
          role="slider"
          aria-label="The day's weather, hour by hour"
          aria-valuemin={0}
          aria-valuemax={24}
          aria-valuenow={scrub != null ? Math.round((scrub - dayStart) / HOUR) : undefined}
          aria-valuetext={momentText}
          onPointerMove={(event) => scrubTo(event.clientX)}
          onPointerDown={(event) => scrubTo(event.clientX)}
          onPointerLeave={(event) => event.pointerType === "mouse" && setScrub(null)}
          onPointerCancel={() => setScrub(null)}
          onKeyDown={onKeyDown}
          onBlur={() => setScrub(null)}
        >
          <div className="day-card-temps" aria-hidden="true">
            {TEMP_HOURS.map((hour) => {
              const time = dayStart + hour * HOUR;
              // The one under the now marker gives way to the current temperature.
              if (now != null && Math.abs(time - now) < 2.3 * HOUR) return null;
              const temp = conditionsAt(samples, time).temp;
              return temp == null ? null : (
                <span key={hour} style={{ left: at(time) }} data-past={now != null && time < now ? true : undefined}>
                  {degrees(temp)}
                </span>
              );
            })}
            {now != null && nowTemp != null && (
              <span className="day-card-now-temp" style={{ left: at(now) }}>
                {degrees(nowTemp)}
              </span>
            )}
          </div>

          <div className="day-card-band">
            <DayBar samples={samples} dayStart={dayStart} now={now} place={place} label={said} still={still} />
            {now != null && <span className="day-card-now" style={{ left: at(now) }} aria-hidden="true" />}
            {scrub != null && <span className="day-card-scrub" style={{ left: at(scrub) }} aria-hidden="true" />}
          </div>

          <div className="day-card-hours" aria-hidden="true">
            {HOUR_MARKS.map(([hour, label]) => (
              <span key={hour} style={{ left: at(dayStart + hour * HOUR) }}>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">{`${dayName ?? "Today"}: ${said} High ${range ? degrees(range.high) : "unknown"}, low ${range ? degrees(range.low) : "unknown"} (°${unit}).`}</span>
    </div>
  );
}
