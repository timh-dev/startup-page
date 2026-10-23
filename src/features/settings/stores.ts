import { create } from "zustand";

import { onSettingsChangedInOtherTab, readSettings, writeSettings } from "@/lib/settings";

export type StartupSettings = Record<string, any>;

type SettingsUpdater =
  | StartupSettings
  | ((settings: StartupSettings) => StartupSettings);

interface SettingsStore {
  settings: StartupSettings;
  reloadSettings: () => StartupSettings;
  setSettings: (updater: SettingsUpdater) => StartupSettings;
  persistSettings: (updater: SettingsUpdater) => Promise<StartupSettings>;
}

const resolveNextSettings = (
  currentSettings: StartupSettings,
  updater: SettingsUpdater,
) => (typeof updater === "function" ? updater(currentSettings) : updater);

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: readSettings() as StartupSettings,

  reloadSettings: () => {
    const settings = readSettings() as StartupSettings;
    set({ settings });
    return settings;
  },

  setSettings: (updater) => {
    const settings = resolveNextSettings(get().settings, updater);
    set({ settings });
    return settings;
  },

  persistSettings: async (updater) => {
    const settings = resolveNextSettings(get().settings, updater);
    set({ settings });
    await writeSettings(settings);
    return settings;
  },
}));

// Another tab saved settings (shared localStorage/IndexedDB): pick them up so
// this tab's next edit builds on them instead of overwriting them.
onSettingsChangedInOtherTab(() => useSettingsStore.getState().reloadSettings());
