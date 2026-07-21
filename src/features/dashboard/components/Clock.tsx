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

const COLON_GLYPH = ["0", "1", "0", "1", "0"];
const DIGITS_START_Y = 4;
const DAY_LABEL_START_Y = 11;
const EXPLODE_MS = 600;
const CONVERGE_MS = 950;
const CONVERGE_DELAY_MS = EXPLODE_MS * 0.6; // converge starts before the explode fully finishes, so motion stays continuous
const RGB_SHIFT_CELLS = 0.85; // how far the chromatic fringe splits from the dot at peak speed
const RIPPLE_FREQUENCY = 1; // spatial frequency of the wave along the radius, in radians per grid cell
const RIPPLE_SPEED = 0.012; // how fast the ripple travels outward, in radians per ms
const RIPPLE_AMPLITUDE = 5; // peak radial displacement, in grid cells
const OCTAGON_STRENGTH = 0.35; // 0 = perfectly circular rings, higher = more octagonal

function layoutGlyphCells(chars, glyphs, startY) {
  const glyphWidths = glyphs.map((glyph) => glyph[0].length);
  const contentWidth = glyphWidths.reduce((total, width) => total + width, 0) + chars.length - 1;
  let cursorX = Math.floor((DIGITAL_GRID_COLUMNS - contentWidth) / 2);
  const cells = [];

  glyphs.forEach((glyph, glyphIndex) => {
    glyph.forEach((row, rowIndex) => {
      row.split("").forEach((cell, columnIndex) => {
        if (cell === "1") {
          cells.push({ x: cursorX + columnIndex, y: startY + rowIndex, isColon: chars[glyphIndex] === ":" });
        }
      });
    });
    cursorX += glyphWidths[glyphIndex] + 1;
  });

  return cells;
}

