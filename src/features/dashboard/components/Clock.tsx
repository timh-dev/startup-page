import { useEffect, useMemo, useRef, useState } from "react";

import { useSettingsStore } from "@/features/settings/stores";

const SEGMENTS = {
  "0": ["a", "b", "c", "d", "e", "f"],
  "1": ["b", "c"],
  "2": ["a", "b", "g", "e", "d"],
  "3": ["a", "b", "g", "c", "d"],
  "4": ["f", "g", "b", "c"],
  "5": ["a", "f", "g", "c", "d"],
  "6": ["a", "f", "g", "e", "c", "d"],
  "7": ["a", "b", "c"],
  "8": ["a", "b", "c", "d", "e", "f", "g"],
  "9": ["a", "b", "c", "d", "f", "g"],
};

const DOT_DIGITS = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
};

const DOT_LETTERS = {
  A: ["010", "101", "111", "101", "101"],
  D: ["110", "101", "101", "101", "110"],
  E: ["111", "100", "110", "100", "111"],
  F: ["111", "100", "110", "100", "100"],
  H: ["101", "101", "111", "101", "101"],
  I: ["111", "010", "010", "010", "111"],
  M: ["101", "111", "111", "101", "101"],
  N: ["101", "101", "111", "101", "101"],
  O: ["111", "101", "101", "101", "111"],
  R: ["110", "101", "110", "101", "101"],
  S: ["111", "100", "111", "001", "111"],
  T: ["111", "010", "010", "010", "010"],
  U: ["101", "101", "101", "101", "111"],
  W: ["101", "101", "111", "111", "101"],
};

const DAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const DIGITAL_GRID_COLUMNS = 21;
const DIGITAL_GRID_ROWS = 17;

function getClockParts(date, use24Hour) {
  const hours24 = date.getHours();
  const hours12 = hours24 % 12 || 12;
  const minutes = date.getMinutes();
  const displayHours = use24Hour ? String(hours24).padStart(2, "0") : String(hours12);

  return {
    time: `${displayHours}:${String(minutes).padStart(2, "0")}`,
    period: hours24 >= 12 ? "PM" : "AM",
    dayLabel: DAY_LABELS[date.getDay()],
    hourDeg: ((hours12 % 12) + minutes / 60) * 30,
    minuteDeg: minutes * 6,
    secondDeg: date.getSeconds() * 6,
  };
}

function SegmentDigit({ value }) {
  const activeSegments = SEGMENTS[value] || [];

  return (
    <span className="clock-segment-digit">
      {["a", "b", "c", "d", "e", "f", "g"].map((segment) => (
        <span
          key={segment}
          className={`clock-segment clock-segment-${segment} ${activeSegments.includes(segment) ? "clock-segment-on" : ""}`}
        />
      ))}
    </span>
  );
}

function DigitalClock({ parts }) {
  const activeCells = new Set();
  const colonCells = new Set();
  const chars = parts.time.split("");
  const glyphs = chars.map((char) => (char === ":" ? ["0", "1", "0", "1", "0"] : DOT_DIGITS[char] || DOT_DIGITS["0"]));
  const glyphWidths = glyphs.map((glyph) => glyph[0].length);
  const contentWidth = glyphWidths.reduce((total, width) => total + width, 0) + chars.length - 1;
  let cursorX = Math.floor((DIGITAL_GRID_COLUMNS - contentWidth) / 2);
  const startY = 4;

  glyphs.forEach((glyph, glyphIndex) => {
    glyph.forEach((row, rowIndex) => {
      row.split("").forEach((cell, columnIndex) => {
        if (cell === "1") {
          const cellKey = `${cursorX + columnIndex}-${startY + rowIndex}`;
          activeCells.add(cellKey);
          if (chars[glyphIndex] === ":") colonCells.add(cellKey);
        }
      });
    });
    cursorX += glyphWidths[glyphIndex] + 1;
  });

  const dayGlyphs = parts.dayLabel.split("").map((char) => DOT_LETTERS[char] || DOT_LETTERS.S);
  const dayGlyphWidths = dayGlyphs.map((glyph) => glyph[0].length);
  const dayContentWidth = dayGlyphWidths.reduce((total, width) => total + width, 0) + dayGlyphs.length - 1;
  let dayCursorX = Math.floor((DIGITAL_GRID_COLUMNS - dayContentWidth) / 2);
  const dayStartY = 11;

  dayGlyphs.forEach((glyph, glyphIndex) => {
    glyph.forEach((row, rowIndex) => {
      row.split("").forEach((cell, columnIndex) => {
        if (cell === "1") {
          activeCells.add(`${dayCursorX + columnIndex}-${dayStartY + rowIndex}`);
        }
      });
    });
    dayCursorX += dayGlyphWidths[glyphIndex] + 1;
  });

  return (
    <div className="clock-digital-grid" aria-hidden="true">
      {Array.from({ length: DIGITAL_GRID_COLUMNS * DIGITAL_GRID_ROWS }, (_, index) => {
        const x = index % DIGITAL_GRID_COLUMNS;
        const y = Math.floor(index / DIGITAL_GRID_COLUMNS);
        return (
          <span
            key={index}
            className={[
              activeCells.has(`${x}-${y}`) ? "clock-lit-dot" : "",
              colonCells.has(`${x}-${y}`) ? "clock-colon-dot" : "",
            ].filter(Boolean).join(" ")}
          />
        );
      })}
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
    <button
      type="button"
      className="clock-widget flex h-full w-full flex-col items-center justify-center rounded-[inherit] text-center"
      onClick={() => setMode(nextMode)}
      title={`Switch to ${nextMode} view`}
      aria-label={`Clock showing ${parts.time}${use24Hour ? "" : ` ${parts.period}`}. Click to switch to the ${nextMode} view.`}
    >
      {mode === "digital" && <DigitalClock parts={parts} />}
      {mode === "analog" && (
        <>
          <span className="clock-hole-field" aria-hidden="true" />
          <AnalogClock parts={parts} />
          <span className="clock-perforated-mask" aria-hidden="true" />
        </>
      )}
      {mode === "year" && <YearClock now={now} />}
    </button>
  );
}
