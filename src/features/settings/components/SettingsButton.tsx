import React, { useContext, useState } from "react";
import { HiOutlineCog6Tooth } from "react-icons/hi2";

import { ThemeContext } from "@/components/layout/ThemeContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { settingsNavItems } from "@/features/settings/constants";
import { getStorageDiagnostics } from "@/lib/settings";
import { useSettingsStore, type StartupSettings } from "@/features/settings/stores";
import AppearanceTab from "@/features/settings/components/appearance/AppearanceTab";
import { merge3 } from "@/lib/sync/merge";
import DataTab from "@/features/settings/components/DataTab";

function SettingsButton() {
  const savedSettings = useSettingsStore((state) => state.settings);
  const reloadSettings = useSettingsStore((state) => state.reloadSettings);
  const persistSettingsToStore = useSettingsStore((state) => state.persistSettings);
  const { themeMode, setThemeMode, themePalette, setThemePalette, setCustomThemeVars } = useContext(ThemeContext);
  const [open, setOpen] = useState(false);
  const [settingsState, setSettingsState] = useState(savedSettings);
  // The settings the dialog started from. Saving applies only what was
  // changed in the dialog, so anything synced in meanwhile isn't reverted.
  const dialogBaseRef = React.useRef<StartupSettings>(savedSettings);
  const [storageState, setStorageState] = useState<Awaited<ReturnType<typeof getStorageDiagnostics>> | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  const refreshStorageDiagnostics = React.useCallback(async () => {
    const nextDiagnostics = await getStorageDiagnostics();
    setStorageState(nextDiagnostics);
  }, []);

  React.useEffect(() => {
    void refreshStorageDiagnostics();
  }, [refreshStorageDiagnostics]);

  const openModal = () => {
    const freshSettings = reloadSettings();
    dialogBaseRef.current = freshSettings;
    setSettingsState(freshSettings);
    setThemeMode(freshSettings.ui.themeMode);
    setThemePalette(freshSettings.ui.themePalette || "zen");
    void refreshStorageDiagnostics();
    setOpen(true);
  };

  const closeModal = (nextOpen: boolean) => {
    if (nextOpen) {
      setOpen(true);
      return;
    }

    const freshSettings = reloadSettings();
    setSettingsState(freshSettings);
    setThemeMode(freshSettings.ui.themeMode);
    setThemePalette(freshSettings.ui.themePalette || "zen");
    setOpen(false);
  };

  const updateSettings = (updater: (settings: StartupSettings) => StartupSettings) => {
    setSettingsState((prevSettings) => updater(prevSettings));
  };

  // Shared by Data-tab actions (import apply, backup restore, reset) that all
  // need to replace settingsState wholesale and keep the live theme preview,
  // the settings store, and the storage diagnostics footer in sync.
  const applySettings = React.useCallback(
    async (nextSettings: StartupSettings, message: string, options: { clearCustomThemeVars?: boolean; persisted?: boolean } = {}) => {
      // An import is only applied on Save, so it stays a change against the
      // saved settings; a reset or restore has already been saved.
      if (options.persisted) dialogBaseRef.current = nextSettings;
      useSettingsStore.setState({ settings: nextSettings });
      setSettingsState(nextSettings);
      setThemeMode(nextSettings.ui.themeMode);
      setThemePalette(nextSettings.ui.themePalette || "zen");
      if (options.clearCustomThemeVars) {
        setCustomThemeVars(null);
      }
      setStatusMessage(message);
      await refreshStorageDiagnostics();
    },
    [refreshStorageDiagnostics, setThemeMode, setThemePalette, setCustomThemeVars]
  );

  const handleSave = async () => {
    // Apply the dialog's changes on top of the current settings, which may
    // have picked up synced edits while the dialog was open.
    await persistSettingsToStore((current) => merge3(dialogBaseRef.current, settingsState, current).value);
    setThemeMode(settingsState.ui.themeMode);
    setThemePalette(settingsState.ui.themePalette || "zen");
    setStatusMessage(`Saved settings at ${new Date().toLocaleString()}.`);
    await refreshStorageDiagnostics();
    setOpen(false);
    window.location.reload();
  };

  const selectedThemeMode = settingsState.ui?.themeMode || themeMode;
  const selectedThemePalette = settingsState.ui?.themePalette || themePalette;

  return (
    <Dialog open={open} onOpenChange={closeModal}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="toolbar-button"
          onClick={openModal}
          aria-label="Open workspace settings"
          title="Settings"
        >
          <HiOutlineCog6Tooth />
        </button>
      </DialogTrigger>
      <DialogContent className="settings-dialog w-[min(92vw,1040px)] border-border/60 bg-background p-0 text-[13px] [&_[data-slot=card]]:rounded-xl [&_[data-slot=card]]:shadow-none [&_[data-slot=card-header]]:gap-1 [&_[data-slot=card-header]]:p-4 [&_[data-slot=card-content]]:p-4 [&_[data-slot=card-content]]:pt-0 [&_[data-slot=card-title]]:text-[15px] [&_[data-slot=card-title]]:tracking-tight [&_[data-slot=card-description]]:text-[13px] [&_[data-slot=tabs-trigger]]:px-3 [&_[data-slot=tabs-trigger]]:py-2 [&_[data-slot=tabs-trigger]]:text-[13px] [&_[data-slot=input]]:h-9 [&_[data-slot=input]]:text-[13px] [&_[data-slot=button]]:h-8 [&_[data-slot=button]]:px-3 [&_[data-slot=button]]:text-[13px]">
        <Tabs defaultValue="appearance" orientation="vertical" className="grid min-h-[76vh] lg:grid-cols-[160px_1fr] gap-0">
          <div className="border-b border-border bg-sidebar text-sidebar-foreground lg:border-r lg:border-b-0">
            <div className="p-2.5">
              <DialogHeader>
                <DialogTitle className="font-serif text-xl tracking-tight">Settings</DialogTitle>
                <DialogDescription className="text-xs leading-snug">
                  Changes preview live. Save to keep them.
                </DialogDescription>
              </DialogHeader>
            </div>
            <TabsList className="mx-2 mb-2 bg-transparent p-0">
              {settingsNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <TabsTrigger key={item.value} value={item.value} className="w-full justify-start">
                    <Icon className="size-3.5" />
                    {item.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          <div className="flex flex-col">
            <div className="max-h-[76vh] overflow-y-auto p-2.5 md:p-3">
              <TabsContent value="appearance" className="mt-0 space-y-3">
                <AppearanceTab settings={settingsState} updateSettings={updateSettings} />
              </TabsContent>

              <TabsContent value="data" className="mt-0">
                <DataTab settings={settingsState} applySettings={applySettings} storageState={storageState} />
              </TabsContent>
            </div>

            <div className="border-t border-border bg-card/60 px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>
                    Active preview: <span className="font-medium text-foreground">{selectedThemePalette}</span> in <span className="font-medium text-foreground">{selectedThemeMode}</span> mode
                  </p>
                  {statusMessage ? <p className="text-foreground">{statusMessage}</p> : null}
                </div>
                <div className="flex gap-3">
                  <Button type="button" onClick={handleSave}>
                    Save and reload
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default SettingsButton;
