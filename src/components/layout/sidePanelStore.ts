import { create } from "zustand";

export type SettingsSection = "general" | "appearance" | "dashboard" | "connections" | "data" | "advanced";

export type SidePanel =
  | { kind: "settings"; section: SettingsSection }
  | { kind: "widget"; id: string }
  | { kind: "gallery" };

interface SidePanelStore {
  panel: SidePanel | null;
  open: (panel: SidePanel) => void;
  openSettings: (section?: SettingsSection) => void;
  close: () => void;
}

// The one side panel beside the dashboard: settings, the widget gallery or a
// card's inspector. Non-modal, so the dashboard stays live beside it.
export const useSidePanelStore = create<SidePanelStore>((set) => ({
  panel: null,
  open: (panel) => set({ panel }),
  openSettings: (section = "general") => set({ panel: { kind: "settings", section } }),
  close: () => set({ panel: null }),
}));
