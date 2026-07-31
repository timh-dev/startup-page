import { create } from "zustand";

interface QuickAddStore {
  pending: boolean;
  requestQuickAdd: () => void;
  consumeQuickAdd: () => void;
}

// Lets the global "quick add" keyboard shortcut (registered in AppLayout,
// reachable from anywhere in the dashboard) open the vault's composer even
// though it lives on a different route/component. requestQuickAdd() sets the
// flag before navigating; VaultGlassView opens the composer and calls
// consumeQuickAdd() once it observes it — this works whether the vault is
// already mounted or the shortcut just navigated to it.
export const useQuickAddStore = create<QuickAddStore>((set) => ({
  pending: false,
  requestQuickAdd: () => set({ pending: true }),
  consumeQuickAdd: () => set({ pending: false }),
}));
