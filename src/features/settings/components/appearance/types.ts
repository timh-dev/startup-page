import type { StartupSettings } from "@/features/settings/stores";

export interface SettingsSectionProps {
  settings: StartupSettings;
  updateSettings: (updater: (settings: StartupSettings) => StartupSettings) => void;
}

/** Sets one key under settings.ui. */
export function setUiValue(updateSettings: SettingsSectionProps["updateSettings"], key: string, value: unknown) {
  updateSettings((prev) => ({ ...prev, ui: { ...prev.ui, [key]: value } }));
}
