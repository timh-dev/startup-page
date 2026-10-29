import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { HiLink } from "react-icons/hi2";

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
  PAGE_ROWS,
  applyLayout,
  cellsFor,
  firstFreeSpot,
  nearestSize,
  pageCount,
  pageOf,
  placeGroup,
  placeTile,
  resolveLayout,
  rowCount,
  type Layout,
  type Placement,
} from "@/features/dashboard/layout/grid";
import {
  activeSeams,
  adjacentSeams,
  bridgeRect,
  groupOutline,
  groupsOf,
  joinKey,
  rectOf,
  roundedRects,
  seamPx,
  type Join,
  type JoinMode,
  type Metrics,
  type Rect,
  type SeamPx,
} from "@/features/dashboard/layout/joins";
import { registerGalleryDrag } from "@/features/dashboard/layout/galleryDrag";
import { edgeColors, type Side } from "@/features/dashboard/layout/edgeColor";

/** Linked cards of these kinds become one: a single video or photo across the group. */
const MERGEABLE = new Set<WidgetType>(["video", "photo"]);

/** Points sampled along each seam: the gap's colour follows each card's edge. */
const SEAM_SAMPLES = 8;

const ResourceVaultPage = React.lazy(() => import("@/pages/ResourceVaultPage"));
const BookmarksPage = React.lazy(() => import("@/pages/BookmarksPage"));

type SpecialPage = "vault" | "bookmarks";
const SPECIAL_PATHS: Record<SpecialPage, string> = { vault: "/resources", bookmarks: "/bookmarks" };
const SPECIAL_LABELS: Record<SpecialPage, string> = { vault: "Vault", bookmarks: "Bookmarks" };

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

/** The lead card's widget, drawn once across a merged group. */
const MergedContent = React.memo(function MergedContent({ instance, size }: { instance: WidgetInstance; size: string }) {
  const def = getWidgetType(instance.type);
  // Re-mount when the group's size changes, so photos refetch at the new size.
  return <def.Render key={size} instance={instance} cardClass="h-full w-full relative overflow-hidden" />;
});

function newInstance(type: WidgetType): WidgetInstance {
  const def = getWidgetType(type);
  const instance: WidgetInstance = { id: generateId(), type, size: def.defaultSize, config: def.makeDefaultConfig() };
  if (type === "stack") instance.items = [];
  return instance;
}

type Drag =
  | { kind: "move"; id: string; members: Placement[]; g0: { x: number; y: number }; start: { x: number; y: number }; moved: boolean; base: Layout; key: string }
  | { kind: "resize"; id: string; origin: Placement; allowed: TileSize[]; size: TileSize; base: Layout; key: string }
  | { kind: "new"; instance: WidgetInstance; size: { w: number; h: number }; start: { x: number; y: number }; moved: boolean; base: Layout; key: string; over: boolean };

const isControl = (event: React.PointerEvent | PointerEvent) =>
  (event.target as HTMLElement | null)?.closest?.("button, a, input, select, textarea, .tile-resize");

const svgMask = (d: string, box: Rect) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${box.x} ${box.y} ${box.w} ${box.h}' width='${box.w}' height='${box.h}' preserveAspectRatio='none'><path d='${d}' fill='black'/></svg>`,
  )}")`;

/**
 * The dashboard: cards placed freely on pages of 4 rows that snap as you
 * scroll. In edit mode, drag a card (or a joined group) anywhere, drag a
 * corner to resize, click the node between two touching cards to join them
 * into one shape, ✕ to remove, click to open the inspector. On narrow
 * screens it falls back to one flowing column of fewer columns.
 */
