/*eslint-disable*/
import React from "react";
import { HiOutlineArrowsPointingOut, HiOutlineCog6Tooth, HiOutlinePlus, HiOutlineXMark } from "react-icons/hi2";

import { useSettingsStore } from "@/features/settings/stores";
import { useLayoutEditStore } from "@/features/dashboard/stores/layoutEditStore";
import { useWidgetConfigDialogStore } from "@/features/dashboard/stores/widgetConfigDialogStore";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_WIDGETS,
  TILE_SIZE_SPANS,
  cloneWidgets,
  resolveBookmarkPlaceholders,
  type WidgetInstance,
} from "@/lib/dashboard-dimensions";
import { getWidgetType } from "@/features/dashboard/widgetRegistry";

export default function Index() {
  const settings = useSettingsStore((state) => state.settings);
  const persistSettings = useSettingsStore((state) => state.persistSettings);
  const editing = useLayoutEditStore((state) => state.editing);
  const setEditing = useLayoutEditStore((state) => state.setEditing);
  const openWidgetEdit = useWidgetConfigDialogStore((state) => state.openEdit);
  const openWidgetNew = useWidgetConfigDialogStore((state) => state.openNew);
  // Ref drives the reorder logic (immune to render timing across the multi-tick
  // drag sequence); state is only for the "being dragged" visual treatment.
  const dragIdRef = React.useRef<string | null>(null);
  const [dragId, setDragId] = React.useState<string | null>(null);

  const ui = settings.ui || {};
  const gapClass = ui.gridDensity === "compact" ? "gap-y-4 gap-x-4" : "gap-y-6 gap-x-6";
  const decorativeGap = ui.gridDensity === "compact" ? 16 : 24;
  const tilePx = (ui.tileSize || 9) * 16;
  const minWidthFor = (n: number) => n * tilePx + (n - 1) * decorativeGap + 32;
  const gridCss = `
    .dashboard-grid,
    .bookmark-page-grid {
      --dashboard-tile-max: ${tilePx}px;
      --dashboard-gap: ${decorativeGap}px;
      --dashboard-inline-padding: 2rem;
      --dashboard-tile: clamp(88px, calc((100vw - var(--dashboard-inline-padding) - var(--dashboard-gap)) / 2), var(--dashboard-tile-max));
      grid-template-columns: repeat(2, minmax(0, var(--dashboard-tile)));
      grid-auto-rows: var(--dashboard-tile);
    }
    .dashboard-grid .grid-feature-responsive {
      grid-column: span 2 / span 2;
    }
    @media (min-width: ${minWidthFor(3)}px) {
      .dashboard-grid,
      .bookmark-page-grid {
        --dashboard-tile: clamp(88px, calc((100vw - var(--dashboard-inline-padding) - ${decorativeGap * 2}px) / 3), var(--dashboard-tile-max));
        grid-template-columns: repeat(3, minmax(0, var(--dashboard-tile)));
      }
      .dashboard-grid .grid-feature-responsive {
        grid-column: span 3 / span 3;
      }
    }
    @media (min-width: ${minWidthFor(5)}px) {
      .dashboard-grid,
      .bookmark-page-grid {
        --dashboard-tile: clamp(88px, calc((100vw - var(--dashboard-inline-padding) - ${decorativeGap * 4}px) / 5), var(--dashboard-tile-max));
        grid-template-columns: repeat(5, minmax(0, var(--dashboard-tile)));
      }
    }
    @media (min-width: ${minWidthFor(7)}px) {
      .dashboard-grid,
      .bookmark-page-grid {
        --dashboard-tile: clamp(88px, calc((100vw - var(--dashboard-inline-padding) - ${decorativeGap * 6}px) / 7), var(--dashboard-tile-max));
        grid-template-columns: repeat(7, minmax(0, var(--dashboard-tile)));
      }
    }
  `;
  const radiusClass =
    ui.cardStyle === "soft"
      ? "rounded-[2rem]"
      : ui.cardStyle === "sharp"
        ? "rounded-md"
        : "rounded-xl";

  const panel = (extra = "") => `${radiusClass} ${extra}`;
  const surface = "bg-card text-card-foreground border border-border/60 shadow-lg";
  const mutedSurface = "bg-muted/50 text-foreground border border-border/60 shadow-lg";
  const strongSurface = "bg-primary text-primary-foreground border border-border/40 shadow-lg";

  // Per-type outer chrome. "weather" stays transparent (it paints its own sky
  // gradient); bookmark/photo forward the full class straight into the
  // wrapped component's own `cardClass` prop instead of double-wrapping.
  const cardClassFor = (type: string): string => {
    switch (type) {
      case "search":
        return panel(`h-full w-full ${strongSurface}`);
      case "weather":
        return panel("h-full w-full overflow-hidden");
      case "bookmark":
        return panel(`h-full w-full overflow-y-auto ${strongSurface}`);
      case "photo":
        return panel(`relative overflow-hidden h-full w-full bg-center bg-no-repeat ${surface}`);
      case "vault":
        return panel(`h-full w-full overflow-hidden ${strongSurface}`);
      case "solarGraph":
        return panel("h-full w-full bg-black border border-border/60 shadow-lg");
      case "video":
        return panel(`h-full w-full overflow-hidden ${surface}`);
      case "stack":
        return panel(`h-full w-full overflow-visible ${surface}`);
      case "clock":
        return panel(`h-full w-full ${mutedSurface}`);
      default:
        return panel(`h-full w-full overflow-hidden ${surface}`);
    }
  };

  const widgets: WidgetInstance[] = React.useMemo(
    () => (Array.isArray(settings.widgets) ? settings.widgets : []),
    [settings.widgets],
  );

  const persistWidgets = (updater: (widgets: WidgetInstance[]) => WidgetInstance[]) => {
    void persistSettings((prev: any) => {
      const prevWidgets: WidgetInstance[] = Array.isArray(prev.widgets) ? prev.widgets : [];
      return { ...prev, widgets: updater(prevWidgets) };
    });
  };

  const moveWidget = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    persistWidgets((prevWidgets) => {
      const next = prevWidgets.filter((widget) => widget.id !== fromId);
      const moving = prevWidgets.find((widget) => widget.id === fromId);
      if (!moving) return prevWidgets;
      const targetIndex = next.findIndex((widget) => widget.id === toId);
      next.splice(targetIndex < 0 ? next.length : targetIndex, 0, moving);
      return next;
    });
  };

  const removeWidget = (id: string) => {
    persistWidgets((prevWidgets) => prevWidgets.filter((widget) => widget.id !== id));
  };

  const resetLayout = () => {
    const bookmarkGroups = Array.isArray(settings.bookmark) ? settings.bookmark : [];
    persistWidgets(() => resolveBookmarkPlaceholders(cloneWidgets(DEFAULT_WIDGETS), bookmarkGroups));
  };

  const handleDragStart = (event: React.DragEvent, id: string) => {
    dragIdRef.current = id;
    setDragId(id);
    event.dataTransfer.effectAllowed = "move";
    try {
      event.dataTransfer.setData("text/plain", id);
    } catch (_error) {
      /* some browsers restrict setData during dragstart */
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    if (!dragIdRef.current) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (event: React.DragEvent, id: string) => {
    event.preventDefault();
    const fromId = dragIdRef.current;
    if (fromId) moveWidget(fromId, id);
    dragIdRef.current = null;
    setDragId(null);
  };

  const handleDragEnd = () => {
    dragIdRef.current = null;
    setDragId(null);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 pb-10 pt-28">
      <style>{gridCss}</style>

      {editing && (
        <div className="fixed inset-x-0 top-16 z-40 flex justify-center px-4">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-2xl border border-border/60 bg-background/95 px-4 py-2 text-xs shadow-lg backdrop-blur">
            <span className="font-medium text-foreground">Editing layout</span>
            <span className="hidden text-muted-foreground sm:inline">
              Drag the handle to move · gear icon to configure a widget · × removes it
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={resetLayout}>
                Reset layout
              </Button>
              <Button type="button" size="sm" onClick={() => setEditing(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      <div
        className={`dashboard-grid grid w-fit ${gapClass} grid-flow-row-dense content-center justify-center`}
      >
        {widgets.map((instance) => {
          const def = getWidgetType(instance.type);
          const spanClass = TILE_SIZE_SPANS[instance.size] || TILE_SIZE_SPANS.small;
          const isDragging = dragId === instance.id;

          return (
            <div
              key={instance.id}
              data-tile-id={instance.id}
              className={`${spanClass} min-h-0 min-w-0 relative ${
                editing
                  ? `${radiusClass} ring-2 ${isDragging ? "ring-primary opacity-60" : "ring-primary/40"}`
                  : ""
              }`}
              onDragOver={editing ? handleDragOver : undefined}
              onDrop={editing ? (event) => handleDrop(event, instance.id) : undefined}
            >
              <div className={editing ? "pointer-events-none h-full w-full select-none" : "h-full w-full"}>
                <def.Render instance={instance} cardClass={cardClassFor(instance.type)} />
              </div>

              {editing && (
                <div className="pointer-events-auto absolute left-1 top-1 z-30 flex items-center gap-1 rounded-lg border border-border/60 bg-background/95 px-1 py-1 shadow-lg backdrop-blur-sm">
                  <button
                    type="button"
                    draggable
                    onDragStart={(event) => handleDragStart(event, instance.id)}
                    onDragEnd={handleDragEnd}
                    className="flex size-6 cursor-grab items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-accent-foreground active:cursor-grabbing"
                    aria-label="Drag to move tile"
                    title="Drag to move"
                  >
                    <HiOutlineArrowsPointingOut className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openWidgetEdit(instance.id)}
                    className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
                    aria-label="Configure widget"
                    title={`Configure (${def.label})`}
                  >
                    <HiOutlineCog6Tooth className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeWidget(instance.id)}
                    className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive/15 hover:text-destructive"
                    aria-label="Remove widget"
                    title="Remove"
                  >
                    <HiOutlineXMark className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {editing && (
          <button
            type="button"
            onClick={openWidgetNew}
            className={`col-span-1 row-span-1 flex min-h-0 min-w-0 items-center justify-center gap-1.5 ${radiusClass} border-2 border-dashed border-border/60 text-muted-foreground transition hover:border-primary/50 hover:text-foreground`}
          >
            <HiOutlinePlus className="size-4" />
            <span className="text-xs font-medium">Add widget</span>
          </button>
        )}
      </div>
    </div>
  );
}
