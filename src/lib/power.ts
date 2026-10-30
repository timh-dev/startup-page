// Power and motion preferences the animated canvases follow.
//
// - On battery (where the browser reports it — Chrome and Edge; Safari and
//   Firefox don't expose battery state, so they're treated as plugged in),
//   canvases render at the screen's own density instead of supersampling.
// - With "reduce motion" on, ambient scenes update about once a second
//   instead of animating.

type Listener = () => void;

interface BatteryManagerLike extends EventTarget {
  charging: boolean;
}

let onBattery = false;
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener();
}

const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { getBattery?: () => Promise<BatteryManagerLike> }) : null;
nav?.getBattery?.()
  .then((battery) => {
    const update = () => {
      const next = !battery.charging;
      if (next !== onBattery) {
        onBattery = next;
        notify();
      }
    };
    update();
    battery.addEventListener("chargingchange", update);
  })
  .catch(() => {});

const motionQuery = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
motionQuery?.addEventListener?.("change", notify);

export function isOnBattery() {
  return onBattery;
}

export function prefersReducedMotion() {
  return !!motionQuery?.matches;
}

/** Called when battery or motion preference changes; returns an unsubscribe. */
export function onPowerChange(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The frame interval for an ambient animation: its own cadence, or ~1 fps with reduced motion. */
export function ambientFrameMs(baseMs: number) {
  return prefersReducedMotion() ? 1000 : baseMs;
}
