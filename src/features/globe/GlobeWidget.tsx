import { useEffect, useRef, useState } from "react";

import landMaskUrl from "@/assets/world/land-mask.png";
import { getOrRequestLocation } from "@/lib/geolocation";
import { ambientFrameMs, prefersReducedMotion } from "@/lib/power";
import { readSettings } from "@/lib/settings";
import { useSettingsStore } from "@/features/settings/stores";
import type { GlobeView } from "./framing";
import { createGlobeRenderer, type GlobeRenderer } from "./renderer";
import { sunElevation } from "./sun";

// New York until the browser shares a location, like the solar chart.
const FALLBACK = { latitude: 40.7128, longitude: -74.006 };
// The planet is rendered at up to 1.5x the screen's pixels: the scene pass
// is heavy, and the dots stay crisp at this density.
const MAX_DPR = 1.5;
const FRAME_MS = 1000 / 30;

// On load the sun replays the day so far: time runs from local midnight to
// now, a short sweep just after midnight and up to ~4 s by evening. It eases
// in and out: a beat on the night side, then through the day, settling into
// the present.
function sweepDuration(from: Date, to: Date) {
  const dayFraction = (to.getTime() - from.getTime()) / 86_400_000;
  return 1200 + 2800 * Math.min(1, Math.max(0, dayFraction));
}
const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

function localMidnight(date: Date) {
  const midnight = new Date(date);
  midnight.setHours(0, 0, 0, 0);
  return midnight;
}

/** The browser's time zone as a place ("Chicago"), as the clock shows it. */
function placeLabel() {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  return zone.includes("/") ? zone.split("/").pop()!.replace(/_/g, " ") : "Here";
}

function daylightLabel(elevation: number) {
  if (elevation > 0) return "Day";
  if (elevation > -6) return "Twilight";
  return "Night";
}

/**
 * A dot globe in the style of the design-lab atmosphere posters: land as
 * dots on a real planet with a physically lit atmosphere, the day/night line
 * where it is right now (sun position from the date, time and Earth's tilt),
 * and the viewer's location in yellow, pulsing a ripple across the world.
 */
export default function GlobeWidget({ view }: { view: GlobeView }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<GlobeRenderer | null>(null);
  const [failed, setFailed] = useState(false);
  const savedLatitude = useSettingsStore((state) => state.settings.latitude);
  const savedLongitude = useSettingsStore((state) => state.settings.longitude);
  const [located, setLocated] = useState<{ latitude: number; longitude: number } | null>(null);
  const [now, setNow] = useState(() => new Date());
  // The replayed moment while the day sweeps in; null once it reaches now.
  const [sweepTime, setSweepTime] = useState<Date | null>(null);
  const sweepRef = useRef<{ start: number; from: Date; to: Date; duration: number } | null>(null);
  // Pulse clock, shared by every redraw so the ring never jumps.
  const pulseStartRef = useRef(performance.now());

  const latitude = savedLatitude ?? located?.latitude ?? FALLBACK.latitude;
  const longitude = savedLongitude ?? located?.longitude ?? FALLBACK.longitude;
  const sceneRef = useRef({ view, latitude, longitude });
  sceneRef.current = { view, latitude, longitude };

  // Ask the browser for a location when none is saved.
  useEffect(() => {
    if (readSettings().latitude != null) return;
    let alive = true;
    void getOrRequestLocation().then((coords) => {
      if (alive && coords) setLocated({ latitude: coords.lat, longitude: coords.lon });
    });
    return () => {
      alive = false;
    };
  }, []);

  // The label's clock, and the sun's position, move on once a minute.
  useEffect(() => {
    const tick = () => setNow(new Date());
    const timeout = window.setTimeout(() => {
      tick();
      interval = window.setInterval(tick, 60_000);
    }, 60_000 - (Date.now() % 60_000));
    let interval = 0;
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, []);

  // GL set-up, sizing and the frame loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let renderer: GlobeRenderer;
    try {
      renderer = createGlobeRenderer(canvas);
    } catch (error) {
      console.warn("[globe] WebGL2 unavailable", error);
      setFailed(true);
      return undefined;
    }
    rendererRef.current = renderer;
    let alive = true;
    let frame = 0;
    let lastFrame = 0;
    const pulseTime = () => (performance.now() - pulseStartRef.current) / 1000;

    const renderScene = () => {
      if (!canvas.clientWidth || sweepRef.current) return;
      renderer.renderScene({ ...sceneRef.current, now: new Date() });
      renderer.renderFrame(pulseTime(), !prefersReducedMotion());
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        renderScene();
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const image = new Image();
    image.onload = () => {
      if (!alive) return;
      renderer.setLandMask(image);
      if (prefersReducedMotion()) {
        renderScene();
        return;
      }
      const to = new Date();
      const from = localMidnight(to);
      sweepRef.current = { start: performance.now(), from, to, duration: sweepDuration(from, to) };
    };
    image.src = landMaskUrl;

    // The day sweep renders the planet every frame; after it, the pulse
    // animates at 30 fps. With reduced motion it stays still and only
    // redraws when the scene does.
    const loop = (timestamp: number) => {
      frame = requestAnimationFrame(loop);
      if (!canvas.clientWidth || document.hidden) return;
      const sweep = sweepRef.current;
      if (sweep) {
        const progress = Math.min(1, (performance.now() - sweep.start) / sweep.duration);
        const at = new Date(sweep.from.getTime() + (sweep.to.getTime() - sweep.from.getTime()) * easeInOutCubic(progress));
        renderer.renderScene({ ...sceneRef.current, now: at });
        renderer.renderFrame(0, false);
        setSweepTime(at);
        if (progress >= 1) {
          // Landed on now: hand over to the live view, first ripple at once.
          sweepRef.current = null;
          setSweepTime(null);
          pulseStartRef.current = performance.now();
          renderScene();
        }
        return;
      }
      if (prefersReducedMotion()) return;
      if (timestamp - lastFrame < ambientFrameMs(FRAME_MS)) return;
      lastFrame = timestamp;
      renderer.renderFrame(pulseTime(), true);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  // Re-render the planet when the view, the location or the minute changes.
  useEffect(() => {
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    if (!renderer || !canvas?.clientWidth || sweepRef.current) return;
    renderer.renderScene({ view, latitude, longitude, now });
    renderer.renderFrame((performance.now() - pulseStartRef.current) / 1000, !prefersReducedMotion());
  }, [view, latitude, longitude, now]);

  // The caption follows the sweep, then the clock.
  const shown = sweepTime ?? now;
  const elevation = sunElevation(latitude, longitude, shown);
  const time = shown.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const place = placeLabel();

  return (
    <div className="globe-widget relative h-full w-full overflow-hidden rounded-[inherit]" style={{ background: "#1d1d1d" }}>
      {!failed && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 block h-full w-full"
          role="img"
          aria-label={`Globe showing day and night now, with ${place} highlighted`}
        />
      )}
      {/* Over dark space: top-left beside the whole globe, bottom-left under
          the limb (where poster II sets its type). */}
      <div className="globe-caption" data-view={view}>
        <p className="globe-caption-place">{place}</p>
        <p className="globe-caption-time numeric">
          {time} · {daylightLabel(elevation)}
        </p>
      </div>
    </div>
  );
}
