import React from "react";
import { create } from "zustand";
import { useRegisterActions, type Action } from "kbar";
import { HiCheck, HiChevronDown, HiOutlineDocumentDuplicate, HiOutlinePencil, HiOutlinePlus, HiOutlineTrash } from "react-icons/hi2";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useSidePanelStore } from "@/components/layout/sidePanelStore";
import { useSettingsStore } from "@/features/settings/stores";
import { useLayoutEditStore } from "@/features/dashboard/stores/layoutEditStore";
import {
  MAIN_DASHBOARD,
  addDashboard,
  copyDashboard,
  listDashboards,
  readDashboard,
  removeDashboard,
  renameDashboard,
  resolveActiveId,
  useActiveDashboardStore,
} from "@/features/dashboard/dashboards";
import { switchDashboard, useActiveDashboardId } from "@/features/dashboard/useDashboard";

// Switching between dashboards (Home, Work…), and making, renaming and
// deleting them. The menu sits in the edit bar, and in the toolbar once
// there's more than one; ⌘K can switch too.

type DialogState = { kind: "new" } | { kind: "duplicate"; id: string } | { kind: "rename"; id: string } | { kind: "delete"; id: string } | null;

const useDashboardDialog = create<{ dialog: DialogState; open: (dialog: DialogState) => void }>((set) => ({
  dialog: null,
  open: (dialog) => set({ dialog }),
}));

function useDashboardList() {
  const settings = useSettingsStore((state) => state.settings);
  return React.useMemo(() => listDashboards(settings), [settings]);
}

