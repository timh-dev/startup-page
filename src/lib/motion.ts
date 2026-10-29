// One clock for every animated card, so a single speed setting (in the
// debugger) slows, speeds up or pauses all of them together, and the day
// replay (midnight → now on load) plays in sync across the solar chart, the
// globe and the weather sky.
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { debugNow, debugTimeZone, fromWallClock, wallClock } from "./debug";
import { prefersReducedMotion } from "./power";

export const SPEEDS = [0, 0.25, 0.5, 1, 2, 4] as const;

interface MotionState {
  /** 1 = normal; 0 = paused. */
  speed: number;
  setSpeed: (speed: number) => void;
}

export const useMotionStore = create<MotionState>()(
  persist(
    (set) => ({
      speed: 1,
      setSpeed: (speed) => {
        motionTime(); // bank the time at the old speed first
        set({ speed });
      },
    }),
    { name: "startup-page.motion" },
  ),
);

let banked = 0;
let last = typeof performance !== "undefined" ? performance.now() : 0;

/** Seconds of animation time: real time scaled by the speed (frozen when paused). */
export function motionTime(): number {
  const now = performance.now();
  banked += ((now - last) / 1000) * useMotionStore.getState().speed;
  last = now;
  return banked;
}

// ---- the day replay -------------------------------------------------------

/** Seconds of animation time to replay a whole day (scaled by how much of it has passed). */
const FULL_DAY_SECONDS = 9;
const MIN_SECONDS = 2.5;

const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

let replay: { start: number; from: number; to: number; duration: number } | null = null;
let replayed = false;
const listeners = new Set<() => void>();

/** Starts (or restarts) the replay from local midnight to now. */
export function startReplay() {
  replayed = true;
  if (prefersReducedMotion()) {
    replay = null;
    return;
  }
  const to = debugNow();
  const timeZone = debugTimeZone();
  const { year, month, day } = wallClock(to, timeZone);
  const from = fromWallClock(year, month, day, 0, 0, timeZone);
  const fraction = Math.min(1, Math.max(0, (to.getTime() - from.getTime()) / 86_400_000));
  replay = { start: motionTime(), from: from.getTime(), to: to.getTime(), duration: Math.max(MIN_SECONDS, FULL_DAY_SECONDS * fraction) };
  for (const listener of listeners) listener();
}

/**
 * The moment the cards should show while the day replays, or null once it
 * has reached now. The first card to ask starts it, so every card sees the
 * same replay from the beginning.
 */
export function replayNow(): Date | null {
  if (!replayed) startReplay();
  if (!replay) return null;
  const progress = Math.min(1, (motionTime() - replay.start) / replay.duration);
  if (progress >= 1) {
    replay = null;
    for (const listener of listeners) listener();
    return null;
  }
  return new Date(replay.from + (replay.to - replay.from) * easeInOutCubic(progress));
}

export function isReplaying() {
  return replay !== null;
}

/** Called when a replay starts or finishes. */
export function onReplayChange(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
