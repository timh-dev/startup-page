// Resolution for the animated WebGL scenes (clouds, aurora). They start at
// the screen's pixel density, so they're sharp on high-density displays, and
// step down if the browser can't keep up: when the gap between animation
// frames stays well above a 60 Hz frame, the GPU is the bottleneck and a
// smaller canvas is the cheapest fix.

const SAMPLE_FRAMES = 45;
const SLOW_FRAME_MS = 24;
const STEP = 0.5;

export interface AdaptiveResolution {
  /** Canvas pixels per CSS pixel to render at right now. */
  readonly scale: number;
  /** Call once per animation frame; returns true when the scale dropped (resize the canvas). */
  sample(now: number): boolean;
}

export function createAdaptiveResolution(max = 2, min = 1): AdaptiveResolution {
  let scale = Math.max(min, Math.min(window.devicePixelRatio || 1, max));
  let last = 0;
  let total = 0;
  let count = 0;

  return {
    get scale() {
      return scale;
    },
    sample(now: number) {
      const gap = last ? now - last : 0;
      last = now;
      // Ignore gaps from a hidden or backgrounded tab.
      if (!gap || gap > 250) return false;
      total += gap;
      count += 1;
      if (count < SAMPLE_FRAMES) return false;
      const average = total / count;
      total = 0;
      count = 0;
      if (average > SLOW_FRAME_MS && scale > min) {
        scale = Math.max(min, scale - STEP);
        return true;
      }
      return false;
    },
  };
}
