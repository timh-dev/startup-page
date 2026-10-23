import React, { useContext, useState } from "react";
import { HiOutlineCog } from "react-icons/hi2";

import { ThemeContext, type ThemeMode, type ThemeVarsByMode } from "@/components/layout/ThemeContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  IMAGE_FILTER_DEFAULTS,
  IMAGE_FILTER_DEFINITIONS,
  type ImageFilterPreset,
} from "@/lib/image-filters";
import { settingsNavItems } from "@/features/settings/constants";
import {
  BUILT_IN_PALETTES,
  getSwatchesFromCustomTheme,
  parseCustomThemeCSS,
} from "@/lib/theme-palettes";
import { cn } from "@/lib/utils";
import { getStorageDiagnostics } from "@/lib/settings";
import { useSettingsStore, type StartupSettings } from "@/features/settings/stores";
import DataTab from "@/features/settings/components/DataTab";

type Swatches = Record<string, string>;

interface CustomTheme {
  id: string;
  name: string;
  light: Record<string, string>;
  dark: Record<string, string>;
}

function PaletteSwatchPreview({ swatches, mode }: { swatches: { light: Swatches; dark: Swatches }; mode: string }) {
  const modeSwatches = mode === "dark" ? swatches.dark : swatches.light;
  const keys = ["background", "card", "primary", "accent", "muted"];
  return (
    <div className="mb-2 flex h-12 items-center justify-center gap-1.5 rounded-md border border-border/40 bg-muted/30">
      {keys.map((key) => (
        <div
          key={key}
          className="size-5 rounded-full border border-border/60 shadow-sm"
          style={{ backgroundColor: modeSwatches[key] }}
          title={key}
        />
      ))}
    </div>
  );
}

function SettingField({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-foreground">{label}</Label>
      {children}
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
    </div>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-xs text-foreground">{label}</Label>
        <span className="text-xs font-medium text-muted-foreground">{Number(value).toFixed(step >= 1 ? 0 : 2)}</span>
      </div>
      <Slider
        value={[Number(value)]}
        min={min}
        max={max}
        step={step}
        onValueChange={(nextValue) => onChange(nextValue[0])}
      />
    </div>
  );
}

function ChoiceButton({ selected, title, description, onClick }: { selected: boolean; title: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border p-2.5 text-left text-xs transition",
        selected
          ? "border-primary bg-accent text-accent-foreground shadow-sm"
          : "border-border bg-card hover:bg-accent/50"
      )}
    >
      <div className="font-medium leading-tight">{title}</div>
      <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{description}</div>
    </button>
  );
}

