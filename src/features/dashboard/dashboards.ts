import { create } from "zustand";

import { generateId } from "@/features/bookmarks/lib/tree";
import type { Join } from "@/features/dashboard/layout/joins";
import type { WidgetInstance } from "@/lib/dashboard-dimensions";

// Several dashboards (say Home and Work), each its own cards, page size and
// joins. The first, "main", is the settings' own `widgets` and `layout`, as
// it always was, so older data and older clients see it unchanged. The
// others live in `layout.dashboards`, inside the widgets sync domain, and
// merge entry by entry like everything else.
//
// Which one is showing belongs to this device (a work laptop on Work, the
// home machine on Home), so it's kept in localStorage and never synced.

export const MAIN_DASHBOARD = "main";
const DEFAULT_MAIN_NAME = "Home";

/** One dashboard's own data. Missing columns/rows fall back to the app defaults. */
export interface DashboardData {
  widgets: WidgetInstance[];
  columns?: number;
  rows?: number;
  joins: Join[];
}

/** A dashboard other than main, as stored in `layout.dashboards`. */
export interface StoredDashboard extends DashboardData {
  id: string;
  name: string;
}

export interface DashboardSummary {
  id: string;
  name: string;
}

type Settings = Record<string, any>;

const EMPTY: never[] = [];

function storedDashboards(settings: Settings): StoredDashboard[] {
  const list = settings?.layout?.dashboards;
  return Array.isArray(list) ? list.filter((entry) => entry && typeof entry.id === "string") : EMPTY;
}

/** Every dashboard, main first. */
export function listDashboards(settings: Settings): DashboardSummary[] {
  const mainName = typeof settings?.layout?.name === "string" && settings.layout.name.trim() ? settings.layout.name : DEFAULT_MAIN_NAME;
  return [{ id: MAIN_DASHBOARD, name: mainName }, ...storedDashboards(settings).map(({ id, name }) => ({ id, name: name || "Untitled" }))];
}

/** Whether `id` names a dashboard in `settings`. */
export function hasDashboard(settings: Settings, id: string): boolean {
  return id === MAIN_DASHBOARD || storedDashboards(settings).some((entry) => entry.id === id);
}

/**
 * The dashboard's data (main's when `id` isn't there). Its lists are the
 * stored ones, not copies, so they're stable between reads.
 */
export function readDashboard(settings: Settings, id: string): DashboardData {
  const entry = id === MAIN_DASHBOARD ? null : storedDashboards(settings).find((item) => item.id === id);
  if (entry) {
    return {
      widgets: Array.isArray(entry.widgets) ? entry.widgets : EMPTY,
      columns: entry.columns,
      rows: entry.rows,
      joins: Array.isArray(entry.joins) ? entry.joins : EMPTY,
    };
  }
  const layout = settings?.layout || {};
  return {
    widgets: Array.isArray(settings?.widgets) ? settings.widgets : EMPTY,
    columns: layout.columns,
    rows: layout.rows,
    joins: Array.isArray(layout.joins) ? layout.joins : EMPTY,
  };
}

/** Settings with part of one dashboard replaced (main's when `id` isn't there). */
export function writeDashboard<T extends Settings>(settings: T, id: string, patch: Partial<DashboardData>): T {
  const layout = settings.layout || {};
  const stored = storedDashboards(settings);
  const index = id === MAIN_DASHBOARD ? -1 : stored.findIndex((entry) => entry.id === id);
  if (index < 0) {
    const { widgets, ...layoutPatch } = patch;
    const next: T = widgets ? { ...settings, widgets } : { ...settings };
    // Only the cards changed: the layout object stays the same one.
    return Object.keys(layoutPatch).length ? { ...next, layout: { ...layout, ...layoutPatch } } : next;
  }
  const next = stored.slice();
  next[index] = { ...stored[index], ...patch };
  return { ...settings, layout: { ...layout, dashboards: next } };
}

/** The same cards with fresh ids, and joins and stacks following them. */
export function copyDashboard(data: DashboardData): DashboardData {
  const ids = new Map<string, string>();
  const copy = (widget: WidgetInstance): WidgetInstance => {
    const id = generateId();
    ids.set(widget.id, id);
    const next: WidgetInstance = { ...widget, id, config: { ...widget.config } };
    if (Array.isArray(widget.items)) next.items = widget.items.map(copy);
    return next;
  };
  const widgets = data.widgets.map(copy);
  const joins = data.joins
    .filter(([a, b]) => ids.has(a) && ids.has(b))
    .map(([a, b, mode]): Join => (mode ? [ids.get(a)!, ids.get(b)!, mode] : [ids.get(a)!, ids.get(b)!]));
  return { widgets, columns: data.columns, rows: data.rows, joins };
}

/** Settings with a new dashboard added after the others, and its id. */
export function addDashboard<T extends Settings>(settings: T, name: string, data: DashboardData): { settings: T; id: string } {
  const id = generateId();
  const entry: StoredDashboard = { id, name: name.trim() || "Untitled", ...data };
  const layout = settings.layout || {};
  return { settings: { ...settings, layout: { ...layout, dashboards: [...storedDashboards(settings), entry] } }, id };
}

export function renameDashboard<T extends Settings>(settings: T, id: string, name: string): T {
  const trimmed = name.trim();
  if (!trimmed) return settings;
  const layout = settings.layout || {};
  if (id === MAIN_DASHBOARD) return { ...settings, layout: { ...layout, name: trimmed } };
  return {
    ...settings,
    layout: { ...layout, dashboards: storedDashboards(settings).map((entry) => (entry.id === id ? { ...entry, name: trimmed } : entry)) },
  };
}

/** Settings without the dashboard. Main can't be removed. */
export function removeDashboard<T extends Settings>(settings: T, id: string): T {
  if (id === MAIN_DASHBOARD) return settings;
  const layout = settings.layout || {};
  return { ...settings, layout: { ...layout, dashboards: storedDashboards(settings).filter((entry) => entry.id !== id) } };
}

// ---- the dashboard this device shows ----

const ACTIVE_KEY = "startup-page.dashboard";

function readActive(): string {
  try {
    return localStorage.getItem(ACTIVE_KEY) || MAIN_DASHBOARD;
  } catch {
    return MAIN_DASHBOARD;
  }
}

interface ActiveDashboardStore {
  /** The chosen dashboard; may name one since deleted on another device (then main shows). */
  activeId: string;
  setActive: (id: string) => void;
}

export const useActiveDashboardStore = create<ActiveDashboardStore>((set) => ({
  activeId: readActive(),
  setActive: (activeId) => {
    try {
      localStorage.setItem(ACTIVE_KEY, activeId);
    } catch {
      // Private mode: the choice lasts for this visit.
    }
    set({ activeId });
  },
}));

/** The id of the dashboard showing: the chosen one if it still exists, else main. */
export function resolveActiveId(settings: Settings, activeId: string): string {
  return hasDashboard(settings, activeId) ? activeId : MAIN_DASHBOARD;
}
