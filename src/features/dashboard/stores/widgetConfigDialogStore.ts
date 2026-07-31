import { create } from "zustand";

type DialogState = { kind: null } | { kind: "edit"; widgetId: string } | { kind: "new" };

interface WidgetConfigDialogStore {
  dialog: DialogState;
  openEdit: (widgetId: string) => void;
  openNew: () => void;
  close: () => void;
}

// Ephemeral (non-persisted) UI state for which grid widget's config dialog is
// open — mirrors the pattern used by useBookmarkDialogStore.
export const useWidgetConfigDialogStore = create<WidgetConfigDialogStore>((set) => ({
  dialog: { kind: null },
  openEdit: (widgetId) => set({ dialog: { kind: "edit", widgetId } }),
  openNew: () => set({ dialog: { kind: "new" } }),
  close: () => set({ dialog: { kind: null } }),
}));
