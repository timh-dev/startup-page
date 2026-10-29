import React from "react";

import { useSettingsStore } from "@/features/settings/stores";
import { useLayoutEditStore } from "@/features/dashboard/stores/layoutEditStore";
import { useSidePanelStore } from "@/components/layout/sidePanelStore";
import { getWidgetType } from "@/features/dashboard/widgetRegistry";
import { generateId } from "@/features/bookmarks/lib/tree";
import { TILE_SIZE_OPTIONS, type TileSize, type WidgetInstance, type WidgetType } from "@/lib/dashboard-dimensions";
import DashboardTile from "@/features/dashboard/components/DashboardTile";
import EditBar from "@/features/dashboard/components/EditBar";
import { useRootFontSize } from "@/lib/use-root-font-size";
import {
  DEFAULT_COLUMNS,
  MAX_COLUMNS,
  MIN_COLUMNS,
  applyLayout,
  cellsFor,
  firstFreeSpot,
  nearestSize,
  placeTile,
  resolveLayout,
  rowCount,
  type Layout,
  type Placement,
} from "@/features/dashboard/layout/grid";
import { registerGalleryDrag } from "@/features/dashboard/layout/galleryDrag";

/** Width of the side panel plus its margin, in rem; the grid makes room for it. */
export const SIDE_PANEL_REM = 25;

function useViewport() {
  const [size, setSize] = React.useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  React.useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return size;
}

function newInstance(type: WidgetType): WidgetInstance {
  const def = getWidgetType(type);
  const instance: WidgetInstance = { id: generateId(), type, size: def.defaultSize, config: def.makeDefaultConfig() };
  if (type === "stack") instance.items = [];
  return instance;
}

type Drag =
  | { kind: "move"; id: string; size: { w: number; h: number }; offset: { x: number; y: number }; start: { x: number; y: number }; moved: boolean; el: HTMLElement; base: Layout; key: string }
  | { kind: "resize"; id: string; origin: Placement; allowed: TileSize[]; size: TileSize; base: Layout; key: string }
  | { kind: "new"; instance: WidgetInstance; size: { w: number; h: number }; start: { x: number; y: number }; moved: boolean; base: Layout; key: string; over: boolean };

const removeTarget = (event: React.PointerEvent | PointerEvent) =>
  (event.target as HTMLElement | null)?.closest?.("button, a, input, select, textarea, .tile-resize");

/**
 * The dashboard: cards placed freely on a grid that scales to the window.
 * In edit mode, drag a card anywhere (the cards it lands on move to the
 * nearest free spots, live), drag its corner to resize, ✕ to remove, click
 * to open its inspector. On narrow screens the grid falls back to a flowing
 * order in fewer columns.
 */
