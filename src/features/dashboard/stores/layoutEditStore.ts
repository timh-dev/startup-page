import { create } from "zustand";

import type { WidgetInstance } from "@/lib/dashboard-dimensions";

const HISTORY_LIMIT = 30;

interface LayoutEditStore {
  editing: boolean;
  /** Editing was turned on by opening Settings, so closing Settings turns it off. */
  editingFromSettings: boolean;
  /** The card whose inspector is open. */
  selectedId: string | null;
  /** Earlier versions of the card list, newest last, for Undo. */
  history: WidgetInstance[][];
  /** An empty cell that was clicked: where the next added card goes. */
  insertAt: { x: number; y: number } | null;
  setInsertAt: (cell: { x: number; y: number } | null) => void;
  setEditing: (editing: boolean) => void;
  /** Opening Settings starts editing (unless it's already on). */
  startEditingForSettings: () => void;
  toggleEditing: () => void;
  select: (id: string | null) => void;
  pushHistory: (widgets: WidgetInstance[]) => void;
  popHistory: () => WidgetInstance[] | null;
}

// Dashboard editing state, shared by the toolbar's Edit button, the grid,
// the edit bar and the inspector. Not persisted: a reload leaves edit mode.
export const useLayoutEditStore = create<LayoutEditStore>((set, get) => ({
  editing: false,
  editingFromSettings: false,
  selectedId: null,
  history: [],
  insertAt: null,
  setInsertAt: (insertAt) => set({ insertAt }),
  setEditing: (editing) => set(editing ? { editing, editingFromSettings: false } : { editing, editingFromSettings: false, selectedId: null, insertAt: null }),
  startEditingForSettings: () => {
    if (!get().editing) set({ editing: true, editingFromSettings: true });
  },
  toggleEditing: () => get().setEditing(!get().editing),
  select: (selectedId) => set({ selectedId }),
  pushHistory: (widgets) => set((state) => ({ history: [...state.history, widgets].slice(-HISTORY_LIMIT) })),
  popHistory: () => {
    const { history } = get();
    if (!history.length) return null;
    set({ history: history.slice(0, -1) });
    return history[history.length - 1];
  },
}));
