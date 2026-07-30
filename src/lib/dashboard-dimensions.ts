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
  | "bookmark"
  | "photo"
  | "vault"
  | "solarGraph"
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
}

// The dashboard a brand-new user (or a reset) sees. Ids are stable literals
// (not generated) so this stays a deterministic, diffable seed.
export const DEFAULT_WIDGETS: WidgetInstance[] = [
  { id: "default-videoTall", type: "video", size: "tall", config: { url: "", zoom: 1.6, offsetX: 0, offsetY: 0 } },
  { id: "default-videoSmall", type: "video", size: "small", config: { url: "", zoom: 1.6, offsetX: 0, offsetY: 0 } },
  { id: "default-search", type: "search", size: "wide", config: {} },
  { id: "default-bookmark1", type: "bookmark", size: "small", config: { groupId: null } },
  { id: "default-weather", type: "weather", size: "wide", config: { variant: "compact" } },
  { id: "default-unsplash2", type: "photo", size: "small", config: { searchTerms: [] } },
  { id: "default-bookmark2", type: "bookmark", size: "small", config: { groupId: null } },
  {
    id: "default-stack",
    type: "stack",
    size: "feature",
    config: {},
    items: [
      { id: "default-stack-windy", type: "iframe", size: "small", config: { preset: "windy", url: "" } },
      { id: "default-stack-weather", type: "weather", size: "small", config: { variant: "detail" } },
      { id: "default-stack-headlines", type: "headlines", size: "small", config: {} },
      { id: "default-stack-airQuality", type: "airQuality", size: "small", config: {} },
      { id: "default-stack-timer", type: "timer", size: "small", config: {} },
      { id: "default-stack-wikipedia", type: "wikipedia", size: "small", config: {} },
      { id: "default-stack-rss", type: "rss", size: "small", config: { feedUrl: null } },
      { id: "default-stack-github", type: "github", size: "small", config: { username: null } },
      { id: "default-stack-spotify", type: "spotify", size: "small", config: { clientId: null } },
      { id: "default-stack-unsplash6", type: "photo", size: "small", config: { searchTerms: [] } },
    ],
  },
  { id: "default-unsplash3", type: "photo", size: "small", config: { searchTerms: [] } },
  { id: "default-bookmark3", type: "bookmark", size: "small", config: { groupId: null } },
  { id: "default-solarGraph", type: "solarGraph", size: "large", config: {} },
  { id: "default-bookmark4", type: "bookmark", size: "small", config: { groupId: null } },
  { id: "default-bookmark5", type: "bookmark", size: "small", config: { groupId: null } },
  { id: "default-unsplash4", type: "photo", size: "small", config: { searchTerms: [] } },
  { id: "default-unsplash5", type: "photo", size: "small", config: { searchTerms: [] } },
  { id: "default-vaultPreview", type: "vault", size: "small", config: {} },
  { id: "default-clock", type: "clock", size: "small", config: {} },
];

export function cloneWidgets(widgets: WidgetInstance[]): WidgetInstance[] {
  if (typeof structuredClone === "function") return structuredClone(widgets);
  return JSON.parse(JSON.stringify(widgets));
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

// Walks a widget list (including one level into stacks) and assigns each
// bookmark widget with a null `groupId` the Nth bookmark group, in order —
// used when materializing DEFAULT_WIDGETS (its bookmark ids can't be known
// ahead of time since bookmark group ids are generated per-install).
export function resolveBookmarkPlaceholders(
  widgets: WidgetInstance[],
  bookmarkGroups: { id: string }[],
): WidgetInstance[] {
  let nextIndex = 0;
  const resolveOne = (widget: WidgetInstance): WidgetInstance => {
    if (widget.type === "bookmark" && !widget.config.groupId) {
      const groupId = bookmarkGroups[nextIndex]?.id ?? bookmarkGroups[0]?.id ?? null;
      nextIndex += 1;
      return { ...widget, config: { ...widget.config, groupId } };
    }
    if (widget.type === "stack" && widget.items) {
      return { ...widget, items: widget.items.map(resolveOne) };
    }
    return widget;
  };
  return widgets.map(resolveOne);
}
