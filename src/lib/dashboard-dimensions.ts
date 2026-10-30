// User-selectable tile sizes for the editable dashboard grid. "feature" reuses
// the responsive helper so a 3-wide tile clamps to the column count instead of
// overflowing the grid on narrow viewports.
export type TileSize = "small" | "wide" | "tall" | "large" | "feature";

export const TILE_SIZE_SPANS: Record<TileSize, string> = {
  small: "col-span-1 row-span-1",
  wide: "col-span-2 row-span-1",
  tall: "col-span-1 row-span-2",
  large: "col-span-2 row-span-2",
  feature: "grid-feature-responsive row-span-2",
};

export const TILE_SIZE_OPTIONS: { key: TileSize; label: string; title: string }[] = [
  { key: "small", label: "1×1", title: "Small" },
  { key: "wide", label: "2×1", title: "Wide" },
  { key: "tall", label: "1×2", title: "Tall" },
  { key: "large", label: "2×2", title: "Large" },
  { key: "feature", label: "3×2", title: "Feature" },
];

// Every kind of tile the grid can render. "stack" is special: it holds child
// widget instances (in `items`) instead of a `config`, and swipes between them.
export type WidgetType =
  | "clock"
  | "search"
  | "weather"
  | "weatherV2"
  | "bookmark"
  | "photo"
  | "vault"
  | "solarGraph"
  | "globe"
  | "video"
  | "iframe"
  | "stack"
  | "headlines"
  | "timer"
  | "wikipedia"
  | "rss"
  | "github"
  | "spotify"
  | "airQuality";

export interface WidgetInstance {
  id: string;
  type: WidgetType;
  size: TileSize;
  config: Record<string, unknown>;
  /** Only present when type === "stack" — one level deep, no nested stacks. */
  items?: WidgetInstance[];
  /**
   * Top-left cell on the dashboard grid. Missing for cards saved before free
   * placement (and inside stacks); those fill the first free spots.
   */
  pos?: { x: number; y: number };
}

// Patches a single widget's config by id, wherever it lives — top-level or
// nested one level into a stack's items. Used by widgets that persist their
// own settings from inside their own UI (e.g. the timer remembering a custom
// duration) rather than through the WidgetConfigDialog.
export function updateWidgetConfig(
  widgets: WidgetInstance[],
  id: string,
  patch: Record<string, unknown>,
): WidgetInstance[] {
  return widgets.map((widget) => {
    if (widget.id === id) {
      return { ...widget, config: { ...widget.config, ...patch } };
    }
    if (widget.type === "stack" && widget.items) {
      return { ...widget, items: updateWidgetConfig(widget.items, id, patch) };
    }
    return widget;
  });
}
