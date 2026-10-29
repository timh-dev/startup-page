import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * How many equal-height rows of `list` fit inside `container` without
 * cutting the last one off. Measures the first row, so rows must share a
 * height. Returns `total` until it has measured.
 */
export function useFitCount(container: RefObject<HTMLElement | null>, list: RefObject<HTMLElement | null>, total: number) {
  const [fit, setFit] = useState(total);

  useLayoutEffect(() => {
    const box = container.current;
    const rows = list.current;
    if (!box || !rows) return undefined;

    const measure = () => {
      const first = rows.firstElementChild as HTMLElement | null;
      if (!first) return setFit(total);
      const style = getComputedStyle(box);
      const available = box.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const gap = parseFloat(getComputedStyle(rows).rowGap) || 0;
      const row = first.getBoundingClientRect().height;
      if (!row) return setFit(total);
      setFit(Math.max(1, Math.min(total, Math.floor((available + gap) / (row + gap)))));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [container, list, total]);

  return fit;
}
