import { useEffect, useRef, useState } from "react";
import { forgetOnScreen, isOnScreen } from "@/lib/on-screen";
import { HiOutlineClock } from "react-icons/hi2";

import landMaskUrl from "@/assets/world/land-mask.png";
import { debugNow, useDebugStore } from "@/lib/debug";
import { motionTime, replayNow } from "@/lib/motion";
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

/** The browser's time zone as a place ("Chicago"), as the clock shows it. */
function zonePlace() {
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
  // "Now" and the place come from the dashboard debugger when it's set.
  const [now, setNow] = useState(() => debugNow());
  const debugPlace = useDebugStore((state) => state.location);
  const timeOffset = useDebugStore((state) => state.timeOffsetMs);
  const openDebugger = useDebugStore((state) => state.setPanelOpen);
  // The replayed moment while the day replays (shared with the solar chart
  // and weather sky); null once it reaches now.
  const [sweepTime, setSweepTime] = useState<Date | null>(null);
  const replayingRef = useRef(false);
  // Pulse clock (on the shared animation clock), so the ring never jumps.
  const pulseStartRef = useRef(motionTime());

  const latitude = debugPlace?.latitude ?? savedLatitude ?? located?.latitude ?? FALLBACK.latitude;
  const longitude = debugPlace?.longitude ?? savedLongitude ?? located?.longitude ?? FALLBACK.longitude;
  const timeZone = debugPlace?.timeZone;
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

  // The label's clock, and the sun's position, move on once a minute (and
  // at once when the debugger changes the time).
  useEffect(() => {
    const tick = () => setNow(debugNow());
    tick();
    const timeout = window.setTimeout(() => {
      tick();
      interval = window.setInterval(tick, 60_000);
    }, 60_000 - (Date.now() % 60_000));
    let interval = 0;
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [timeOffset]);

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
    const pulseTime = () => motionTime() - pulseStartRef.current;

    const renderScene = () => {
      if (!canvas.clientWidth || replayingRef.current) return;
      renderer.renderScene({ ...sceneRef.current, now: debugNow() });
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
      renderScene();
    };
    image.src = landMaskUrl;

    // During the day replay the planet renders every frame; after it, the
    // pulse animates at 30 fps. With reduced motion it stays still and only
    // redraws when the scene does.
    const loop = (timestamp: number) => {
      frame = requestAnimationFrame(loop);
      if (!canvas.clientWidth || !isOnScreen(canvas)) return;
      const at = replayNow();
      if (at) {
        replayingRef.current = true;
        renderer.renderScene({ ...sceneRef.current, now: at });
        renderer.renderFrame(0, false);
        setSweepTime(at);
        return;
      }
      if (replayingRef.current) {
        // Landed on now: hand over to the live view, first ripple at once.
        replayingRef.current = false;
        setSweepTime(null);
        pulseStartRef.current = motionTime();
        renderScene();
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
      forgetOnScreen(canvas);
      observer.disconnect();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  // Re-render the planet when the view, the location or the minute changes.
  useEffect(() => {
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    if (!renderer || !canvas?.clientWidth || replayingRef.current) return;
    renderer.renderScene({ view, latitude, longitude, now });
    renderer.renderFrame(motionTime() - pulseStartRef.current, !prefersReducedMotion());
  }, [view, latitude, longitude, now]);

  // The caption follows the replay, then the clock, in the place's time zone.
  const shown = sweepTime ?? now;
  const elevation = sunElevation(latitude, longitude, shown);
  const time = shown.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone });
  const place = debugPlace?.label ?? zonePlace();

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
      {/* Opens the dashboard debugger (time and place for every card). */}
      <button
        type="button"
        className="globe-debug-toggle surface-glass"
        data-view={view}
        onClick={() => openDebugger(true)}
        title="Change the time or place"
        aria-label="Open the debugger to change the time or place"
      >
        <HiOutlineClock className="size-3.5" />
      </button>
    </div>
  );
}