export default function Index() {
  const settings = useSettingsStore((state) => state.settings);
  const persistSettings = useSettingsStore((state) => state.persistSettings);
  const { editing, selectedId, select, pushHistory, popHistory, setEditing, setInsertAt } = useLayoutEditStore();
  const panel = useSidePanelStore((state) => state.panel);
  const openPanel = useSidePanelStore((state) => state.open);
  const closePanel = useSidePanelStore((state) => state.close);

  const ui = settings.ui || {};
  const rem = useRootFontSize();
  const viewport = useViewport();
  const gap = Math.round(rem * (ui.gridDensity === "compact" ? 1 : 1.5));
  const maxTile = Math.round((ui.tileSize || 9) * rem);
  const minTile = Math.round(maxTile * 0.75);
  const columns = Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, Number(settings.layout?.columns) || DEFAULT_COLUMNS));
  const widgets: WidgetInstance[] = React.useMemo(() => (Array.isArray(settings.widgets) ? settings.widgets : []), [settings.widgets]);
  const base = React.useMemo(() => resolveLayout(widgets, columns), [widgets, columns]);

  // Fit the grid to the space left beside the side panel.
  const panelOffset = panel ? SIDE_PANEL_REM * rem : 0;
  const pad = { top: 5 * rem, bottom: 1.5 * rem, side: 2 * rem };
  const availW = viewport.width - pad.side * 2 - panelOffset;
  const availH = viewport.height - pad.top - pad.bottom;
  const fill = 0.81;
  const rows = Math.max(1, rowCount(base));
  const widthFit = ((availW - (columns - 1) * gap) / columns) * fill;
  const heightFit = ((availH - (rows - 1) * gap) / rows) * fill;
  // With the panel open the grid may shrink further before giving up on
  // free placement, so opening an inspector never reflows the dashboard.
  const flow = widthFit < (panel ? minTile * 0.55 : minTile);
  let tile: number;
  let layout: Layout;
  let gridColumns = columns;
  if (flow) {
    gridColumns = Math.max(2, Math.min(columns, Math.floor((availW + gap) / (minTile + gap))));
    tile = Math.min((availW - (gridColumns - 1) * gap) / gridColumns, maxTile);
    const ordered = [...widgets].sort((a, b) => {
      const pa = base.get(a.id)!;
      const pb = base.get(b.id)!;
      return pa.y - pb.y || pa.x - pb.x;
    });
    layout = resolveLayout(ordered.map(({ pos: _pos, ...rest }) => rest), gridColumns);
  } else {
    tile = Math.max(Math.min(widthFit, heightFit, maxTile), Math.min(widthFit, minTile));
    layout = base;
  }
  tile = Math.floor(tile);
  const cell = tile + gap;
  // Centre the cards themselves; the extra drop row in edit mode hangs below
  // instead of shifting everything up.
  const contentHeight = Math.max(1, rowCount(layout)) * cell - gap;
  const topOffset = Math.max(pad.top, (viewport.height - contentHeight) / 2);

  const [preview, setPreviewState] = React.useState<Layout | null>(null);
  // Mirrored in a ref so the drop handler reads the latest preview.
  const previewRef = React.useRef<Layout | null>(null);
  const setPreview = (next: Layout | null) => {
    previewRef.current = next;
    setPreviewState(next);
  };
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [ghost, setGhost] = React.useState<{ instance: WidgetInstance; size: { w: number; h: number } } | null>(null);
  const ghostRef = React.useRef<HTMLDivElement>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<Drag | null>(null);
  const shown = preview ?? layout;
  const shownRows = Math.max(1, rowCount(shown)) + (editing && !flow ? 1 : 0);

  const radiusClass = ui.cardStyle === "soft" ? "rounded-[1.75rem]" : ui.cardStyle === "sharp" ? "rounded-[0.625rem]" : "rounded-[1.125rem]";
  // Two materials (src/assets/styles/design-system.css): an opaque card for
  // tiles with their own content, and a rimmed edge-to-edge frame for
  // imagery. Weather paints its own sky, so it only gets the frame.
  const cardClassFor = (type: string): string => {
    const tileClass = (extra = "") => `${radiusClass} h-full w-full surface-tile ${extra}`;
    const media = (extra = "") => `${radiusClass} h-full w-full surface-media ${extra}`;
    switch (type) {
      case "bookmark":
        return tileClass("overflow-y-auto");
      case "photo":
      case "video":
      case "weather":
      case "weatherV2":
      case "iframe":
        return media();
      case "solarGraph":
      case "globe":
        return media("bg-black");
      default:
        return tileClass("overflow-hidden");
    }
  };

  // Every change goes through here, so Undo can step back through it.
  const commit = React.useCallback(
    (next: WidgetInstance[]) => {
      pushHistory(widgets);
      void persistSettings((prev) => ({ ...prev, widgets: next }));
    },
    [persistSettings, pushHistory, widgets],
  );

  const undo = React.useCallback(() => {
    const previous = popHistory();
    if (previous) void persistSettings((prev) => ({ ...prev, widgets: previous }));
  }, [persistSettings, popHistory]);

  const removeWidget = React.useCallback(
    (id: string) => {
      commit(widgets.filter((widget) => widget.id !== id));
      if (useLayoutEditStore.getState().selectedId === id) {
        select(null);
        closePanel();
      }
    },
    [closePanel, commit, select, widgets],
  );

  const openInspector = React.useCallback(
    (id: string) => {
      select(id);
      openPanel({ kind: "widget", id });
    },
    [openPanel, select],
  );

  const toGrid = (clientX: number, clientY: number) => {
    const rect = gridRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top, inside: clientX >= rect.left - cell / 2 && clientX <= rect.right + cell / 2 && clientY >= rect.top - cell / 2 && clientY <= rect.bottom + cell };
  };

  // Adds a card: at a dropped spot, the clicked empty cell, or the first free one.
  const addWidget = React.useCallback(
    (instance: WidgetInstance, at: Layout | null) => {
      const cells = cellsFor(instance.size);
      let next = at;
      if (!next) {
        const insertAt = useLayoutEditStore.getState().insertAt;
        next = insertAt ? placeTile(base, instance.id, insertAt, cells, columns) : placeTile(base, instance.id, firstFreeSpot(base, cells, columns), cells, columns);
      }
      commit(applyLayout([...widgets, instance], next));
      setInsertAt(null);
      openInspector(instance.id);
    },
    [base, columns, commit, openInspector, setInsertAt, widgets],
  );

  // ---- pointer drags: move, resize, and new cards from the gallery ----
  const endDrag = React.useRef<() => void>(() => {});

  const onMove = React.useCallback(
    (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || !gridRef.current) return;
      if (drag.kind === "move") {
        if (!drag.moved && Math.hypot(event.clientX - drag.start.x, event.clientY - drag.start.y) < 5) return;
        if (!drag.moved) {
          drag.moved = true;
          setDraggingId(drag.id);
        }
        const g = toGrid(event.clientX, event.clientY);
        const left = g.x - drag.offset.x;
        const top = g.y - drag.offset.y;
        const from = drag.base.get(drag.id)!;
        drag.el.style.translate = `${left - from.x * cell}px ${top - from.y * cell}px`;
        const target = { x: Math.round(left / cell), y: Math.max(0, Math.round(top / cell)) };
        const key = `${target.x},${target.y}`;
        if (key !== drag.key) {
          drag.key = key;
          setPreview(placeTile(drag.base, drag.id, target, drag.size, columns));
        }
      } else if (drag.kind === "resize") {
        const g = toGrid(event.clientX, event.clientY);
        const w = Math.max(1, Math.min(3, Math.round((g.x - drag.origin.x * cell) / cell)));
        const h = Math.max(1, Math.min(2, Math.round((g.y - drag.origin.y * cell) / cell)));
        const size = nearestSize(w, h, drag.allowed);
        if (size !== drag.key) {
          drag.key = size;
          drag.size = size;
          setPreview(placeTile(drag.base, drag.id, drag.origin, cellsFor(size), columns));
        }
      } else {
        if (!drag.moved && Math.hypot(event.clientX - drag.start.x, event.clientY - drag.start.y) < 5) return;
        drag.moved = true;
        const w = drag.size.w * tile + (drag.size.w - 1) * gap;
        const h = drag.size.h * tile + (drag.size.h - 1) * gap;
        if (ghostRef.current) ghostRef.current.style.transform = `translate(${event.clientX - w / 2}px, ${event.clientY - h / 2}px)`;
        const g = toGrid(event.clientX, event.clientY);
        drag.over = g.inside;
        const target = { x: Math.round((g.x - w / 2) / cell), y: Math.max(0, Math.round((g.y - h / 2) / cell)) };
        const key = g.inside ? `${target.x},${target.y}` : "out";
        if (key !== drag.key) {
          drag.key = key;
          setPreview(g.inside ? placeTile(drag.base, drag.instance.id, target, drag.size, columns) : null);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cell, columns, gap, tile],
  );

  const onUp = React.useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", endDrag.current);
    window.removeEventListener("pointercancel", endDrag.current);
    const current = previewRef.current;
    setPreview(null);
    if (drag?.kind === "move") {
      drag.el.style.translate = "";
      if (drag.moved && current) commit(applyLayout(widgets, current));
      else if (!drag.moved) openInspector(drag.id);
    } else if (drag?.kind === "resize") {
      if (current && drag.size !== widgets.find((w) => w.id === drag.id)?.size) {
        commit(applyLayout(widgets.map((w) => (w.id === drag.id ? { ...w, size: drag.size } : w)), current));
      }
    } else if (drag?.kind === "new") {
      if (drag.over && current) addWidget(drag.instance, current);
      else if (!drag.moved) addWidget(drag.instance, null);
    }
    setDraggingId(null);
    setGhost(null);
  }, [addWidget, commit, onMove, openInspector, widgets]);
  endDrag.current = onUp;

  const listen = () => {
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", endDrag.current);
    window.addEventListener("pointercancel", endDrag.current);
  };

  const startMove = (id: string, event: React.PointerEvent<HTMLElement>) => {
    if (!editing || flow || event.button !== 0 || removeTarget(event)) {
      if (editing && flow && !removeTarget(event)) openInspector(id);
      return;
    }
    event.preventDefault();
    const from = base.get(id)!;
    const g = toGrid(event.clientX, event.clientY);
    dragRef.current = {
      kind: "move",
      id,
      size: { w: from.w, h: from.h },
      offset: { x: g.x - from.x * cell, y: g.y - from.y * cell },
      start: { x: event.clientX, y: event.clientY },
      moved: false,
      el: event.currentTarget,
      base,
      key: `${from.x},${from.y}`,
    };
    listen();
  };

  const startResize = (id: string, event: React.PointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const widget = widgets.find((w) => w.id === id);
    if (!widget) return;
    const def = getWidgetType(widget.type);
    dragRef.current = {
      kind: "resize",
      id,
      origin: base.get(id)!,
      allowed: def.allowedSizes ?? TILE_SIZE_OPTIONS.map((option) => option.key),
      size: widget.size,
      base,
      key: widget.size,
    };
    listen();
  };

  // The gallery (in the side panel) starts drags of new cards through here.
  React.useEffect(
    () =>
      registerGalleryDrag({
        drag: (type: WidgetType, event: PointerEvent) => {
          const instance = newInstance(type);
          const size = cellsFor(instance.size);
          dragRef.current = { kind: "new", instance, size, start: { x: event.clientX, y: event.clientY }, moved: false, base, key: "", over: false };
          setGhost({ instance, size });
          listen();
        },
        add: (type: WidgetType) => addWidget(newInstance(type), null),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, onMove, addWidget],
  );

  // Keyboard: arrows move the selected card, Delete removes it, ⌘Z undoes,
  // Esc closes the inspector, then leaves edit mode. E toggles edit mode.
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = !!target?.closest?.("input, textarea, select, [contenteditable='true']");
      // Esc still works from a field (e.g. the gallery's search box).
      if (typing && event.key === "Escape" && useLayoutEditStore.getState().editing) {
        (target as HTMLInputElement).blur?.();
        if (useSidePanelStore.getState().panel) closePanel();
        return;
      }
      if (typing) return;
      const meta = event.metaKey || event.ctrlKey;
      if (!meta && !event.altKey && (event.key === "e" || event.key === "E") && !event.shiftKey) {
        event.preventDefault();
        setEditing(!useLayoutEditStore.getState().editing);
        return;
      }
      if (!useLayoutEditStore.getState().editing) return;
      if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        if (useSidePanelStore.getState().panel) closePanel();
        else setEditing(false);
        select(null);
        return;
      }
      const id = useLayoutEditStore.getState().selectedId;
      if (!id || flow) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        removeWidget(id);
        return;
      }
      const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key as "ArrowLeft"];
      if (step) {
        event.preventDefault();
        const from = base.get(id)!;
        commit(applyLayout(widgets, placeTile(base, id, { x: from.x + step[0], y: from.y + step[1] }, from, columns)));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [base, closePanel, columns, commit, flow, removeWidget, select, setEditing, undo, widgets]);

  // Leaving edit mode closes a card's inspector or the gallery.
  React.useEffect(() => {
    if (!editing && panel && panel.kind !== "settings") closePanel();
  }, [editing, panel, closePanel]);

  // Empty cells in edit mode: click one to add a card there.
  const emptyCells: Array<{ x: number; y: number }> = [];
  if (editing && !flow) {
    const taken = new Set<string>();
    for (const p of shown.values()) for (let x = p.x; x < p.x + p.w; x++) for (let y = p.y; y < p.y + p.h; y++) taken.add(`${x},${y}`);
    for (let y = 0; y < shownRows; y++) for (let x = 0; x < gridColumns; x++) if (!taken.has(`${x},${y}`)) emptyCells.push({ x, y });
  }
  const dropTarget = draggingId ? preview?.get(draggingId) : ghost ? preview?.get(ghost.instance.id) : null;
  const span = (n: number) => n * tile + (n - 1) * gap;
  const insertAt = useLayoutEditStore((state) => state.insertAt);

  return (
    <div
      className="flex min-h-screen items-start justify-center"
      style={{
        paddingTop: topOffset,
        paddingBottom: editing ? 5 * rem : pad.bottom,
        paddingLeft: pad.side,
        paddingRight: pad.side + panelOffset,
        transition: "padding var(--duration-base) var(--ease-out)",
      }}
      onPointerDown={(event) => {
        if (editing && event.target === event.currentTarget) {
          select(null);
          if (panel?.kind === "widget") closePanel();
        }
      }}
    >
      {editing && <EditBar flow={flow} onUndo={undo} />}

      <div
        ref={gridRef}
        className="dashboard-grid relative"
        data-editing={editing || undefined}
        style={{ width: span(gridColumns), height: span(shownRows), transition: "height var(--duration-base) var(--ease-out)" }}
        onPointerDown={(event) => {
          if (editing && event.target === event.currentTarget) {
            select(null);
            if (panel?.kind === "widget") closePanel();
          }
        }}
      >
        {emptyCells.map(({ x, y }) => (
          <button
            key={`${x},${y}`}
            type="button"
            className={`grid-empty-cell ${radiusClass}`}
            data-active={insertAt?.x === x && insertAt?.y === y ? "true" : undefined}
            style={{ transform: `translate(${x * cell}px, ${y * cell}px)`, width: tile, height: tile }}
            onClick={() => {
              setInsertAt({ x, y });
              select(null);
              openPanel({ kind: "gallery" });
            }}
            aria-label={`Add a widget here (column ${x + 1}, row ${y + 1})`}
          />
        ))}

        {dropTarget && (
          <div
            className={`grid-drop-target ${radiusClass}`}
            style={{ transform: `translate(${dropTarget.x * cell}px, ${dropTarget.y * cell}px)`, width: span(dropTarget.w), height: span(dropTarget.h) }}
          />
        )}

        {widgets.map((instance, index) => {
          // The card being dragged stays anchored at its start; the pointer
          // offset rides on top (see onMove).
          const placement = (instance.id === draggingId ? base.get(instance.id) : shown.get(instance.id)) ?? layout.get(instance.id)!;
          return (
            <DashboardTile
              key={instance.id}
              index={index}
              instance={instance}
              placement={placement}
              cell={cell}
              tile={tile}
              gap={gap}
              editing={editing}
              selected={selectedId === instance.id}
              dragging={draggingId === instance.id}
              canResize={editing && !flow}
              radiusClass={radiusClass}
              cardClass={cardClassFor(instance.type)}
              onPointerDown={(event) => startMove(instance.id, event)}
              onResizeStart={(event) => startResize(instance.id, event)}
              onRemove={() => removeWidget(instance.id)}
            />
          );
        })}
      </div>

      {ghost && (
        <div
          ref={ghostRef}
          className={`grid-ghost surface-tile ${radiusClass}`}
          style={{ width: span(ghost.size.w), height: span(ghost.size.h) }}
          aria-hidden="true"
        >
          {React.createElement(getWidgetType(ghost.instance.type).icon, { className: "size-5" })}
          <span>{getWidgetType(ghost.instance.type).label}</span>
        </div>
      )}
    </div>
  );
}