function SettingsButton() {
  const savedSettings = useSettingsStore((state) => state.settings);
  const reloadSettings = useSettingsStore((state) => state.reloadSettings);
  const persistSettingsToStore = useSettingsStore((state) => state.persistSettings);
  const { theme, themeMode, setThemeMode, themePalette, setThemePalette, setCustomThemeVars } = useContext(ThemeContext);
  const [open, setOpen] = useState(false);
  const [settingsState, setSettingsState] = useState(savedSettings);
  const [storageState, setStorageState] = useState<Awaited<ReturnType<typeof getStorageDiagnostics>> | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [customThemeName, setCustomThemeName] = useState("");
  const [customThemeCSS, setCustomThemeCSS] = useState("");
  const [customThemeError, setCustomThemeError] = useState("");

  const refreshStorageDiagnostics = React.useCallback(async () => {
    const nextDiagnostics = await getStorageDiagnostics();
    setStorageState(nextDiagnostics);
  }, []);

  React.useEffect(() => {
    void refreshStorageDiagnostics();
  }, [refreshStorageDiagnostics]);

  const openModal = () => {
    const freshSettings = reloadSettings();
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

  const handleUiChange = (key: string, value: unknown) => {
    updateSettings((prevSettings: StartupSettings) => ({
      ...prevSettings,
      ui: {
        ...prevSettings.ui,
        [key]: value
      }
    }));
  };

  const handleThemeModeChange = (value: ThemeMode) => {
    handleUiChange("themeMode", value);
    setThemeMode(value);
  };

  const handleThemePaletteChange = (value: string, customVars: ThemeVarsByMode | null = null) => {
    handleUiChange("themePalette", value);
    setThemePalette(value);
    setCustomThemeVars(customVars || null);
  };

  const handleAddCustomTheme = () => {
    setCustomThemeError("");
    const name = customThemeName.trim();
    if (!name) {
      setCustomThemeError("Please enter a theme name.");
      return;
    }

    try {
      const parsed = parseCustomThemeCSS(customThemeCSS);
      const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newTheme = { id, name, light: parsed.light, dark: parsed.dark };

      updateSettings((prev: StartupSettings) => ({
        ...prev,
        customThemes: [...(prev.customThemes || []), newTheme],
      }));

      setCustomThemeName("");
      setCustomThemeCSS("");
    } catch (err) {
      setCustomThemeError(err.message);
    }
  };

  const handleRemoveCustomTheme = (themeId: string) => {
    updateSettings((prev: StartupSettings) => ({
      ...prev,
      customThemes: (prev.customThemes || []).filter((ct: CustomTheme) => ct.id !== themeId),
    }));

    if (settingsState.ui?.themePalette === themeId) {
      handleThemePaletteChange("zen", null);
    }
  };

  const handleImageFilterToggle = (filterKey: string, checked: boolean) => {
    updateSettings((prevSettings: StartupSettings) => ({
      ...prevSettings,
      ui: {
        ...prevSettings.ui,
        imageEffects: {
          enabledFilters: {
            ...IMAGE_FILTER_DEFAULTS.enabledFilters,
            ...prevSettings.ui?.imageEffects?.enabledFilters,
            [filterKey]: checked,
          },
          filterSettings: {
            ...IMAGE_FILTER_DEFAULTS.filterSettings,
            ...prevSettings.ui?.imageEffects?.filterSettings,
          },
        },
      },
    }));
  };

  const handleImageFilterSettingChange = (filterKey: string, settingKey: string, value: number | boolean) => {
    updateSettings((prevSettings: StartupSettings) => ({
      ...prevSettings,
      ui: {
        ...prevSettings.ui,
        imageEffects: {
          enabledFilters: {
            ...IMAGE_FILTER_DEFAULTS.enabledFilters,
            ...prevSettings.ui?.imageEffects?.enabledFilters,
          },
          filterSettings: {
            ...IMAGE_FILTER_DEFAULTS.filterSettings,
            ...prevSettings.ui?.imageEffects?.filterSettings,
            [filterKey]: {
              ...IMAGE_FILTER_DEFAULTS.filterSettings[filterKey],
              ...prevSettings.ui?.imageEffects?.filterSettings?.[filterKey],
              [settingKey]: value,
            },
          },
        },
      },
    }));
  };

  const handleImageFilterPreset = (filterKey: string, preset: ImageFilterPreset) => {
    updateSettings((prevSettings: StartupSettings) => ({
      ...prevSettings,
      ui: {
        ...prevSettings.ui,
        imageEffects: {
          enabledFilters: {
            ...IMAGE_FILTER_DEFAULTS.enabledFilters,
            ...prevSettings.ui?.imageEffects?.enabledFilters,
          },
          filterSettings: {
            ...IMAGE_FILTER_DEFAULTS.filterSettings,
            ...prevSettings.ui?.imageEffects?.filterSettings,
            [filterKey]: { ...preset.params },
          },
        },
      },
    }));
  };

  // Shared by Data-tab actions (import apply, backup restore, reset) that all
  // need to replace settingsState wholesale and keep the live theme preview,
  // the settings store, and the storage diagnostics footer in sync.
  const applySettings = React.useCallback(
    async (nextSettings: StartupSettings, message: string, options: { clearCustomThemeVars?: boolean } = {}) => {
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
    await persistSettingsToStore(settingsState);
    setThemeMode(settingsState.ui.themeMode);
    setThemePalette(settingsState.ui.themePalette || "zen");
    setStatusMessage(`Saved settings at ${new Date().toLocaleString()}.`);
    await refreshStorageDiagnostics();
    setOpen(false);
    window.location.reload();
  };

  const selectedThemeMode = settingsState.ui?.themeMode || themeMode;
  const selectedThemePalette = settingsState.ui?.themePalette || themePalette;
  const selectedGridDensity = settingsState.ui?.gridDensity || "comfortable";
  const selectedCardStyle = settingsState.ui?.cardStyle || "rounded";
  const selectedClockFormat = settingsState.ui?.clockFormat || "12h";
  const imageEffects = settingsState.ui?.imageEffects || IMAGE_FILTER_DEFAULTS;

  return (
    <Dialog open={open} onOpenChange={closeModal}>
      <DialogTrigger asChild>
        <button
          className="text-current text-4xl cursor-pointer"
          onClick={openModal}
          aria-label="Open workspace settings"
          title="Workspace settings"
        >
          <HiOutlineCog />
        </button>
      </DialogTrigger>
      <DialogContent className="settings-dialog w-[min(92vw,980px)] border-border/60 bg-background/98 p-0 text-[11px] [&_[data-slot=card]]:rounded-lg [&_[data-slot=card-header]]:gap-0.5 [&_[data-slot=card-header]]:p-2.5 [&_[data-slot=card-content]]:p-2.5 [&_[data-slot=card-content]]:pt-0 [&_[data-slot=card-title]]:text-[13px] [&_[data-slot=card-description]]:text-[11px] [&_[data-slot=tabs-trigger]]:px-2 [&_[data-slot=tabs-trigger]]:py-1.5 [&_[data-slot=tabs-trigger]]:text-[11px] [&_[data-slot=input]]:h-7 [&_[data-slot=input]]:text-[11px] [&_[data-slot=button]]:h-7 [&_[data-slot=button]]:px-2.5 [&_[data-slot=button]]:text-[11px]">
        <Tabs defaultValue="appearance" orientation="vertical" className="grid min-h-[76vh] lg:grid-cols-[160px_1fr] gap-0">
          <div className="border-b border-border bg-sidebar text-sidebar-foreground lg:border-r lg:border-b-0">
            <div className="p-2.5">
              <DialogHeader>
                <DialogTitle className="font-serif text-base">Workspace Settings</DialogTitle>
                <DialogDescription className="text-xs leading-snug">
                  Built on the new shadcn-style UI layer with live theme and palette preview.
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
                <Card>
                  <CardHeader>
                    <CardTitle>Theme Mode</CardTitle>
                    <CardDescription>Choose how light and dark mode should be resolved.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-2 md:grid-cols-3">
                    {([
                      { value: "system", title: "System", description: "Follow the OS preference." },
                      { value: "light", title: "Light", description: "Force the brighter variant." },
                      { value: "dark", title: "Dark", description: "Force the darker variant." }
                    ] satisfies Array<{ value: ThemeMode; title: string; description: string }>).map((option) => (
                      <ChoiceButton
                        key={option.value}
                        selected={selectedThemeMode === option.value}
                        title={option.title}
                        description={option.description}
                        onClick={() => handleThemeModeChange(option.value)}
                      />
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Theme Palette</CardTitle>
                    <CardDescription>Switch the base visual language of the interface.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-2 lg:grid-cols-3">
                    {BUILT_IN_PALETTES.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleThemePaletteChange(option.value)}
                        className={cn(
                          "rounded-md border p-2.5 text-left transition",
                          selectedThemePalette === option.value
                            ? "border-primary bg-accent shadow-sm"
                            : "border-border bg-card hover:bg-accent/50"
                        )}
                      >
                        <PaletteSwatchPreview swatches={option.swatches} mode={theme} />
                        <div className="text-xs font-medium leading-tight">{option.title}</div>
                        <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{option.description}</div>
                      </button>
                    ))}
                    {(settingsState.customThemes || []).map((ct: CustomTheme) => {
                      const swatches = {
                        light: getSwatchesFromCustomTheme(ct, "light"),
                        dark: getSwatchesFromCustomTheme(ct, "dark"),
                      };
                      return (
                        <button
                          key={ct.id}
                          type="button"
                          onClick={() => handleThemePaletteChange(ct.id, { light: ct.light, dark: ct.dark })}
                          className={cn(
                            "rounded-md border p-2.5 text-left transition",
                            selectedThemePalette === ct.id
                              ? "border-primary bg-accent shadow-sm"
                              : "border-border bg-card hover:bg-accent/50"
                          )}
                        >
                          <PaletteSwatchPreview swatches={swatches} mode={theme} />
                          <div className="text-xs font-medium leading-tight">{ct.name}</div>
                          <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">Custom theme</div>
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Custom Theme</CardTitle>
                    <CardDescription>
                      Paste CSS from a shadcn theme generator. Use <code>:root</code> for light and <code>.dark</code> for dark mode variables.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <SettingField label="Theme Name">
                      <Input
                        value={customThemeName}
                        onChange={(e) => setCustomThemeName(e.target.value)}
                        placeholder="My Custom Theme"
                      />
                    </SettingField>
                    <SettingField label="CSS Variables">
                      <textarea
                        className="w-full rounded-lg border border-border bg-card p-3 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        rows={8}
                        value={customThemeCSS}
                        onChange={(e) => setCustomThemeCSS(e.target.value)}
                        placeholder={`:root {\n  --background: oklch(0.98 0.01 250);\n  --primary: oklch(0.55 0.2 260);\n  /* ... */\n}\n.dark {\n  --background: oklch(0.2 0.02 260);\n  /* ... */\n}`}
                      />
                    </SettingField>
                    {customThemeError ? (
                      <p className="text-xs text-destructive">{customThemeError}</p>
                    ) : null}
                    <Button type="button" onClick={handleAddCustomTheme}>
                      Add Theme
                    </Button>

                    {(settingsState.customThemes || []).length > 0 ? (
                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-medium text-foreground">Saved Custom Themes</p>
                        {(settingsState.customThemes || []).map((ct: CustomTheme) => (
                          <div key={ct.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2">
                            <span className="text-sm">{ct.name}</span>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleRemoveCustomTheme(ct.id)}
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                <div className="grid gap-6 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Grid Density</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                      {["comfortable", "compact"].map((value) => (
                        <ChoiceButton
                          key={value}
                          selected={selectedGridDensity === value}
                          title={value.charAt(0).toUpperCase() + value.slice(1)}
                          description={value === "comfortable" ? "More air between modules." : "Tighter dashboard packing."}
                          onClick={() => handleUiChange("gridDensity", value)}
                        />
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Card Shape</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                      {["soft", "rounded", "sharp"].map((value) => (
                        <ChoiceButton
                          key={value}
                          selected={selectedCardStyle === value}
                          title={value.charAt(0).toUpperCase() + value.slice(1)}
                          description={value === "soft" ? "Large rounded corners." : value === "sharp" ? "Crisper corners." : "Balanced default radius."}
                          onClick={() => handleUiChange("cardStyle", value)}
                        />
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Clock Format</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                      {["12h", "24h"].map((value) => (
                        <ChoiceButton
                          key={value}
                          selected={selectedClockFormat === value}
                          title={value === "12h" ? "12-hour" : "24-hour"}
                          description={value === "12h" ? "Hours 1–12 (e.g. 9:45)." : "Hours 0–23 (e.g. 21:45)."}
                          onClick={() => handleUiChange("clockFormat", value)}
                        />
                      ))}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Atmosphere</CardTitle>
                    <CardDescription>Decorative tiles can be disabled without affecting the data modules.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">Decorative media tiles</p>
                      <p className="text-sm text-muted-foreground">Show or hide the looping desert video modules.</p>
                    </div>
                    <Switch
                      checked={settingsState.ui?.showDecorativeMedia ?? true}
                      onCheckedChange={(checked) => handleUiChange("showDecorativeMedia", checked)}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Features</CardTitle>
                    <CardDescription>Turn off a dedicated page and its nav icon/shortcut — dashboard widgets keep working either way.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium">Resource Vault</p>
                        <p className="text-sm text-muted-foreground">The Resource Vault page and its nav icon/shortcut.</p>
                      </div>
                      <Switch
                        checked={settingsState.ui?.vaultEnabled ?? true}
                        onCheckedChange={(checked) => handleUiChange("vaultEnabled", checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium">Bookmarks</p>
                        <p className="text-sm text-muted-foreground">The Bookmarks page and its nav icon/shortcut.</p>
                      </div>
                      <Switch
                        checked={settingsState.ui?.bookmarksEnabled ?? true}
                        onCheckedChange={(checked) => handleUiChange("bookmarksEnabled", checked)}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Image Effects</CardTitle>
                    <CardDescription>
                      Enable one or more filters for photo tiles. When multiple filters are enabled, each image tile picks one at random.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {IMAGE_FILTER_DEFINITIONS.map((filter) => {
                      const enabled = imageEffects.enabledFilters?.[filter.key] || false;
                      const filterSettings = imageEffects.filterSettings?.[filter.key] || IMAGE_FILTER_DEFAULTS.filterSettings[filter.key];

                      return (
                        <div key={filter.key} className="rounded-xl border border-border p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="font-medium">{filter.label}</p>
                              <p className="text-sm text-muted-foreground">
                                {enabled ? "Active and eligible for random image selection." : "Disabled."}
                              </p>
                            </div>
                            <Switch
                              checked={enabled}
                              onCheckedChange={(checked) => handleImageFilterToggle(filter.key, checked)}
                            />
                          </div>

                          {enabled ? (
                            <div className="mt-4 space-y-4">
                              <div className="flex flex-wrap gap-2">
                                {filter.presets.map((preset) => (
                                  <Button
                                    key={preset.name}
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleImageFilterPreset(filter.key, preset)}
                                  >
                                    {preset.name}
                                  </Button>
                                ))}
                              </div>
                              <div className="grid gap-4 md:grid-cols-2">
                                {filter.controls.map((control) => {
                                  const controlValue = filterSettings[control.key];
                                  if (control.type === "boolean") {
                                    return (
                                      <div key={control.key} className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                                        <Label className="text-sm text-foreground">{control.label}</Label>
                                        <Switch
                                          checked={Boolean(controlValue)}
                                          onCheckedChange={(checked) =>
                                            handleImageFilterSettingChange(filter.key, control.key, checked)
                                          }
                                        />
                                      </div>
                                    );
                                  }

                                  return (
                                    <RangeControl
                                      key={control.key}
                                      label={control.label}
                                      value={Number(controlValue)}
                                      min={control.min}
                                      max={control.max}
                                      step={control.step}
                                      onChange={(value: number) =>
                                        handleImageFilterSettingChange(filter.key, control.key, value)
                                      }
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Tile Size</CardTitle>
                    <CardDescription>Scale how large each dashboard tile appears. Takes effect after saving.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <RangeControl
                      label="Size (rem)"
                      value={settingsState.ui?.tileSize ?? 9}
                      min={7}
                      max={14}
                      step={1}
                      onChange={(value: number) => handleUiChange("tileSize", value)}
                    />
                    <RangeControl
                      label="Bookmark pill size (rem)"
                      value={settingsState.ui?.bookmarkPillSize ?? 3.25}
                      min={2.5}
                      max={5}
                      step={0.25}
                      onChange={(value: number) => handleUiChange("bookmarkPillSize", value)}
                    />
                  </CardContent>
                </Card>
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
