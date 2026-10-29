import { useEffect, useState } from "react";
import { HiOutlineBugAnt, HiXMark } from "react-icons/hi2";

import { DEBUG_PLACES, debugNow, fromWallClock, isDebugging, useDebugStore, wallClock } from "@/lib/debug";

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * The dashboard debugger: show another time or place, and every time- and
 * place-aware card follows (clock, solar chart, weather, air quality,
 * globe). Toggle with Alt+Shift+D or from the command palette; a pill stays
 * on screen while anything is overridden.
 */
export default function DebugPanel() {
  const { panelOpen, timeOffsetMs, location, setPanelOpen, setTime, setLocation, reset } = useDebugStore();
  const [, setTick] = useState(0);
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const active = isDebugging({ timeOffsetMs, location });

  // Keep the shown time moving.
  useEffect(() => {
    if (!panelOpen && !active) return undefined;
    const interval = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(interval);
  }, [panelOpen, active]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey && event.shiftKey && event.code === "KeyD") {
        event.preventDefault();
        setPanelOpen(!useDebugStore.getState().panelOpen);
      }
      if (event.key === "Escape" && useDebugStore.getState().panelOpen) setPanelOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPanelOpen]);

  const timeZone = location?.timeZone;
  const now = debugNow();
  const wall = wallClock(now, timeZone);
  const minutes = wall.hours * 60 + wall.minutes;
  const dateValue = `${wall.year}-${pad(wall.month)}-${pad(wall.day)}`;
  const summary = [
    location?.label,
    Math.abs(timeOffsetMs) > 1000
      ? now.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone })
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const setWall = (year: number, month: number, day: number, mins: number) =>
    setTime(fromWallClock(year, month, day, Math.floor(mins / 60), mins % 60, timeZone));

  if (!panelOpen) {
    if (!active) return null;
    return (
      <div className="debug-pill surface-glass" role="status">
        <button type="button" className="debug-pill-open" onClick={() => setPanelOpen(true)} title="Open the debugger">
          <HiOutlineBugAnt className="size-3.5" />
          <span>Debugging · {summary}</span>
        </button>
        <button type="button" className="debug-pill-reset" onClick={reset} aria-label="Stop debugging" title="Back to the real time and place">
          <HiXMark className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <section className="debug-panel surface-glass" aria-label="Debugger">
      <header className="debug-panel-header">
        <span className="debug-panel-title">
          <HiOutlineBugAnt className="size-3.5" /> Debugger
        </span>
        <button type="button" className="debug-icon-button" onClick={() => setPanelOpen(false)} aria-label="Close the debugger">
          <HiXMark className="size-3.5" />
        </button>
      </header>

      <div className="debug-section">
        <div className="debug-section-head">
          <span className="eyebrow">Time</span>
          <span className="debug-readout numeric">
            {now.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone })}
          </span>
        </div>
        <div className="debug-row">
          <input
            type="date"
            className="debug-input"
            value={dateValue}
            onChange={(event) => {
              const [y, m, d] = event.target.value.split("-").map(Number);
              if (y && m && d) setWall(y, m, d, minutes);
            }}
            aria-label="Date"
          />
          <button type="button" className="debug-button" onClick={() => setTime(new Date(now.getTime() - 3_600_000))}>
            −1h
          </button>
          <button type="button" className="debug-button" onClick={() => setTime(new Date(now.getTime() + 3_600_000))}>
            +1h
          </button>
          <button type="button" className="debug-button" onClick={() => setTime(null)} disabled={Math.abs(timeOffsetMs) <= 1000}>
            Now
          </button>
        </div>
        <input
          type="range"
          className="debug-slider"
          min={0}
          max={1439}
          step={5}
          value={minutes}
          onChange={(event) => setWall(wall.year, wall.month, wall.day, Number(event.target.value))}
          aria-label="Time of day"
        />
      </div>

      <div className="debug-section">
        <div className="debug-section-head">
          <span className="eyebrow">Place</span>
          {location && <span className="debug-readout numeric">{location.latitude.toFixed(2)}, {location.longitude.toFixed(2)}</span>}
        </div>
        <select
          className="debug-input"
          value={location ? DEBUG_PLACES.findIndex((p) => p.label === location.label) : -1}
          onChange={(event) => {
            const index = Number(event.target.value);
            setLocation(index >= 0 ? DEBUG_PLACES[index] : null);
          }}
          aria-label="Place"
        >
          <option value={-1}>Your location</option>
          {DEBUG_PLACES.map((place, index) => (
            <option key={place.label} value={index}>
              {place.label}
            </option>
          ))}
          {location && DEBUG_PLACES.every((p) => p.label !== location.label) && <option value={-2}>{location.label}</option>}
        </select>
        <form
          className="debug-row"
          onSubmit={(event) => {
            event.preventDefault();
            const latitude = Number(lat);
            const longitude = Number(lon);
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return;
            setLocation({ label: `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`, latitude, longitude });
          }}
        >
          <input className="debug-input" inputMode="decimal" placeholder="Latitude" value={lat} onChange={(event) => setLat(event.target.value)} aria-label="Latitude" />
          <input className="debug-input" inputMode="decimal" placeholder="Longitude" value={lon} onChange={(event) => setLon(event.target.value)} aria-label="Longitude" />
          <button type="submit" className="debug-button">
            Go
          </button>
        </form>
      </div>

      <footer className="debug-panel-footer">
        <span>This device only · Alt+Shift+D</span>
        <button type="button" className="debug-button" onClick={reset} disabled={!active}>
          Reset all
        </button>
      </footer>
    </section>
  );
}