/** The switcher: the dashboard's name, opening the list and its actions. */
export function DashboardMenu({ variant }: { variant: "toolbar" | "edit" }) {
  const dashboards = useDashboardList();
  const activeId = useActiveDashboardId();
  const openDialog = useDashboardDialog((state) => state.open);
  const active = dashboards.find((item) => item.id === activeId) ?? dashboards[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={variant === "toolbar" ? "toolbar-dashboard" : "edit-bar-button"}
          aria-label={`Dashboard: ${active.name}. Switch or manage dashboards`}
          title="Switch dashboard"
        >
          <span className="dashboard-menu-name">{active.name}</span>
          <HiChevronDown className="size-3.5 opacity-60" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={variant === "toolbar" ? "end" : "center"} side={variant === "edit" ? "top" : "bottom"} className="min-w-52">
        {dashboards.map((item) => (
          <DropdownMenuItem key={item.id} onSelect={() => switchDashboard(item.id)}>
            <HiCheck className={`size-4 ${item.id === active.id ? "" : "invisible"}`} aria-hidden="true" />
            <span className="truncate">{item.name}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => openDialog({ kind: "new" })}>
          <HiOutlinePlus className="size-4" aria-hidden="true" /> New dashboard
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openDialog({ kind: "duplicate", id: active.id })}>
          <HiOutlineDocumentDuplicate className="size-4" aria-hidden="true" /> Duplicate “{active.name}”
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openDialog({ kind: "rename", id: active.id })}>
          <HiOutlinePencil className="size-4" aria-hidden="true" /> Rename…
        </DropdownMenuItem>
        {active.id !== MAIN_DASHBOARD && (
          <DropdownMenuItem destructive onSelect={() => openDialog({ kind: "delete", id: active.id })}>
            <HiOutlineTrash className="size-4" aria-hidden="true" /> Delete…
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The toolbar switcher, shown once there's a second dashboard. */
export function ToolbarDashboardMenu() {
  const count = useSettingsStore((state) => listDashboards(state.settings).length);
  return count > 1 ? <DashboardMenu variant="toolbar" /> : null;
}

/** Naming a new or duplicated dashboard, renaming one, or confirming a delete. Mounted once. */
export function DashboardDialogs() {
  const dialog = useDashboardDialog((state) => state.dialog);
  const open = useDashboardDialog((state) => state.open);
  const dashboards = useDashboardList();
  const persistSettings = useSettingsStore((state) => state.persistSettings);
  const target = dialog && dialog.kind !== "new" ? dashboards.find((item) => item.id === dialog.id) : undefined;
  const [name, setName] = React.useState("");

  React.useEffect(() => {
    if (!dialog) return;
    if (dialog.kind === "new") setName("");
    else if (dialog.kind === "duplicate") setName(target ? `${target.name} copy` : "");
    else if (dialog.kind === "rename") setName(target?.name ?? "");
    // Only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog]);

  const close = () => open(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!dialog) return;
    if (dialog.kind === "delete") {
      // Show main first, so nothing on screen points at the deleted one.
      switchDashboard(MAIN_DASHBOARD);
      await persistSettings((prev) => removeDashboard(prev, dialog.id));
      close();
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) return;
    if (dialog.kind === "rename") {
      await persistSettings((prev) => renameDashboard(prev, dialog.id, trimmed));
      close();
      return;
    }
    // New (empty, same page size as the one on screen) or a copy.
    let createdId = "";
    const sourceId = dialog.kind === "duplicate" ? dialog.id : null;
    await persistSettings((prev) => {
      const current = readDashboard(prev, resolveActiveId(prev, useActiveDashboardStore.getState().activeId));
      const data = sourceId
        ? copyDashboard(readDashboard(prev, sourceId))
        : { widgets: [], columns: current.columns, rows: current.rows, joins: [] };
      const result = addDashboard(prev, trimmed, data);
      createdId = result.id;
      return result.settings;
    });
    close();
    switchDashboard(createdId);
    // A new dashboard opens ready to fill.
    if (!sourceId) {
      useLayoutEditStore.getState().setEditing(true);
      useSidePanelStore.getState().open({ kind: "gallery" });
    }
  };

  const isDelete = dialog?.kind === "delete";
  const title =
    dialog?.kind === "new" ? "New dashboard" : dialog?.kind === "duplicate" ? "Duplicate dashboard" : dialog?.kind === "rename" ? "Rename dashboard" : `Delete “${target?.name ?? ""}”?`;

  return (
    <Dialog open={!!dialog} onOpenChange={(next) => !next && close()}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {isDelete
                ? "Its cards go with it. Your bookmarks, vault and other dashboards stay as they are."
                : dialog?.kind === "new"
                  ? "An empty dashboard to fill with cards. Switch between dashboards from the menu by its name, or with ⌘K."
                  : "Each device remembers which dashboard it shows."}
            </DialogDescription>
          </DialogHeader>
          {!isDelete && (
            <Input
              autoFocus
              aria-label="Dashboard name"
              placeholder="Work"
              value={name}
              maxLength={40}
              onChange={(event) => setName(event.target.value)}
            />
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" variant={isDelete ? "destructive" : "default"} disabled={!isDelete && !name.trim()}>
              {isDelete ? "Delete" : dialog?.kind === "rename" ? "Rename" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** ⌘K: switch to each other dashboard, or make a new one. */
export function DashboardActions() {
  const dashboards = useDashboardList();
  const activeId = useActiveDashboardId();
  const openDialog = useDashboardDialog((state) => state.open);
  const actions: Action[] = React.useMemo(
    () => [
      ...dashboards
        .filter((item) => item.id !== activeId)
        .map((item) => ({
          id: `dashboard-${item.id}`,
          name: `Switch to ${item.name}`,
          keywords: "dashboard profile",
          section: "Dashboards",
          perform: () => switchDashboard(item.id),
        })),
      {
        id: "dashboard-new",
        name: "New dashboard…",
        keywords: "dashboard profile add create",
        section: "Dashboards",
        perform: () => openDialog({ kind: "new" }),
      },
    ],
    [dashboards, activeId, openDialog],
  );
  useRegisterActions(actions, [actions]);
  return null;
}
