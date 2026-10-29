import React from "react";
import { HiOutlineCog6Tooth } from "react-icons/hi2";

import { PanelFrame } from "@/components/layout/SidePanel";
import { useSidePanelStore, type SettingsSection } from "@/components/layout/sidePanelStore";
import { ThemeContext } from "@/components/layout/ThemeContext";
import { useSettingsStore, type StartupSettings } from "@/features/settings/stores";
import { getStorageDiagnostics } from "@/lib/settings";
import ThemeSettings from "./appearance/ThemeSettings";
import ImageEffectsSettings from "./appearance/ImageEffectsSettings";
import DataTab from "./DataTab";
import { AdvancedSettings, ConnectionsSettings, DashboardSettings, GeneralSettings } from "./sections";

const SECTIONS: Array<{ value: SettingsSection; label: string }> = [
  { value: "general", label: "General" },
  { value: "appearance", label: "Appearance" },
  { value: "dashboard", label: "Dashboard" },
  { value: "connections", label: "Connections" },
  { value: "data", label: "Data" },
  { value: "advanced", label: "Advanced" },
];

/**
 * Settings, beside the dashboard. Every change applies (and saves) as you
 * make it: there's no Save button and no reload.
 */
export default function SettingsPanel({ section }: { section: SettingsSection }) {
  const settings = useSettingsStore((state) => state.settings);
  const persistSettings = useSettingsStore((state) => state.persistSettings);
  const openSettings = useSidePanelStore((state) => state.openSettings);
  const { setThemeMode, setThemePalette, setCustomThemeVars } = React.useContext(ThemeContext);
  const [storageState, setStorageState] = React.useState<Awaited<ReturnType<typeof getStorageDiagnostics>> | null>(null);
  const [status, setStatus] = React.useState("");

  const updateSettings = React.useCallback(
    (updater: (settings: StartupSettings) => StartupSettings) => {
      void persistSettings(updater);
    },
    [persistSettings],
  );

  React.useEffect(() => {
    if (section === "data") void getStorageDiagnostics().then(setStorageState);
  }, [section]);

  // Import, restore and reset replace settings wholesale.
  const applySettings = React.useCallback(
    async (next: StartupSettings, message: string, options: { clearCustomThemeVars?: boolean; persisted?: boolean } = {}) => {
      if (options.persisted) useSettingsStore.setState({ settings: next });
      else await persistSettings(next);
      setThemeMode(next.ui?.themeMode);
      setThemePalette(next.ui?.themePalette || "zen");
      if (options.clearCustomThemeVars) setCustomThemeVars(null);
      setStatus(message);
      setStorageState(await getStorageDiagnostics());
    },
    [persistSettings, setThemeMode, setThemePalette, setCustomThemeVars],
  );

  const props = { settings, updateSettings };

  return (
    <PanelFrame title="Settings" subtitle="Changes apply as you make them." icon={<HiOutlineCog6Tooth className="size-4" />}>
      <nav className="settings-nav" aria-label="Settings sections">
        {SECTIONS.map((item) => (
          <button key={item.value} type="button" className="settings-nav-item" aria-current={section === item.value ? "page" : undefined} onClick={() => openSettings(item.value)}>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="settings-dialog settings-panel-body">
        {section === "general" && <GeneralSettings {...props} />}
        {section === "appearance" && (
          <>
            <ThemeSettings {...props} />
            <ImageEffectsSettings {...props} />
          </>
        )}
        {section === "dashboard" && <DashboardSettings {...props} />}
        {section === "connections" && <ConnectionsSettings />}
        {section === "data" && (
          <>
            <DataTab settings={settings} applySettings={applySettings} storageState={storageState} />
            {status && <p className="side-panel-note">{status}</p>}
          </>
        )}
        {section === "advanced" && <AdvancedSettings />}
      </div>
    </PanelFrame>
  );
}
