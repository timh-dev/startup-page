import { useEffect, useMemo, useRef, useState } from "react";

import { useSettingsStore } from "@/features/settings/stores";

// e.g. "GMT+5:30" — derived from the browser's own local UTC offset. No
// timezone picker exists yet, so this always reflects local time.
function getGmtLabel(date) {
  const totalMinutes = -date.getTimezoneOffset();
  const sign = totalMinutes >= 0 ? "+" : "-";
  const absMinutes = Math.abs(totalMinutes);
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;
  return `GMT${sign}${hours}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""}`;
}

function getClockParts(date, use24Hour) {
  const hours24 = date.getHours();
  const hours12 = hours24 % 12 || 12;
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const displayHours = use24Hour ? String(hours24).padStart(2, "0") : String(hours12);

  // TICK_LABELS below lays out 5 equal flex columns spanning the row, so
  // their rendered centers land at 10/30/50/70/90% (not 0/25/50/75/100%) —
  // (i + 0.5) / 5 for column i. Mapping the day's elapsed fraction onto that
  // same 10–90% range (rather than a naive 0–100%) is what makes the dot/
  // line line up exactly with the tick marks instead of drifting off them.
  const secondsSinceMidnight = hours24 * 3600 + minutes * 60 + seconds;
  const dayFraction = secondsSinceMidnight / 86400;
  const nowPercent = 10 + dayFraction * 80;

  return {
    time: `${displayHours}:${String(minutes).padStart(2, "0")}`,
    period: hours24 >= 12 ? "PM" : "AM",
    dateLabel: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
    gmtLabel: getGmtLabel(date),
    hourDeg: ((hours12 % 12) + minutes / 60) * 30,
    minuteDeg: minutes * 6,
    secondDeg: seconds * 6,
    nowPercent,
  };
}

// 6-hour increments spanning a full day (midnight → noon → midnight).
const TICK_LABELS = [12, 6, 12, 6, 12];

// Default clock face: today's date, a vertical "now" spine crossed by a red
// line through the dot, and the big time readout — styled entirely from
// theme variables so it recolors with whatever palette the user has
// selected. The dot/line's horizontal position (--clock-now-x) is driven by
// the actual time of day, not fixed.
function PlainClock({ parts, showMeridiem }) {
  return (
    <div className="clock-plain" aria-hidden="true" style={{ "--clock-now-x": `${parts.nowPercent}%` }}>
      {/* Single shared positioning reference for both the line and the dot —
          they used to live in different containers (one padded, one not),
          so the same --clock-now-x percentage resolved to different pixel
          positions for each. */}
      <div className="clock-plain-inner">
        <div className="clock-plain-top">
          <div className="clock-plain-date">{parts.dateLabel}</div>
          <div className="clock-plain-offset">{parts.gmtLabel}</div>
        </div>

        <div className="clock-plain-spine">
          <span className="clock-plain-dot" />
        </div>

        <div className="clock-plain-bottom">
          <div className="clock-plain-time">
            <span className="clock-plain-time-value">{parts.time}</span>
            {showMeridiem && <span className="clock-plain-time-meridiem">{parts.period}</span>}
          </div>
          <div className="clock-plain-rule" />
          <div className="clock-plain-ticks">
            {TICK_LABELS.map((label, index) => (
              <span key={index}>{label}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalogClock({ parts }) {
  return (
    <div className="clock-underlay clock-analog-underlay" aria-hidden="true">
      <span className="clock-hand clock-hour-hand" style={{ "--clock-hand-angle": `${parts.hourDeg}deg` }} />
      <span className="clock-hand clock-minute-hand" style={{ "--clock-hand-angle": `${parts.minuteDeg}deg` }} />
      <span className="clock-hand clock-second-hand" style={{ "--clock-hand-angle": `${parts.secondDeg}deg` }} />
    </div>
  );
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86400000);
}

// Year view: a real calendar in the flip-dot language — one row per month,
// one dot per day. Drawn on canvas so every dot has the exact same radius
// and spacing: DOM elements snap their boxes to device pixels individually,
// which makes a ~4px dot grid look ragged; canvas doesn't snap.
function YearClock({ now }) {
  const canvasRef = useRef(null);
  const year = now.getFullYear();
  const month = now.getMonth();
  const date = now.getDate();
  const today = dayOfYear(now);
  const totalDays = isLeapYear(year) ? 366 : 365;
  const percent = Math.round((today / totalDays) * 100);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    let frameId = null;
    let lastDraw = 0;

    const draw = (timestamp) => {
      frameId = requestAnimationFrame(draw);
      if (timestamp - lastDraw < 66) return; // ~15 fps is plenty for the pulse
      lastDraw = timestamp;

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // One uniform step for both axes; grid centered in the canvas.
      const step = Math.min(w / 31, h / 12);
      const originX = (w - step * 31) / 2 + step / 2;
      const originY = (h - step * 12) / 2 + step / 2;
      const radius = step * 0.27;
      const pulse = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin((timestamp / 2400) * Math.PI * 2));
      ctx.fillStyle = getComputedStyle(canvas).color;

      for (let m = 0; m < 12; m++) {
        const monthLength = daysInMonth(year, m);
        for (let d = 1; d <= monthLength; d++) {
          const isPast = m < month || (m === month && d < date);
          const isToday = m === month && d === date;
          ctx.globalAlpha = isToday ? pulse : isPast ? 0.92 : 0.18;
          ctx.beginPath();
          ctx.arc(originX + (d - 1) * step, originY + m * step, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };

    frameId = requestAnimationFrame(draw);
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [year, month, date]);

  return (
    <div className="clock-year-view" aria-hidden="true">
      <canvas ref={canvasRef} className="clock-year-canvas" />
      <div className="clock-year-caption">{`Day ${today} · ${percent}%`}</div>
    </div>
  );
}

export default function Clock() {
  const clockFormat = useSettingsStore((state) => state.settings.ui?.clockFormat) || "12h";
  const use24Hour = clockFormat === "24h";
  const [now, setNow] = useState(() => new Date());
  const [mode, setMode] = useState("digital");
  const parts = useMemo(() => getClockParts(now, use24Hour), [now, use24Hour]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const nextMode = mode === "digital" ? "analog" : mode === "analog" ? "year" : "digital";

  return (
    <div className="clock-shell relative h-full w-full rounded-[inherit]">
      <button
        type="button"
        className="clock-widget flex h-full w-full flex-col items-center justify-center rounded-[inherit] text-center"
        onClick={() => setMode(nextMode)}
        title={`Switch to ${nextMode} view`}
        aria-label={`Clock showing ${parts.time}${use24Hour ? "" : ` ${parts.period}`}. Click to switch to the ${nextMode} view.`}
      >
        {mode === "digital" && <PlainClock parts={parts} showMeridiem={!use24Hour} />}
        {mode === "analog" && (
          <>
            <span className="clock-hole-field" aria-hidden="true" />
            <AnalogClock parts={parts} />
            <span className="clock-perforated-mask" aria-hidden="true" />
          </>
        )}
        {mode === "year" && <YearClock now={now} />}
      </button>
    </div>
  );
}
