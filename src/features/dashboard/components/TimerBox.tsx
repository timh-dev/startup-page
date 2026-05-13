import React from "react";
import { HiPause, HiPlay, HiStop, HiPencil } from "react-icons/hi2";
import { readSettings, writeSettings } from "@/lib/settings";

const PRESETS = [5, 15, 25, 50];

// Horizontal scrolling tape — continuously animated with requestAnimationFrame
function TapeRibbon({ remaining, totalSeconds, running }) {
  const [pos, setPos] = React.useState(remaining);

  // RAF loop: restarts each time running or remaining changes.
  // At restart pos ≈ remaining (no visible jump), then counts down in real time.
  React.useEffect(() => {
    if (!running) {
      setPos(remaining);
      return undefined;
    }
    const startSec  = remaining;
    const startTime = performance.now();
    let rafId;
    const tick = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      setPos(Math.max(0, startSec - elapsed));
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [running, remaining]);

  // Fractional minute position drives continuous ribbon movement
  const tapePos = pos / 60;
  const SPAN    = 2;
  const cellW   = 100 / 3;
  const minInt  = Math.floor(tapePos);

  const cells = [];
  for (let v = minInt + SPAN; v >= Math.max(0, minInt - SPAN); v--) {
    cells.push(v);
  }

  return (
    <div
      className="relative flex-1 overflow-hidden"
      style={{ background: "#f97316" }}
    >
      {/* Scrolling cells — no CSS transition, RAF handles smoothness */}
      {cells.map((value) => {
        const offset = value - tapePos;
        return (
          <div
            key={value}
            style={{
              position: "absolute",
              top: 0,
              bottom: "18px",
              width: `${cellW}%`,
              left: `${50 + offset * cellW}%`,
              transform: "translateX(-50%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            <span
              style={{
                fontWeight: 900,
                fontSize: "clamp(2rem,12cqw,3.8rem)",
                color: "#1a0800",
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1,
                letterSpacing: "-0.02em",
              }}
            >
              {value}
            </span>
          </div>
        );
      })}

      {/* Soft edge fades so cut-off cells blend into the bg */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0"
        style={{ width: "10%", background: "linear-gradient(to right,#f97316,transparent)" }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0"
        style={{ width: "10%", background: "linear-gradient(to left,#f97316,transparent)" }}
      />

      {/* Center hairline */}
      <div
        className="pointer-events-none absolute inset-y-0 left-1/2"
        style={{ width: "1px", background: "rgba(0,0,0,0.15)", transform: "translateX(-50%)" }}
      />

      {/* Tick strip — white, small */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-end"
        style={{ height: "18px", gap: "1px", padding: "0 3px 2px" }}
      >
        {Array.from({ length: 60 }, (_, i) => {
          const isMajor = i % 15 === 0;
          const isMid   = i % 5 === 0;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: isMajor ? "8px" : isMid ? "5px" : "3px",
                background: `rgba(255,255,255,${isMajor ? 0.85 : isMid ? 0.55 : 0.35})`,
                alignSelf: "flex-end",
                borderRadius: "0.5px",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function TimerBox() {
  const settings    = React.useMemo(() => readSettings(), []);
  const defaultMins = Math.max(Number(settings.timer?.focusMinutes || 25), 1);

  const [totalSeconds, setTotalSeconds] = React.useState(defaultMins * 60);
  const [remaining,    setRemaining]    = React.useState(defaultMins * 60);
  const [running,      setRunning]      = React.useState(false);
  const [editing,      setEditing]      = React.useState(false);
  const [editMin,      setEditMin]      = React.useState(String(defaultMins));
  const [editSec,      setEditSec]      = React.useState("00");

  React.useEffect(() => {
    if (!running) return undefined;
    const id = window.setInterval(() => {
      setRemaining((s) => {
        if (s <= 1) { setRunning(false); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const isDone = remaining === 0;
  const mins   = Math.floor((remaining % 3600) / 60);
  const hours  = Math.floor(remaining / 3600);
  const secs   = remaining % 60;

  const applyEdit = () => {
    const m     = Math.max(0, Math.min(999, parseInt(editMin) || 0));
    const s     = Math.max(0, Math.min(59,  parseInt(editSec) || 0));
    const total = m * 60 + s;
    if (total > 0) {
      setTotalSeconds(total);
      setRemaining(total);
      setRunning(false);
      void writeSettings({ ...readSettings(), timer: { focusMinutes: m } });
    }
    setEditing(false);
  };

  const applyPreset = (m) => { setEditMin(String(m)); setEditSec("00"); };
  const reset = () => { setRemaining(totalSeconds); setRunning(false); };

  const status = isDone ? "TIME'S UP" : running ? "COUNTING DOWN" : "READY";

  return (
    <div className="timer-box flex h-full w-full flex-col overflow-hidden rounded-[inherit]">
      {editing ? (
        /* ── Edit mode — full card ── */
        <div
          className="flex h-full flex-col justify-between p-3"
          style={{ background: "linear-gradient(135deg,#1c1c1c 0%,#111 100%)" }}
        >
          <div>
            <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.22em] text-white/30">
              Set Timer
            </p>
            <div className="mb-2.5 flex items-center gap-1.5">
              <input
                type="number" min="0" max="999"
                value={editMin}
                onChange={(e) => setEditMin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyEdit()}
                autoFocus
                className="w-14 rounded-lg border border-white/10 bg-white/8 px-2 py-1.5 text-center text-base font-bold text-white outline-none focus:border-orange-500"
              />
              <span className="text-sm font-bold text-white/35">M</span>
              <input
                type="number" min="0" max="59"
                value={editSec}
                onChange={(e) => setEditSec(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyEdit()}
                className="w-14 rounded-lg border border-white/10 bg-white/8 px-2 py-1.5 text-center text-base font-bold text-white outline-none focus:border-orange-500"
              />
              <span className="text-sm font-bold text-white/35">S</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {PRESETS.map((m) => (
                <button
                  key={m} type="button"
                  onClick={() => applyPreset(m)}
                  className={`rounded-lg py-1 text-[11px] font-semibold transition ${
                    editMin === String(m) && editSec === "00"
                      ? "bg-orange-500 text-white"
                      : "bg-white/8 text-white/45 hover:bg-white/12 hover:text-white/70"
                  }`}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={applyEdit}
              className="flex-1 rounded-full bg-orange-500 py-1.5 text-xs font-bold text-white transition hover:bg-orange-400"
            >
              Set Timer
            </button>
            <button type="button" onClick={() => setEditing(false)}
              className="rounded-full bg-white/8 px-3 py-1.5 text-xs font-semibold text-white/45 transition hover:bg-white/14"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ── Tape ribbon ── */}
          <TapeRibbon remaining={remaining} totalSeconds={totalSeconds} running={running} />

          {/* ── Controls bar ── */}
          <div
            className="flex shrink-0 items-center gap-2 px-3 py-2"
            style={{ background: "linear-gradient(135deg,#1c1c1c 0%,#111 100%)", borderTop: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                  setEditMin(String(mins + hours * 60));
                  setEditSec(String(secs).padStart(2, "0"));
                }}
                className="flex items-center gap-1 text-[8.5px] font-bold uppercase tracking-[0.22em] text-white/30 transition hover:text-white/60"
              >
                Timer <HiPencil className="size-2.5" />
              </button>
              <p className="text-[7.5px] font-semibold uppercase tracking-[0.18em] text-white/25">
                {status}
              </p>
            </div>
            <button
              type="button"
              onClick={() => (isDone ? reset() : setRunning((r) => !r))}
              className="flex items-center justify-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-white transition"
              style={{ background: running ? "rgba(255,255,255,0.1)" : "#f97316" }}
            >
              {running ? <HiPause className="size-3.5" /> : <HiPlay className="size-3.5" />}
              {running ? "Pause" : isDone ? "Restart" : "Start"}
            </button>
            <button
              type="button"
              onClick={reset}
              aria-label="Reset timer"
              className="flex shrink-0 items-center justify-center rounded-full bg-white/8 p-1.5 text-white/50 transition hover:bg-white/14 hover:text-white"
            >
              <HiStop className="size-3.5" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