function computeActiveDots(parts) {
  const chars = parts.time.split("");
  const glyphs = chars.map((char) => (char === ":" ? COLON_GLYPH : DOT_DIGITS[char] || DOT_DIGITS["0"]));
  const dayChars = parts.dayLabel.split("");
  const dayGlyphs = dayChars.map((char) => DOT_LETTERS[char] || DOT_LETTERS.S);

  return [
    ...layoutGlyphCells(chars, glyphs, DIGITS_START_Y),
    ...layoutGlyphCells(dayChars, dayGlyphs, DAY_LABEL_START_Y),
  ];
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

// Distance and direction from the board's center, plus an 8-fold ("octagon")
// angular modulation of that distance — cached once per dot since a ripple
// wave is driven by each dot's own fixed distance from center, not by where
// it ends up moving. Combining a cosine wave at 8x the angular frequency with
// the radius warps an otherwise-circular ring into an octagon; higher
// OCTAGON_STRENGTH makes the eight lobes more pronounced.
function radialInfo(x, y) {
  const centerX = (DIGITAL_GRID_COLUMNS - 1) / 2;
  const centerY = (DIGITAL_GRID_ROWS - 1) / 2;
  const dx = x - centerX;
  const dy = y - centerY;
  const r = Math.hypot(dx, dy);
  const ux = r > 0.5 ? dx / r : 1;
  const uy = r > 0.5 ? dy / r : 0;
  const theta = Math.atan2(uy, ux);
  const octagon = 1 + OCTAGON_STRENGTH * Math.cos(8 * theta);
  return { r, ux, uy, octagon };
}

// Every grid cell's radial info, computed once since it only depends on the
// (fixed) grid dimensions — used to ripple the dim background board itself,
// not just the lit digit dots, so the whole grid waves together.
const GRID_RADIAL = [];
for (let y = 0; y < DIGITAL_GRID_ROWS; y++) {
  for (let x = 0; x < DIGITAL_GRID_COLUMNS; x++) {
    GRID_RADIAL.push(radialInfo(x, y));
  }
}
const BOARD_RIPPLE_MS = CONVERGE_DELAY_MS + CONVERGE_MS;

// Builds a two-phase transition: every previously-lit dot first blows outward
// off the board (explode), then every newly-lit dot flies in and lands on the
// new digits (converge). Rather than flying to a random scattered point, each
// dot rides a sine wave along its own radial line, phased by its distance
// from center (see radialInfo) so different rings peak at different times —
// the surface stretches and squeezes outward like an actual ripple.
function buildTransitionParticles(prevDots, nextDots, startTime) {
  const outgoing = prevDots.map((dot) => {
    const { r, ux, uy, octagon } = radialInfo(dot.x, dot.y);
    return {
      fromX: dot.x,
      fromY: dot.y,
      toX: dot.x,
      toY: dot.y,
      fromOpacity: 1,
      toOpacity: 0,
      isColon: false,
      startTime,
      duration: EXPLODE_MS,
      ease: easeOutCubic,
      r0: r,
      ux,
      uy,
      octagon,
    };
  });

  const incoming = nextDots.map((dot) => {
    const { r, ux, uy, octagon } = radialInfo(dot.x, dot.y);
    return {
      fromX: dot.x,
      fromY: dot.y,
      toX: dot.x,
      toY: dot.y,
      fromOpacity: 0,
      toOpacity: 1,
      isColon: dot.isColon,
      startTime: startTime + CONVERGE_DELAY_MS,
      duration: CONVERGE_MS,
      ease: easeOutCubic,
      r0: r,
      ux,
      uy,
      octagon,
    };
  });

  return [...outgoing, ...incoming];
}

// Canvas-drawn (not DOM) so every dot keeps the same radius and can animate to
// a non-grid-snapped position mid-flight; DOM boxes would snap to device
// pixels and jitter as they moved. When the displayed digits change, the whole
// board ripples outward in an octagonal wave and the new digits ripple back
// together, with a chromatic red/blue fringe that splits away while rippling.
function DigitalClock({ parts, containerRef }) {
  const canvasRef = useRef(null);
  const animRef = useRef({ particles: [], prevDots: [], transitionStartTime: 0 });
  const targetDots = useMemo(() => computeActiveDots(parts), [parts.time, parts.dayLabel]);

  useEffect(() => {
    const anim = animRef.current;
    const startTime = performance.now();
    anim.particles = buildTransitionParticles(anim.prevDots, targetDots, startTime);
    anim.prevDots = targetDots;
    anim.transitionStartTime = startTime;
  }, [targetDots]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    let frameId = null;

    const draw = (timestamp) => {
      frameId = requestAnimationFrame(draw);

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const refBox = containerRef.current;
      const refW = refBox ? refBox.clientWidth : w;
      const refH = refBox ? refBox.clientHeight : h;
      if (!w || !h || !refW || !refH) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // The canvas box is bigger than the visible card (see .clock-digital-canvas)
      // so exploding dots have room to fly past its edges; padX/padY re-center the
      // grid on the card's own footprint rather than the inflated canvas box.
      // stepX/stepY are independent (rather than one shared min()) so the grid
      // fills the card edge-to-edge on both axes instead of only the width, with
      // dots letterboxed top/bottom; that leftover margin was why the explode/
      // converge motion looked like it reached the card's edges horizontally but
      // fell short vertically — the vertical dots simply started further from
      // the edge. Dot radius still comes from the tighter axis so dots stay round.
      const padX = (w - refW) / 2;
      const padY = (h - refH) / 2;
      const stepX = refW / DIGITAL_GRID_COLUMNS;
      const stepY = refH / DIGITAL_GRID_ROWS;
      const originX = padX + stepX / 2;
      const originY = padY + stepY / 2;
      const radius = Math.min(stepX, stepY) * 0.27;
      const baseColor = getComputedStyle(canvas).color;

      // Dim background dots: the always-visible board texture. These ripple too
      // (using every cell's precomputed radial info) so the whole grid waves
      // together on each transition, not just the lit digit dots.
      const boardElapsed = timestamp - animRef.current.transitionStartTime;
      const boardProgress = Math.min(1, Math.max(0, boardElapsed / BOARD_RIPPLE_MS));
      const boardEnvelope = Math.sin(boardProgress * Math.PI);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = baseColor;
      ctx.globalAlpha = 0.2;
      for (let y = 0; y < DIGITAL_GRID_ROWS; y++) {
        for (let x = 0; x < DIGITAL_GRID_COLUMNS; x++) {
          const { r, ux, uy, octagon } = GRID_RADIAL[y * DIGITAL_GRID_COLUMNS + x];
          const wavePhase = r * RIPPLE_FREQUENCY - Math.max(0, boardElapsed) * RIPPLE_SPEED;
          const ripple = RIPPLE_AMPLITUDE * octagon * Math.sin(wavePhase) * boardEnvelope;
          const bx = x + ux * ripple;
          const by = y + uy * ripple;
          ctx.beginPath();
          ctx.arc(originX + bx * stepX, originY + by * stepY, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Lit dots: exploding out / converging in, with a chromatic fringe while moving.
      const blinkOn = Math.floor(timestamp / 500) % 2 === 0;
      animRef.current.particles.forEach((particle) => {
        const elapsed = timestamp - particle.startTime;
        const progress = Math.min(1, Math.max(0, elapsed / particle.duration));
        const eased = particle.ease(progress);
        let opacity = particle.fromOpacity + (particle.toOpacity - particle.fromOpacity) * eased;
        if (particle.isColon && progress >= 1 && particle.toOpacity > 0) {
          opacity = blinkOn ? 1 : 0.18;
        }
        opacity = Math.max(0, Math.min(1, opacity));
        if (opacity <= 0.01) return;

        // The ripple's own envelope: 0 at the start and end of this phase, peaking
        // in the middle, so the dot always lands exactly back on its real digit
        // position (zero displacement) right as it finishes fading in or out.
        const envelope = Math.sin(progress * Math.PI);
        const wavePhase = particle.r0 * RIPPLE_FREQUENCY - Math.max(0, elapsed) * RIPPLE_SPEED;
        const ripple = RIPPLE_AMPLITUDE * particle.octagon * Math.sin(wavePhase) * envelope;
        const x = particle.fromX + particle.ux * ripple;
        const y = particle.fromY + particle.uy * ripple;

        const px = originX + x * stepX;
        const py = originY + y * stepY;

        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = baseColor;
        ctx.globalAlpha = opacity;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();

        // Chromatic fringe peaks mid-ripple and disappears once the dot settles.
        if (envelope > 0.02) {
          const shiftX = particle.ux * RGB_SHIFT_CELLS * envelope * stepX;
          const shiftY = particle.uy * RGB_SHIFT_CELLS * envelope * stepY;

          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = opacity * envelope * 0.8;

          ctx.fillStyle = "rgb(255, 45, 95)";
          ctx.beginPath();
          ctx.arc(px + shiftX, py + shiftY, radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "rgb(50, 140, 255)";
          ctx.beginPath();
          ctx.arc(px - shiftX, py - shiftY, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    };

    frameId = requestAnimationFrame(draw);
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="clock-digital-canvas" aria-hidden="true" />;
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
  const buttonRef = useRef(null);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const nextMode = mode === "digital" ? "analog" : mode === "analog" ? "year" : "digital";

  return (
    <div className="clock-shell relative h-full w-full rounded-[inherit]">
      <button
        ref={buttonRef}
        type="button"
        className="clock-widget flex h-full w-full flex-col items-center justify-center rounded-[inherit] text-center"
        onClick={() => setMode(nextMode)}
        title={`Switch to ${nextMode} view`}
        aria-label={`Clock showing ${parts.time}${use24Hour ? "" : ` ${parts.period}`}. Click to switch to the ${nextMode} view.`}
      >
        {mode === "analog" && (
          <>
            <span className="clock-hole-field" aria-hidden="true" />
            <AnalogClock parts={parts} />
            <span className="clock-perforated-mask" aria-hidden="true" />
          </>
        )}
        {mode === "year" && <YearClock now={now} />}
      </button>
      {/* Rendered outside the button so the exploding dots can fly past the card's own clipped edges. */}
      {mode === "digital" && <DigitalClock parts={parts} containerRef={buttonRef} />}
    </div>
  );
}
