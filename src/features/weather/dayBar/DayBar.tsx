import React from "react";

import { forgetOnScreen, isOnScreen } from "@/lib/on-screen";
import { ambientFrameMs } from "@/lib/power";
import { buildColumns, makeParticles, paintBase, paintTexture, type Column } from "./paint";
import type { HourSample } from "./timeline";

interface DayBarProps {
  samples: HourSample[];
  dayStart: number;
  /** Now, for fading the hours already past; null for another day. */
  now: number | null;
  place: { latitude: number; longitude: number };
  /** What the bar shows, in words, for screen readers. */
  label: string;
  /** Holds the texture still (the gallery's comparison grid). */
  still?: boolean;
  /** Paints these columns instead of the day's (the gallery's fixed conditions). */
  makeColumns?: (width: number) => Column[];
}

/** A frame every ~66 ms is plenty for drifting cloud and falling rain. */
const FRAME_MS = 66;
/**
 * How far (CSS px) the frost reaches past each end of the bar, beyond the
 * card's edges, so the blur is solid all the way to them. Matches
 * --day-bar-bleed in the CSS; at least twice the blur.
 */
const BLEED_PX = 28;

/**
 * The day as one frosted band of colour, midnight to midnight. A colour field
 * and a quiet moving texture are painted on two small canvases, and both sit
 * behind the same frost, so the texture is only a soft shimmer in the colour.
 */
export function DayBar({ samples, dayStart, now, place, label, still = false, makeColumns }: DayBarProps) {
  const frostRef = React.useRef<HTMLDivElement>(null);
  const baseRef = React.useRef<HTMLCanvasElement>(null);
  const textureRef = React.useRef<HTMLCanvasElement>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  React.useLayoutEffect(() => {
    const el = frostRef.current;
    if (!el) return undefined;
    const update = () => setSize({ width: Math.round(el.clientWidth), height: Math.round(el.clientHeight) });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The bar itself, inside the bleed.
  const inner = Math.max(0, size.width - BLEED_PX * 2);
  // Columns change with the data, the size, and (for the past fade) each minute.
  const minute = now == null ? null : Math.floor(now / 60_000);
  const columns = React.useMemo(() => {
    if (!inner) return [];
    const width = Math.min(inner, 480);
    return makeColumns ? makeColumns(width) : buildColumns(samples, dayStart, width, place, minute == null ? null : minute * 60_000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samples, dayStart, inner, place.latitude, place.longitude, minute, makeColumns]);
  const particles = React.useMemo(() => makeParticles(inner || 1), [inner]);

  React.useEffect(() => {
    const ctx = baseRef.current?.getContext("2d");
    if (ctx && inner) paintBase(ctx, columns, Math.round((BLEED_PX * columns.length) / inner));
  }, [columns, inner]);

  React.useEffect(() => {
    const canvas = textureRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !size.width || !size.height) return undefined;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size.width * dpr);
    canvas.height = Math.round(size.height * dpr);
    // The texture is drawn over the bar itself, inside the bleed.
    ctx.setTransform(dpr, 0, 0, dpr, BLEED_PX * dpr, 0);

    const draw = (time: number) => paintTexture(ctx, columns, particles, inner, size.height, time / 1000);
    if (still) {
      draw(4_000);
      return undefined;
    }
    let frame = 0;
    let last = 0;
    const loop = (time: number) => {
      frame = requestAnimationFrame(loop);
      if (time - last < ambientFrameMs(FRAME_MS) || !isOnScreen(canvas)) return;
      last = time;
      draw(time);
    };
    draw(performance.now());
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      forgetOnScreen(canvas);
    };
  }, [columns, particles, inner, size.width, size.height, still]);

  return (
    <div className="day-bar" role="img" aria-label={label} title={label}>
      <div ref={frostRef} className="day-bar-frost" aria-hidden="true">
        <canvas ref={baseRef} className="day-bar-base" />
        <canvas ref={textureRef} className="day-bar-texture" />
      </div>
    </div>
  );
}
