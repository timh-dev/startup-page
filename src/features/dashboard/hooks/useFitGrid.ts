import React from "react";

// Tried from fewest to most columns; more columns are only used when they
// give noticeably larger tiles, since each extra column tends to leave a
// ragged last row.
const COLUMN_OPTIONS = [2, 3, 5, 7, 9];
const MEANINGFULLY_LARGER = 1.04;

interface FitGridOptions {
  /** Largest tile size in px (the Tile size setting, in rem). */
  maxTile: number;
  /** Smallest tile a column count may shrink to before it's ruled out. */
  minTile: number;
  /** Gap between tiles in px. */
  gap: number;
  /** Space reserved around the grid, in px. */
  padding: { top: number; bottom: number; side: number };
  /** Changes whenever the set or shapes of tiles change, to re-measure. */
  layoutKey: string;
}

/**
 * Sizes the dashboard grid to fill the window: for each candidate column
 * count it lays the tiles out, reads how many rows they actually pack into,
 * and keeps the count that gives the largest tile while fitting both the
 * width and the height. On windows too small to fit everything, it falls
 * back to filling the width and scrolling.
 *
 * Applied directly to the element (not through React) because measuring
 * means trying layouts before paint.
 */
export function useFitGrid(gridRef: React.RefObject<HTMLDivElement | null>, { maxTile, minTile, gap, padding, layoutKey }: FitGridOptions) {
  const [viewport, setViewport] = React.useState(() => ({ width: window.innerWidth, height: window.innerHeight }));

  React.useEffect(() => {
    const update = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  React.useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const apply = (columns: number, tile: number) => {
      const size = Math.floor(tile);
      grid.style.gridTemplateColumns = `repeat(${columns}, ${size}px)`;
      grid.style.gridAutoRows = `${size}px`;
      // Feature tiles span 3 columns wherever there are at least 3.
      grid.dataset.wide = columns >= 3 ? "true" : "false";
    };

    const availableWidth = viewport.width - 2 * padding.side;
    const availableHeight = viewport.height - padding.top - padding.bottom;
    let best: { columns: number; tile: number } | null = null;
    let widest: { columns: number; tile: number } | null = null;

    for (const columns of COLUMN_OPTIONS) {
      const widthFit = (availableWidth - (columns - 1) * gap) / columns;
      if (widthFit < minTile && columns > 2) continue;
      widest = { columns, tile: Math.min(widthFit, maxTile) };

      apply(columns, Math.min(widthFit, maxTile));
      const rows = getComputedStyle(grid).gridTemplateRows.split(" ").filter(Boolean).length || 1;
      const heightFit = (availableHeight - (rows - 1) * gap) / rows;
      const tile = Math.min(widthFit, heightFit, maxTile);
      if (tile >= minTile * 0.75 && (!best || tile > best.tile * MEANINGFULLY_LARGER)) {
        best = { columns, tile };
      }
    }

    const choice = best ?? widest ?? { columns: 2, tile: minTile };
    apply(choice.columns, choice.tile);
  }, [gridRef, viewport, maxTile, minTile, gap, padding.top, padding.bottom, padding.side, layoutKey]);
}
