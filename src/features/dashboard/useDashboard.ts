import React from "react";

import { useSettingsStore } from "@/features/settings/stores";
import { useLayoutEditStore } from "@/features/dashboard/stores/layoutEditStore";
import { useSidePanelStore } from "@/components/layout/sidePanelStore";
import {
  readDashboard,
  resolveActiveId,
  useActiveDashboardStore,
  writeDashboard,
  type DashboardData,
} from "@/features/dashboard/dashboards";

/** The id of the dashboard on screen. */
export function useActiveDashboardId(): string {
  const chosen = useActiveDashboardStore((state) => state.activeId);
  return useSettingsStore((state) => resolveActiveId(state.settings, chosen));
}

/** The dashboard on screen: its id, cards, page size and joins. */
export function useActiveDashboard(): DashboardData & { id: string } {
  const id = useActiveDashboardId();
  const widgets = useSettingsStore((state) => readDashboard(state.settings, id).widgets);
  const joins = useSettingsStore((state) => readDashboard(state.settings, id).joins);
  const columns = useSettingsStore((state) => readDashboard(state.settings, id).columns);
  const rows = useSettingsStore((state) => readDashboard(state.settings, id).rows);
  return React.useMemo(() => ({ id, widgets, joins, columns, rows }), [id, widgets, joins, columns, rows]);
}

/** Saves a change to one dashboard, worked out from its latest data. */
export function persistDashboard(id: string, update: (data: DashboardData, settings: Record<string, any>) => Partial<DashboardData>) {
  return useSettingsStore.getState().persistSettings((prev) => writeDashboard(prev, id, update(readDashboard(prev, id), prev)));
}

/** Shows another dashboard. Undo, the selection and any card inspector belong to the old one, so they go. */
export function switchDashboard(id: string) {
  useActiveDashboardStore.getState().setActive(id);
  useLayoutEditStore.setState({ history: [], selectedId: null, insertAt: null });
  const panel = useSidePanelStore.getState().panel;
  if (panel && panel.kind === "widget") useSidePanelStore.getState().close();
}
