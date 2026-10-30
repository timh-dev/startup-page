// Whether an element is on screen: inside the viewport (through any scrolling
// ancestors, such as the dashboard's vertical pager) and in a visible tab.
// Animated cards check it each frame and skip drawing when it's false, so
// cards on other pages, or scrolled away, cost nothing. One shared observer.

const visible = new WeakMap<Element, boolean>();
const listeners = new Map<Element, (onScreen: boolean) => void>();
let observer: IntersectionObserver | null = null;

function getObserver() {
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visible.set(entry.target, entry.isIntersecting);
          listeners.get(entry.target)?.(entry.isIntersecting);
        }
      },
      // A little early, so an animation is already running as it scrolls in.
      { rootMargin: "96px" },
    );
  }
  return observer;
}

export function isOnScreen(el: Element): boolean {
  if (typeof document !== "undefined" && document.hidden) return false;
  if (typeof IntersectionObserver === "undefined") return true;
  if (!visible.has(el)) {
    // Assume visible until the first report, so nothing waits to appear.
    visible.set(el, true);
    getObserver().observe(el);
  }
  return visible.get(el) ?? true;
}

/** Stop watching (when the element unmounts). */
export function forgetOnScreen(el: Element) {
  observer?.unobserve(el);
  visible.delete(el);
  listeners.delete(el);
}

/** Calls `onChange` when the element comes on or goes off screen. Returns a stop function. */
export function watchOnScreen(el: Element, onChange: (onScreen: boolean) => void): () => void {
  if (typeof IntersectionObserver === "undefined") return () => {};
  listeners.set(el, onChange);
  visible.set(el, true);
  getObserver().observe(el);
  return () => forgetOnScreen(el);
}
