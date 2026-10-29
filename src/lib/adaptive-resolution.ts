// Resolution for the animated canvases (clouds, aurora, solar chart). They
// render above the screen's pixel density and are scaled down by the
// browser (supersampling), which smooths edges and gradients beyond what
// the screen alone can show, and step down if the browser can't keep up:
// when the gap between animation frames stays well above a 60 Hz frame, the
// GPU is the bottleneck and a smaller canvas is the cheapest fix.
//
// Supersampling is capped at 2× the screen density (4 canvas pixels per CSS
// pixel on a Retina screen): browsers scale canvases down with bilinear
// filtering, which only averages neighbouring pixels, so rendering more
// than twice the output resolution costs GPU time without looking smoother.
// On battery it renders at the screen's own density (see power.ts).

import { isOnBattery } from "./power";

const SAMPLE_FRAMES = 45;
const SLOW_FRAME_MS = 24;
const STEP = 0.5;

export interface AdaptiveResolution {
  /** Canvas pixels per CSS pixel to render at right now. */
  readonly scale: number;
  /** Call once per animation frame; returns true when the scale changed (resize the canvas). */
  sample(now: number): boolean;
}

export function createAdaptiveResolution({ supersample = 1, max = 2, min = 1 } = {}): AdaptiveResolution {
  // Supersampling is skipped on battery; the scale follows when power changes.
  const ideal = () => Math.max(min, Math.min((window.devicePixelRatio || 1) * (isOnBattery() ? 1 : supersample), max));
  let reduction = 0;
  const current = () => Math.max(min, ideal() - reduction);
  let reported = current();
  let last = 0;
  let total = 0;
  let count = 0;

  return {
    get scale() {
      return current();
    },
    sample(now: number) {
      // A change in power source changes the target scale.
      if (current() !== reported) {
        reported = current();
        return true;
      }
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
      if (average > SLOW_FRAME_MS && current() > min) {
        reduction += STEP;
        reported = current();
        return true;
      }
      return false;
    },
  };
}
