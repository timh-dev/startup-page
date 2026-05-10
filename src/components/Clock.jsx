import React, { useEffect, useMemo, useState } from "react";

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
  I: ["111", "010", "010", "010", "111"],
  M: ["101", "111", "111", "101", "101"],
  N: ["101", "111", "111", "111", "101"],
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

function getClockParts(date) {
  const hours24 = date.getHours();
  const hours12 = hours24 % 12 || 12;
  const minutes = date.getMinutes();

  return {
    time: `${hours12}:${String(minutes).padStart(2, "0")}`,
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

export default function Clock() {
  const [now, setNow] = useState(() => new Date());
  const [mode, setMode] = useState("digital");
  const parts = useMemo(() => getClockParts(now), [now]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <button
      type="button"
      className="clock-widget flex h-full w-full flex-col items-center justify-center rounded-[inherit] text-center"
      onClick={() => setMode((current) => (current === "digital" ? "analog" : "digital"))}
      aria-label={`Clock showing ${parts.time} ${parts.period}. Click to switch to ${mode === "digital" ? "analog" : "digital"} clock.`}
    >
      {mode === "digital" ? (
        <DigitalClock parts={parts} />
      ) : (
        <>
          <span className="clock-hole-field" aria-hidden="true" />
          <AnalogClock parts={parts} />
          <span className="clock-perforated-mask" aria-hidden="true" />
        </>
      )}
    </button>
  );
}
