import { create } from "zustand";
import type { VaultItemKind } from "@/features/resourceVault/types";

export type VaultSection = "links" | VaultItemKind;

interface QuickAddStore {
  pending: boolean;
  section: VaultSection;
  requestQuickAdd: (section?: VaultSection) => void;
  consumeQuickAdd: () => void;
}

// Lets the global "quick add" keyboard shortcut (registered in AppLayout,
// reachable from anywhere in the dashboard) and the homepage vault launcher's
// "+" tile open the right vault section's composer even though it lives on a
// different route/component. requestQuickAdd() sets the flag (and which
// section to open) before navigating; the vault view for that section opens
// its composer and calls consumeQuickAdd() once it observes it — this works
// whether the vault is already mounted or the shortcut just navigated to it.
export const useQuickAddStore = create<QuickAddStore>((set) => ({
  pending: false,
  section: "links",
  requestQuickAdd: (section = "links") => set({ pending: true, section }),
  consumeQuickAdd: () => set({ pending: false }),
}));