export default function Index() {
  const settings = useSettingsStore((state) => state.settings);
  const persistSettings = useSettingsStore((state) => state.persistSettings);
  const { editing, selectedId, select, pushHistory, popHistory, setEditing, setInsertAt } = useLayoutEditStore();
  const insertAt = useLayoutEditStore((state) => state.insertAt);
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
  const joins: Join[] = React.useMemo(() => (Array.isArray(settings.layout?.joins) ? settings.layout.joins : []), [settings.layout?.joins]);
  const base = React.useMemo(() => resolveLayout(widgets, columns), [widgets, columns]);

  // Fit a page (4 rows) to the space left beside the side panel.
  const panelOffset = panel ? SIDE_PANEL_REM * rem : 0;
  const pad = { top: 5 * rem, bottom: 1.5 * rem, side: 2 * rem };
  const availW = viewport.width - pad.side * 2 - panelOffset;
  const availH = viewport.height - pad.top - pad.bottom;
  const fill = 0.81;
  const widthFit = ((availW - (columns - 1) * gap) / columns) * fill;
  const heightFit = ((availH - (PAGE_ROWS - 1) * gap) / PAGE_ROWS) * fill;
  // With the panel open the grid may shrink further before giving up on
  // pages, so opening an inspector never reflows the dashboard.
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
    layout = resolveLayout(
      ordered.map(({ pos: _pos, ...rest }) => rest),
      gridColumns,
      Infinity,
    );
  } else {
    tile = Math.min(widthFit, heightFit, maxTile);
    layout = base;
  }
  tile = Math.floor(tile);
  const cell = tile + gap;
  const span = (n: number) => n * tile + (n - 1) * gap;
  const pageH = viewport.height;
  // Each page centres its four rows in the window.
  const pageTop = Math.max(pad.top, (pageH - span(PAGE_ROWS)) / 2);
  // One vertical pager: the first card page, then the Vault and Bookmarks
  // pages (when turned on), then any further card pages.
  const specials: SpecialPage[] = React.useMemo(
    () => [ui.vaultEnabled ?? true ? "vault" : null, ui.bookmarksEnabled ?? true ? "bookmarks" : null].filter(Boolean) as SpecialPage[],
    [ui.vaultEnabled, ui.bookmarksEnabled],
  );
  const screenOf = React.useCallback((cardPage: number) => (cardPage === 0 ? 0 : cardPage + specials.length), [specials.length]);
  const cardPageAt = (screen: number) => (screen === 0 ? 0 : screen <= specials.length ? null : screen - specials.length);
  const rowTop = React.useCallback(
    (row: number) => (flow ? row * cell : screenOf(pageOf(row)) * pageH + pageTop + (row % PAGE_ROWS) * cell),
    [flow, cell, pageH, pageTop, screenOf],
  );

  const [preview, setPreviewState] = React.useState<Layout | null>(null);
  // Mirrored in a ref so the drop handler reads the latest preview.
  const previewRef = React.useRef<Layout | null>(null);
  const setPreview = (next: Layout | null) => {
    previewRef.current = next;
    setPreviewState(next);
  };
  const [draggingIds, setDraggingIds] = React.useState<string[]>([]);
  const [ghost, setGhost] = React.useState<{ instance: WidgetInstance; size: { w: number; h: number } } | null>(null);
  const [page, setPage] = React.useState(0);
  // Join nodes show on the edges of the hovered card; the hover lingers a
  // moment so the pointer can cross the gap to a node.
  const [hoverId, setHoverId] = React.useState<string | null>(null);
  const [nodeHover, setNodeHover] = React.useState<{ a: string; b: string } | null>(null);
  // The node whose link menu is open (by seam key).
  const [nodeMenu, setNodeMenu] = React.useState<string | null>(null);
  const nodeMenuRef = React.useRef(nodeMenu);
  nodeMenuRef.current = nodeMenu;
  // A click anywhere else closes it (the menu and its node stop their own).
  React.useEffect(() => {
    if (!nodeMenu) return undefined;
    const close = (event: PointerEvent) => {
      if (!(event.target as HTMLElement)?.closest?.(".join-menu, .join-node")) setNodeMenu(null);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [nodeMenu]);
  React.useEffect(() => {
    if (!editing) setNodeMenu(null);
  }, [editing]);
  const hoverTimer = React.useRef(0);
  const hoverCard = (id: string | null) => {
    window.clearTimeout(hoverTimer.current);
    if (id) setHoverId(id);
    else hoverTimer.current = window.setTimeout(() => setHoverId(null), 450);
  };
  const ghostRef = React.useRef<HTMLDivElement>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<Drag | null>(null);
  const shown = preview ?? layout;
  // A dragged group stays anchored at its start (the pointer offset rides on
  // top); everything else shows the preview.
  const rendered: Layout = React.useMemo(() => {
    if (!draggingIds.length) return shown;
    const next = new Map(shown);
    for (const id of draggingIds) next.set(id, base.get(id)!);
    return next;
  }, [shown, draggingIds, base]);

  const pages = flow ? 1 : pageCount(shown) + (editing ? 1 : 0);
  const screens = flow ? 1 : pages + specials.length;
  const shownRows = flow ? Math.max(1, rowCount(shown)) : pages * PAGE_ROWS;

  // ---- joined cards: groups, outlines, seams ----
  const metrics: Metrics = React.useMemo(() => ({ cell, gap, span: (n: number) => n * tile + (n - 1) * gap, rowTop }), [cell, gap, tile, rowTop]);
  // How far each joined card's edge fades into the gradient between them.
  const fade = Math.round(gap * 0.6);
  const joined = React.useMemo(() => {
    const seams = flow ? [] : activeSeams(rendered, joins);
    const groups = groupsOf(seams);
    const px = seams.map((seam) => seamPx(seam, metrics));
    const members = new Map<string, { mask?: string; merged?: boolean }>();
    const outlines: Array<{ key: string; d: string; seams: SeamPx[]; merged: boolean }> = [];
    const merged: Array<{ key: string; ids: string[]; lead: WidgetInstance; box: Rect; mask: string; windows?: string }> = [];
    const radius = ui.cardStyle === "soft" ? 1.75 * rem : ui.cardStyle === "sharp" ? 0.625 * rem : 1.125 * rem;
    const done = new Set<string>();
    for (const [id, ids] of groups) {
      if (done.has(id)) continue;
      ids.forEach((m) => done.add(m));
      const groupSeams = px.filter((s) => ids.includes(s.a));
      const rects = ids.map((m) => rectOf(rendered.get(m)!, metrics));
      const key = ids.slice().sort().join("|");
      // All the same kind of media: the group becomes one video or photo,
      // shown by the first card (in dashboard order) across the whole shape.
      const groupWidgets = widgets.filter((w) => ids.includes(w.id));
      const kind = groupWidgets[0]?.type;
      const mergeable = !!kind && MERGEABLE.has(kind) && groupWidgets.every((w) => w.type === kind);
      // Shared media, gaps kept: each card its own window onto the one video or photo.
      const windows = mergeable && groupSeams.every((s) => s.mode === "window");
      const d = windows ? roundedRects(rects, radius) : groupOutline([...rects, ...groupSeams.map((s) => bridgeRect(s, gap))], radius);
      if (mergeable) {
        const x0 = Math.min(...rects.map((r) => r.x));
        const y0 = Math.min(...rects.map((r) => r.y));
        const box = { x: x0, y: y0, w: Math.max(...rects.map((r) => r.x + r.w)) - x0, h: Math.max(...rects.map((r) => r.y + r.h)) - y0 };
        const local = windows ? roundedRects(rects.map((r) => ({ ...r, x: r.x - x0, y: r.y - y0 })), radius) : undefined;
        merged.push({ key, ids, lead: groupWidgets[0], box, mask: svgMask(d, box), windows: local });
        outlines.push({ key, d, seams: windows ? [] : groupSeams, merged: true });
        for (const m of ids) members.set(m, { merged: true });
        continue;
      }
      outlines.push({ key, d, seams: groupSeams, merged: false });
      for (const m of ids) {
        // The card stays exactly where it is: the group outline rounds its
        // outer corners, and each joined edge fades into the gap's gradient.
        const rect = rectOf(rendered.get(m)!, metrics);
        const sides = new Set<string>();
        for (const s of groupSeams) {
          if (s.a === m) sides.add(s.orientation === "v" ? "right" : "bottom");
          if (s.b === m) sides.add(s.orientation === "v" ? "left" : "top");
        }
        const layers = [svgMask(d, rect), ...[...sides].map((side) => `linear-gradient(to ${side}, #000 calc(100% - ${fade}px), transparent)`)];
        members.set(m, { mask: layers.join(", ") });
      }
    }
    // Only seams between different kinds get the sampled gradient.
    const blended = px.filter((s) => !members.get(s.a)?.merged);
    const modes = new Map(px.map((s) => [s.key, s.mode]));
    return { seams: px, blended, members, outlines, merged, modes, radius };
  }, [flow, rendered, joins, widgets, metrics, gap, fade, rem, ui.cardStyle]);

  // Each joined card's colours along its joined edges (from its photo,
  // video, sky or background), sampled now and every few seconds as the
  // content changes. Keyed by seam: [card a's colours, card b's colours].
  const [edgeColorMap, setEdgeColorMap] = React.useState<Record<string, Array<Array<string | null>>>>({});
  React.useEffect(() => {
    if (!joined.blended.length) return undefined;
    const sample = () => {
      const grid = gridRef.current;
      if (!grid) return;
      const origin = grid.getBoundingClientRect();
      const next: Record<string, Array<Array<string | null>>> = {};
      for (const s of joined.blended) {
        const v = s.orientation === "v";
        const start = (v ? origin.top : origin.left) + s.from;
        const end = (v ? origin.top : origin.left) + s.to;
        const ends: Array<[string, Side]> = v ? [[s.a, "right"], [s.b, "left"]] : [[s.a, "bottom"], [s.b, "top"]];
        next[s.key] = ends.map(([id, side]) => {
          const el = grid.querySelector<HTMLElement>(`[data-tile-id="${CSS.escape(id)}"]`);
          return el ? edgeColors(el, side, start, end, SEAM_SAMPLES) : [];
        });
      }
      setEdgeColorMap((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    const first = window.setTimeout(sample, 300);
    const interval = window.setInterval(sample, 2500);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, [joined]);

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

  /** Link two cards ("bridge": one shape; "window": shared media, gaps kept), or split them (null). */
  const setJoin = (a: string, b: string, mode: JoinMode | null) => {
    const key = joinKey(a, b);
    void persistSettings((prev) => {
      const current: Join[] = Array.isArray(prev.layout?.joins) ? prev.layout.joins : [];
      const rest = current.filter(([x, y]) => joinKey(x, y) !== key);
      const next: Join[] = mode === null ? rest : [...rest, mode === "bridge" ? [a, b] : [a, b, mode]];
      // Drop joins whose cards are gone.
      const ids = new Set((prev.widgets as WidgetInstance[]).map((w) => w.id));
      return { ...prev, layout: { ...(prev.layout || {}), joins: next.filter(([x, y]) => ids.has(x) && ids.has(y)) } };
    });
  };

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
    return { x: clientX - rect.left, y: clientY - rect.top, inside: clientX >= rect.left - cell / 2 && clientX <= rect.right + cell / 2 && clientY >= 0 && clientY <= viewport.height };
  };

  /** The cell whose top-left is nearest a point (in grid px), for a card h rows tall. */
  const cellAt = (left: number, top: number, h: number) => {
    const x = Math.round(left / cell);
    if (flow) return { x, y: Math.max(0, Math.round(top / cell)) };
    const screen = Math.max(0, Math.floor((top + span(h) / 2) / pageH));
    // Over the Vault or Bookmarks page: the nearer card page.
    const p = cardPageAt(screen) ?? (screen <= specials.length / 2 ? 0 : 1);
    const within = Math.round((top - screenOf(p) * pageH - pageTop) / cell);
    return { x, y: p * PAGE_ROWS + Math.max(0, Math.min(PAGE_ROWS - h, within)) };
  };

  // Adds a card: at a dropped spot, the clicked empty cell, or the first free one.
  const addWidget = React.useCallback(
    (instance: WidgetInstance, at: Layout | null) => {
      const cells = cellsFor(instance.size);
      let next = at;
      if (!next) {
        const cellPick = useLayoutEditStore.getState().insertAt;
        next = placeTile(base, instance.id, cellPick ?? firstFreeSpot(base, cells, columns), cells, columns);
      }
      commit(applyLayout([...widgets, instance], next));
      setInsertAt(null);
      openInspector(instance.id);
    },
    [base, columns, commit, openInspector, setInsertAt, widgets],
  );

  // ---- pointer drags: move (a card or its group), resize, new cards ----
  const endDrag = React.useRef<() => void>(() => {});
  const lastPointer = React.useRef<{ clientX: number; clientY: number } | null>(null);
  const lastAutoScroll = React.useRef(0);

  // A dragged group's cards, plus its merged video or photo if it has one.
  const elementsOf = (ids: string[]) => {
    const grid = gridRef.current;
    if (!grid) return [];
    const tiles = ids.map((id) => grid.querySelector<HTMLElement>(`[data-tile-id="${CSS.escape(id)}"]`));
    const mergedEl = ids.length ? grid.querySelector<HTMLElement>(`[data-merged-ids~="${CSS.escape(ids[0])}"]`) : null;
    return [...tiles, mergedEl].filter(Boolean) as HTMLElement[];
  };

  // Dragging near the top or bottom of the window turns to the next card
  // page (skipping Vault and Bookmarks).
  const autoScroll = (clientY: number) => {
    const scroller = scrollerRef.current;
    if (flow || !scroller || performance.now() - lastAutoScroll.current < 700) return;
    const edge = 56;
    const dir = clientY > viewport.height - edge ? 1 : clientY < edge + 20 ? -1 : 0;
    if (!dir) return;
    let target = Math.round(scroller.scrollTop / pageH) + dir;
    while (target > 0 && target < screens && cardPageAt(target) === null) target += dir;
    if (target < 0 || target >= screens) return;
    lastAutoScroll.current = performance.now();
    scroller.scrollTo({ top: target * pageH, behavior: "smooth" });
  };

  const onMove = React.useCallback(
    (event: { clientX: number; clientY: number }) => {
      const drag = dragRef.current;
      if (!drag || !gridRef.current) return;
      lastPointer.current = { clientX: event.clientX, clientY: event.clientY };
      if (drag.kind === "move") {
        if (!drag.moved && Math.hypot(event.clientX - drag.start.x, event.clientY - drag.start.y) < 5) return;
        if (!drag.moved) {
          drag.moved = true;
          setDraggingIds(drag.members.map((m) => m.id));
        }
        autoScroll(event.clientY);
        const g = toGrid(event.clientX, event.clientY);
        const dx = g.x - drag.g0.x;
        const dy = g.y - drag.g0.y;
        for (const el of elementsOf(drag.members.map((m) => m.id))) el.style.translate = `${dx}px ${dy}px`;
        const grabbed = drag.members.find((m) => m.id === drag.id)!;
        const target = cellAt(grabbed.x * cell + dx, rowTop(grabbed.y) + dy, grabbed.h);
        const key = `${target.x},${target.y}`;
        if (key !== drag.key) {
          drag.key = key;
          const shiftX = target.x - grabbed.x;
          const shiftY = target.y - grabbed.y;
          setPreview(placeGroup(drag.base, drag.members.map((m) => ({ ...m, x: m.x + shiftX, y: m.y + shiftY })), columns));
        }
      } else if (drag.kind === "resize") {
        const g = toGrid(event.clientX, event.clientY);
        const w = Math.max(1, Math.min(3, Math.round((g.x - drag.origin.x * cell) / cell)));
        const h = Math.max(1, Math.min(2, Math.round((g.y - rowTop(drag.origin.y)) / cell)));
        const size = nearestSize(w, h, drag.allowed);
        if (size !== drag.key) {
          drag.key = size;
          drag.size = size;
          setPreview(placeTile(drag.base, drag.id, drag.origin, cellsFor(size), columns));
        }
      } else {
        if (!drag.moved && Math.hypot(event.clientX - drag.start.x, event.clientY - drag.start.y) < 5) return;
        drag.moved = true;
        autoScroll(event.clientY);
        const w = span(drag.size.w);
        const h = span(drag.size.h);
        if (ghostRef.current) ghostRef.current.style.transform = `translate(${event.clientX - w / 2}px, ${event.clientY - h / 2}px)`;
        const g = toGrid(event.clientX, event.clientY);
        drag.over = g.inside;
        const target = cellAt(g.x - w / 2, g.y - h / 2, drag.size.h);
        const key = g.inside ? `${target.x},${target.y}` : "out";
        if (key !== drag.key) {
          drag.key = key;
          setPreview(g.inside ? placeTile(drag.base, drag.instance.id, target, drag.size, columns) : null);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cell, columns, gap, tile, flow, pageH, pageTop, rowTop, viewport.height],
  );

  // A page turn mid-drag moves the grid under a still pointer.
  const onScrollDuringDrag = React.useCallback(() => {
    if (dragRef.current && lastPointer.current) onMove(lastPointer.current);
  }, [onMove]);

  const onUp = React.useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", endDrag.current);
    window.removeEventListener("pointercancel", endDrag.current);
    scrollerRef.current?.removeEventListener("scroll", onScrollDuringDrag);
    const current = previewRef.current;
    setPreview(null);
    if (drag?.kind === "move") {
      for (const el of elementsOf(drag.members.map((m) => m.id))) el.style.translate = "";
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
    setDraggingIds([]);
    setGhost(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addWidget, commit, onMove, onScrollDuringDrag, openInspector, widgets]);
  endDrag.current = onUp;

  const listen = () => {
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", endDrag.current);
    window.addEventListener("pointercancel", endDrag.current);
    scrollerRef.current?.addEventListener("scroll", onScrollDuringDrag);
  };

  const groupOf = (id: string) => groupsOf(activeSeams(base, joins)).get(id) ?? [id];

  const startMove = (id: string, event: React.PointerEvent<HTMLElement>) => {
    if (!editing || event.button !== 0 || isControl(event)) return;
    if (flow) {
      openInspector(id);
      return;
    }
    event.preventDefault();
    const g = toGrid(event.clientX, event.clientY);
    dragRef.current = {
      kind: "move",
      id,
      members: groupOf(id).map((m) => base.get(m)!),
      g0: { x: g.x, y: g.y },
      start: { x: event.clientX, y: event.clientY },
      moved: false,
      base,
      key: "",
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

  // The gallery (in the side panel) adds cards through here.
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

  // Keyboard: arrows move the selected card (with its group), Delete removes
  // it, ⌘Z undoes, Esc closes the panel then leaves edit mode, E toggles it.
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
        if (nodeMenuRef.current) setNodeMenu(null);
        else if (useSidePanelStore.getState().panel) closePanel();
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
        const members = groupOf(id).map((m) => base.get(m)!);
        commit(applyLayout(widgets, placeGroup(base, members.map((m) => ({ ...m, x: m.x + step[0], y: m.y + step[1] })), columns)));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, joins, closePanel, columns, commit, flow, removeWidget, select, setEditing, undo, widgets]);

  // One scroll gesture turns exactly one page (snapping alone would pull a
  // short trackpad swipe back). Cards that scroll themselves keep the wheel.
  React.useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || flow) return undefined;
    let acc = 0;
    let lockedUntil = 0;
    const scrollsItself = (el: HTMLElement | null, dy: number) => {
      for (let node = el; node && node !== scroller; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (!/(auto|scroll)/.test(style.overflowY) || node.scrollHeight <= node.clientHeight + 1) continue;
        if (dy > 0 ? node.scrollTop + node.clientHeight < node.scrollHeight - 1 : node.scrollTop > 0) return true;
      }
      return false;
    };
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < Math.abs(event.deltaX) || event.ctrlKey) return;
      if (scrollsItself(event.target as HTMLElement, event.deltaY)) return;
      event.preventDefault();
      const now = performance.now();
      if (now < lockedUntil) return;
      acc += event.deltaY;
      if (Math.abs(acc) < 30) return;
      const current = Math.round(scroller.scrollTop / pageH);
      const target = Math.max(0, Math.min(Math.round(scroller.scrollHeight / pageH) - 1, current + Math.sign(acc)));
      acc = 0;
      lockedUntil = now + 650;
      if (target !== current) scroller.scrollTo({ top: target * pageH, behavior: "smooth" });
    };
    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", onWheel);
  }, [flow, pageH]);

  // The URL follows the pager (#/resources on the Vault page, #/bookmarks on
  // Bookmarks), and the nav, shortcuts and links scroll it.
  const location = useLocation();
  const navigate = useNavigate();
  const pathRef = React.useRef(location.pathname);
  pathRef.current = location.pathname;
  const fromScroll = React.useRef(false);
  const firstSync = React.useRef(true);
  const settleTimer = React.useRef(0);
  const specialScreen = (kind: SpecialPage) => 1 + specials.indexOf(kind);
  const pathForScreen = (screen: number) => {
    if (cardPageAt(screen) !== null) return "/";
    return SPECIAL_PATHS[specials[screen - 1]];
  };

  React.useEffect(() => {
    const instant = firstSync.current;
    firstSync.current = false;
    if (fromScroll.current) {
      fromScroll.current = false;
      return;
    }
    const path = location.pathname;
    const kind = (Object.keys(SPECIAL_PATHS) as SpecialPage[]).find((k) => SPECIAL_PATHS[k] === path && specials.includes(k));
    if (flow) {
      document.getElementById(kind ? `page-${kind}` : "page-home")?.scrollIntoView({ behavior: instant ? "auto" : "smooth" });
      return;
    }
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const current = Math.round(scroller.scrollTop / pageH);
    const target = kind ? specialScreen(kind) : cardPageAt(current) === null ? 0 : null;
    if (target !== null && target !== current) scroller.scrollTo({ top: target * pageH, behavior: instant ? "auto" : "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.key, flow]);

  const onPagerScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const screen = Math.round(event.currentTarget.scrollTop / pageH);
    setPage(screen);
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      // Editing keeps the dashboard route (leaving it would end edit mode).
      if (useLayoutEditStore.getState().editing || dragRef.current) return;
      const path = pathForScreen(screen);
      if (path !== pathRef.current) {
        fromScroll.current = true;
        navigate(path, { replace: true });
      }
    }, 160);
  };

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
  const dropTargets = (draggingIds.length ? draggingIds : ghost ? [ghost.instance.id] : []).map((id) => preview?.get(id)).filter(Boolean) as Placement[];
  // Nodes between touching cards, to join or split them.
  const nodes =
    editing && !flow && !draggingIds.length && !ghost
      ? adjacentSeams(shown)
          .filter((seam) => joined.modes.has(joinKey(seam.a, seam.b)) || joinKey(seam.a, seam.b) === nodeMenu || seam.a === hoverId || seam.b === hoverId)
          .map((seam) => seamPx(seam, metrics))
      : [];

  const gridWidth = span(gridColumns);
  const gridHeight = flow ? span(shownRows) : screens * pageH;
  const deselect = (event: React.PointerEvent) => {
    if (editing && event.target === event.currentTarget) {
      select(null);
      if (panel?.kind === "widget") closePanel();
    }
  };

  const grid = (
    <div
      ref={gridRef}
      className="dashboard-grid relative"
      data-editing={editing || undefined}
      style={{ width: gridWidth, height: gridHeight }}
      onPointerDown={deselect}
    >
      {emptyCells.map(({ x, y }) => (
        <button
          key={`${x},${y}`}
          type="button"
          className={`grid-empty-cell ${radiusClass}`}
          data-active={insertAt?.x === x && insertAt?.y === y ? "true" : undefined}
          style={{ transform: `translate(${x * cell}px, ${rowTop(y)}px)`, width: tile, height: tile }}
          onClick={() => {
            setInsertAt({ x, y });
            select(null);
            openPanel({ kind: "gallery" });
          }}
          aria-label={`Add a widget here (page ${pageOf(y) + 1}, column ${x + 1}, row ${(y % PAGE_ROWS) + 1})`}
        />
      ))}

      {dropTargets.map((target) => (
        <div
          key={target.id}
          className={`grid-drop-target ${radiusClass}`}
          style={{ transform: `translate(${target.x * cell}px, ${rowTop(target.y)}px)`, width: span(target.w), height: span(target.h) }}
        />
      ))}

      {/* Joined groups, under the cards: one shadowed silhouette, and across
          each gap a gradient from one card's edge colour to the other's
          (also filling the rounded inner corners). */}
      <svg className="join-fill-layer" width={gridWidth} height={gridHeight} aria-hidden="true">
        <defs>
          {joined.outlines.map((outline, gi) => (
            <clipPath key={outline.key} id={`join-clip-${gi}`}>
              <path d={outline.d} />
            </clipPath>
          ))}
          <filter id="join-soften" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={Math.max(4, gap * 0.45)} />
          </filter>
          {joined.blended.flatMap((s, si) => {
            const v = s.orientation === "v";
            const [sideA = [], sideB = []] = edgeColorMap[s.key] ?? [];
            const start = s.center - gap / 2 - fade;
            const end = s.center + gap / 2 + fade;
            return Array.from({ length: SEAM_SAMPLES }, (_, i) => (
              <linearGradient key={`${s.key}-${i}`} id={`join-gradient-${si}-${i}`} gradientUnits="userSpaceOnUse" x1={v ? start : 0} x2={v ? end : 0} y1={v ? 0 : start} y2={v ? 0 : end}>
                <stop offset="0" style={{ stopColor: sideA[i] ?? sideB[i] ?? "var(--card)" }} />
                <stop offset="1" style={{ stopColor: sideB[i] ?? sideA[i] ?? "var(--card)" }} />
              </linearGradient>
            ));
          })}
        </defs>
        {joined.outlines.map((outline, gi) => (
          <g key={outline.key}>
            <path className="join-shadow" d={outline.d} />
            <g clipPath={`url(#join-clip-${gi})`}>
              {/* A strip per sample along the seam, blurred together. */}
              <g filter="url(#join-soften)">
                {outline.seams.flatMap((s) => {
                  const si = joined.blended.indexOf(s);
                  if (si < 0) return [];
                  const v = s.orientation === "v";
                  const across = gap / 2 + fade + 2;
                  const length = s.to - s.from;
                  const step = length / SEAM_SAMPLES;
                  // The end strips reach past the seam to fill the rounded inner corners.
                  const reachAlong = joined.radius + 4;
                  return Array.from({ length: SEAM_SAMPLES }, (_, i) => {
                    const a = s.from + step * i - (i === 0 ? reachAlong : 0);
                    const b = s.from + step * (i + 1) + (i === SEAM_SAMPLES - 1 ? reachAlong : 0);
                    const fill = `url(#join-gradient-${si}-${i})`;
                    return v ? (
                      <rect key={`${s.key}-${i}`} x={s.center - across} width={across * 2} y={a - 1} height={b - a + 2} fill={fill} />
                    ) : (
                      <rect key={`${s.key}-${i}`} y={s.center - across} height={across * 2} x={a - 1} width={b - a + 2} fill={fill} />
                    );
                  });
                })}
              </g>
            </g>
          </g>
        ))}
      </svg>

      {widgets.map((instance, index) => {
        const placement = rendered.get(instance.id) ?? layout.get(instance.id)!;
        const member = joined.members.get(instance.id);
        const rect = { x: placement.x * cell, y: rowTop(placement.y), w: span(placement.w), h: span(placement.h) };
        return (
          <DashboardTile
            key={instance.id}
            index={index}
            instance={instance}
            rect={rect}
            mask={member?.mask}
            merged={member?.merged}
            editing={editing}
            selected={selectedId === instance.id}
            dragging={draggingIds.includes(instance.id)}
            canResize={editing && !flow}
            radiusClass={radiusClass}
            cardClass={cardClassFor(instance.type)}
            onPointerDown={(event) => startMove(instance.id, event)}
            onPointerEnter={() => editing && hoverCard(instance.id)}
            onPointerLeave={() => editing && hoverCard(null)}
            joinPreview={!!nodeHover && (nodeHover.a === instance.id || nodeHover.b === instance.id)}
            onResizeStart={(event) => startResize(instance.id, event)}
            onRemove={() => removeWidget(instance.id)}
          />
        );
      })}

      {/* Merged groups: one video or photo across the whole joined shape. */}
      {joined.merged.map((group) => (
        <div
          key={group.key}
          className={`dashboard-merged ${cardClassFor(group.lead.type)}`}
          data-merged-ids={group.ids.join(" ")}
          data-windows={group.windows ? "true" : undefined}
          data-editing={editing || undefined}
          style={{
            transform: `translate(${group.box.x}px, ${group.box.y}px)`,
            width: group.box.w,
            height: group.box.h,
            maskImage: group.mask,
            WebkitMaskImage: group.mask,
          }}
        >
          <MergedContent instance={group.lead} size={`${group.box.w}x${group.box.h}`} />
          {/* Each window's own rim (the box's rim would only trace its outer edges). */}
          {group.windows && (
            <svg className="dashboard-merged-rims" width={group.box.w} height={group.box.h} aria-hidden="true">
              <path d={group.windows} />
            </svg>
          )}
        </div>
      ))}

      {nodes.map((s) => {
        const mode = joined.modes.get(s.key);
        const x = s.orientation === "v" ? s.center : (s.from + s.to) / 2;
        const y = s.orientation === "v" ? (s.from + s.to) / 2 : s.center;
        const typeA = widgets.find((w) => w.id === s.a)?.type;
        const typeB = widgets.find((w) => w.id === s.b)?.type;
        const names = `${getWidgetType(typeA ?? "clock").label} and ${getWidgetType(typeB ?? "clock").label}`;
        // Two videos or two photos can also share one, keeping their gap.
        const canShare = !!typeA && typeA === typeB && MERGEABLE.has(typeA);
        const media = typeA === "video" ? "video" : "photo";
        const menuOpen = nodeMenu === s.key;
        const choose = (next: JoinMode | null) => {
          setJoin(s.a, s.b, next);
          setNodeMenu(null);
          setNodeHover(null);
        };
        const label = !mode ? "Link" : !canShare ? "Split" : mode === "window" ? "Shared" : "Joined";
        return (
          <React.Fragment key={s.key}>
            <button
              type="button"
              className="join-node"
              data-joined={mode ? "true" : undefined}
              data-mode={mode}
              data-label={menuOpen ? undefined : label}
              style={{ left: x, top: y }}
              onPointerEnter={() => {
                hoverCard(hoverId);
                setNodeHover({ a: s.a, b: s.b });
              }}
              onPointerLeave={() => {
                setNodeHover(null);
                hoverCard(null);
              }}
              onClick={() => {
                if (canShare) setNodeMenu(menuOpen ? null : s.key);
                else choose(mode ? null : "bridge");
              }}
              title={canShare ? `Link ${names}` : mode ? `Split ${names}` : `Join ${names} into one shape`}
              aria-label={canShare ? `Link ${names}` : mode ? `Split ${names}` : `Join ${names}`}
              aria-pressed={!!mode}
              aria-expanded={canShare ? menuOpen : undefined}
            >
              <HiLink className="size-3.5" />
            </button>
            {menuOpen && (
              <div className="join-menu surface-glass" role="menu" aria-label={`Link ${names}`} style={{ left: x, top: y }}>
                <button type="button" role="menuitemradio" aria-checked={mode === "bridge"} onClick={() => choose("bridge")}>
                  <span className="join-menu-icon" data-kind="bridge" aria-hidden="true" />
                  <span>
                    One {media}, one shape
                    <small>The gap fills in</small>
                  </span>
                </button>
                <button type="button" role="menuitemradio" aria-checked={mode === "window"} onClick={() => choose("window")}>
                  <span className="join-menu-icon" data-kind="window" aria-hidden="true" />
                  <span>
                    One {media}, keep the gap
                    <small>Each card a window onto it</small>
                  </span>
                </button>
                {mode && (
                  <button type="button" role="menuitem" className="join-menu-split" onClick={() => choose(null)}>
                    Split
                  </button>
                )}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  const editBar = editing && <EditBar flow={flow} onUndo={undo} />;
  const ghostCard = ghost && (
    <div ref={ghostRef} className={`grid-ghost surface-tile ${radiusClass}`} style={{ width: span(ghost.size.w), height: span(ghost.size.h) }} aria-hidden="true">
      {React.createElement(getWidgetType(ghost.instance.type).icon, { className: "size-5" })}
      <span>{getWidgetType(ghost.instance.type).label}</span>
    </div>
  );

  const specialPage = (kind: SpecialPage) => (
    <React.Suspense fallback={null}>{kind === "vault" ? <ResourceVaultPage /> : <BookmarksPage />}</React.Suspense>
  );

  if (flow) {
    return (
      <>
        <div
          id="page-home"
          className="flex min-h-screen items-start justify-center"
          style={{ paddingTop: pad.top, paddingBottom: editing ? 5 * rem : pad.bottom, paddingLeft: pad.side, paddingRight: pad.side + panelOffset }}
          onPointerDown={deselect}
        >
          {editBar}
          {grid}
          {ghostCard}
        </div>
        {specials.map((kind) => (
          <section key={kind} id={`page-${kind}`} className="dashboard-special-flow" aria-label={SPECIAL_LABELS[kind]}>
            {specialPage(kind)}
          </section>
        ))}
      </>
    );
  }

  return (
    <>
      {editBar}
      <div ref={scrollerRef} className="dashboard-scroller" onScroll={onPagerScroll} onPointerDown={deselect}>
        <div className="dashboard-pages" style={{ height: gridHeight }} onPointerDown={deselect}>
          {Array.from({ length: screens }, (_, p) => (
            <div key={p} className="dashboard-page-snap" style={{ top: p * pageH, height: pageH }} />
          ))}
          <div style={{ position: "absolute", top: 0, left: Math.max(pad.side, (viewport.width - panelOffset - gridWidth) / 2), transition: "left var(--duration-base) var(--ease-out)" }}>
            {grid}
          </div>
          {specials.map((kind, i) => (
            <section
              key={kind}
              className="dashboard-special"
              data-editing={editing || undefined}
              style={{ top: (i + 1) * pageH, height: pageH }}
              aria-label={SPECIAL_LABELS[kind]}
            >
              {specialPage(kind)}
              {editing && <div className="dashboard-special-veil">{SPECIAL_LABELS[kind]} page · scroll past to add cards on the next page</div>}
            </section>
          ))}
        </div>
      </div>
      {screens > 1 && (
        <nav className="page-dots" aria-label="Pages" style={{ right: panelOffset + 0.9 * rem }}>
          {Array.from({ length: screens }, (_, p) => {
            const kind = cardPageAt(p) === null ? specials[p - 1] : null;
            return (
              <button
                key={p}
                type="button"
                className="page-dot"
                data-kind={kind ?? undefined}
                aria-current={page === p ? "page" : undefined}
                aria-label={kind ? SPECIAL_LABELS[kind] : `Cards, page ${(cardPageAt(p) ?? 0) + 1}`}
                title={kind ? SPECIAL_LABELS[kind] : `Cards ${(cardPageAt(p) ?? 0) + 1}`}
                onClick={() => scrollerRef.current?.scrollTo({ top: p * pageH, behavior: "smooth" })}
              />
            );
          })}
        </nav>
      )}
      {ghostCard}
    </>
  );
}
