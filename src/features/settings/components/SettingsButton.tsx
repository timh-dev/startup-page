import React, { useContext, useState } from "react";
import { HiOutlineCog } from "react-icons/hi2";
import { ALL_MODES as ALL_FEATURE_MODES } from "@/features/dashboard/components/FeaturePanel";
import {
  DEFAULT_SEARCH_ENGINES,
  SEARCH_ICON_OPTIONS,
  getSearchEngineIcon,
} from "@/features/dashboard/searchEngines";

import { ThemeContext } from "@/components/layout/ThemeContext";
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
} from "@/lib/image-filters";
import { settingsNavItems, visibilityOptions } from "@/features/settings/constants";
import {
  BUILT_IN_PALETTES,
  getSwatchesFromCustomTheme,
  parseCustomThemeCSS,
} from "@/lib/theme-palettes";
import { cn } from "@/lib/utils";
import {
  createSettingsExportFilename,
  exportSettingsBlob,
  getStorageDiagnostics,
  importSettingsFromFile,
  resetSettings,
} from "@/lib/settings";
import { useSettingsStore } from "@/features/settings/stores";

function PaletteSwatchPreview({ swatches, mode }) {
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

function SettingField({ label, description, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-foreground">{label}</Label>
      {children}
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
    </div>
  );
}

function RangeControl({ label, value, min, max, step, onChange }) {
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

function ChoiceButton({ selected, title, description, onClick }) {
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
  const [storageState, setStorageState] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [customThemeName, setCustomThemeName] = useState("");
  const [customThemeCSS, setCustomThemeCSS] = useState("");
  const [customThemeError, setCustomThemeError] = useState("");
  const fileInputRef = React.useRef(null);
  const [newTopicInputs, setNewTopicInputs] = useState({});

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

  const closeModal = (nextOpen) => {
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

  const updateSettings = (updater) => {
    setSettingsState((prevSettings) => updater(prevSettings));
  };

  const handleTopLevelChange = (key, value) => {
    updateSettings((prevSettings) => ({
      ...prevSettings,
      [key]: value
    }));
  };

  const handleUiChange = (key, value) => {
    updateSettings((prevSettings) => ({
      ...prevSettings,
      ui: {
        ...prevSettings.ui,
        [key]: value
      }
    }));
  };

  const handleNewsChange = (key, value) => {
    updateSettings((prevSettings) => ({
      ...prevSettings,
      news: {
        ...prevSettings.news,
        [key]: value,
      },
    }));
  };

  const handleTimerChange = (key, value) => {
    updateSettings((prevSettings) => ({
      ...prevSettings,
      timer: {
        ...prevSettings.timer,
        [key]: value,
      },
    }));
  };

  const getDecorativeVideoUrlsForEdit = (decorativeVideo) =>
    decorativeVideo?.urls?.length ? decorativeVideo.urls : [""];

  const handleDecorativeVideoUrlChange = (index, value) => {
    setSettingsState((prev) => {
      const decorativeVideo = prev.decorativeVideo || {};
      const urls = [...getDecorativeVideoUrlsForEdit(decorativeVideo)];

      urls[index] = value;

      return {
        ...prev,
        decorativeVideo: {
          ...decorativeVideo,
          urls: urls.slice(0, 10),
          zoom: decorativeVideo.zoom ?? decorativeVideo.tall?.zoom ?? 1.6,
          offsetX: decorativeVideo.offsetX ?? decorativeVideo.tall?.offsetX ?? 0,
          offsetY: decorativeVideo.offsetY ?? decorativeVideo.tall?.offsetY ?? 0,
        },
      };
    });
  };

  const handleAddDecorativeVideoUrl = () => {
    setSettingsState((prev) => {
      const decorativeVideo = prev.decorativeVideo || {};
      const urls = getDecorativeVideoUrlsForEdit(decorativeVideo);

      return {
        ...prev,
        decorativeVideo: {
          ...decorativeVideo,
          urls: [...urls, ""].slice(0, 10),
        },
      };
    });
  };

  const handleRemoveDecorativeVideoUrl = (index) => {
    setSettingsState((prev) => {
      const decorativeVideo = prev.decorativeVideo || {};
      const urls = getDecorativeVideoUrlsForEdit(decorativeVideo).filter(
        (_, currentIndex) => currentIndex !== index
      );

      return {
        ...prev,
        decorativeVideo: {
          ...decorativeVideo,
          urls: urls.length ? urls : [""],
        },
      };
    });
  };

  const handleDecorativeVideoChange = (key, value) => {
    setSettingsState((prev) => {
      const decorativeVideo = prev.decorativeVideo || {};

      return {
        ...prev,
        decorativeVideo: {
          ...decorativeVideo,
          urls: getDecorativeVideoUrlsForEdit(decorativeVideo).slice(0, 10),
          zoom: decorativeVideo.zoom ?? decorativeVideo.tall?.zoom ?? 1.6,
          offsetX: decorativeVideo.offsetX ?? decorativeVideo.tall?.offsetX ?? 0,
          offsetY: decorativeVideo.offsetY ?? decorativeVideo.tall?.offsetY ?? 0,
          [key]: value,
        },
      };
    });
  };

  const handleThemeModeChange = (value) => {
    handleUiChange("themeMode", value);
    setThemeMode(value);
  };

  const handleThemePaletteChange = (value, customVars) => {
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

      updateSettings((prev) => ({
        ...prev,
        customThemes: [...(prev.customThemes || []), newTheme],
      }));

      setCustomThemeName("");
      setCustomThemeCSS("");
    } catch (err) {
      setCustomThemeError(err.message);
    }
  };

  const handleRemoveCustomTheme = (themeId) => {
    updateSettings((prev) => ({
      ...prev,
      customThemes: (prev.customThemes || []).filter((ct) => ct.id !== themeId),
    }));

    if (settingsState.ui?.themePalette === themeId) {
      handleThemePaletteChange("zen", null);
    }
  };

  const handleImageFilterToggle = (filterKey, checked) => {
    updateSettings((prevSettings) => ({
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

  const handleImageFilterSettingChange = (filterKey, settingKey, value) => {
    updateSettings((prevSettings) => ({
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

  const handleImageFilterPreset = (filterKey, preset) => {
    updateSettings((prevSettings) => ({
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

  const handleHiddenBoxChange = (boxId, checked) => {
    updateSettings((prevSettings) => ({
      ...prevSettings,
      layout: {
        ...prevSettings.layout,
        hiddenBoxes: {
          ...prevSettings.layout.hiddenBoxes,
          [boxId]: !checked
        }
      }
    }));
  };

  const handleAddUnsplashTopic = (key) => {
    const value = (newTopicInputs[key] || "").trim();
    if (!value) return;
    updateSettings((prevSettings) => ({
      ...prevSettings,
      unsplash: {
        ...prevSettings.unsplash,
        [key]: [...(prevSettings.unsplash[key] || []), value],
      },
    }));
    setNewTopicInputs((prev) => ({ ...prev, [key]: "" }));
  };

  const handleRemoveUnsplashTopic = (key, index) => {
    updateSettings((prevSettings) => ({
      ...prevSettings,
      unsplash: {
        ...prevSettings.unsplash,
        [key]: prevSettings.unsplash[key].filter((_, i) => i !== index),
      },
    }));
  };

  const handleFeaturePanelChange = (key, value) => {
    updateSettings((prevSettings) => ({
      ...prevSettings,
      featurePanel: {
        ...prevSettings.featurePanel,
        [key]: value,
      },
    }));
  };

  const handleFeaturePanelModeToggle = (modeKey, checked) => {
    updateSettings((prevSettings) => {
      const current = prevSettings.featurePanel?.enabledModes ?? ALL_FEATURE_MODES.map((m) => m.key);
      const next = checked ? [...current, modeKey] : current.filter((k) => k !== modeKey);
      return {
        ...prevSettings,
        featurePanel: { ...prevSettings.featurePanel, enabledModes: next },
      };
    });
  };

  const getSearchEnginesForEdit = (prevSettings) =>
    Array.isArray(prevSettings.search?.engines) && prevSettings.search.engines.length
      ? prevSettings.search.engines
      : DEFAULT_SEARCH_ENGINES;

  const handleSearchEngineChange = (index, key, value) => {
    updateSettings((prevSettings) => {
      const engines = getSearchEnginesForEdit(prevSettings).map((engine, currentIndex) =>
        currentIndex === index ? { ...engine, [key]: value } : engine
      );
      return { ...prevSettings, search: { ...prevSettings.search, engines } };
    });
  };

  const handleAddSearchEngine = () => {
    updateSettings((prevSettings) => {
      const engines = [
        ...getSearchEnginesForEdit(prevSettings),
        { id: `engine-${Date.now()}`, name: "", url: "", icon: "search" },
      ];
      return { ...prevSettings, search: { ...prevSettings.search, engines } };
    });
  };

  const handleRemoveSearchEngine = (index) => {
    updateSettings((prevSettings) => {
      const engines = getSearchEnginesForEdit(prevSettings).filter(
        (_engine, currentIndex) => currentIndex !== index
      );
      return { ...prevSettings, search: { ...prevSettings.search, engines } };
    });
  };

  const handleMoveSearchEngine = (index, direction) => {
    updateSettings((prevSettings) => {
      const engines = [...getSearchEnginesForEdit(prevSettings)];
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= engines.length) {
        return prevSettings;
      }
      [engines[index], engines[nextIndex]] = [engines[nextIndex], engines[index]];
      return { ...prevSettings, search: { ...prevSettings.search, engines } };
    });
  };

  const handleBookmarkBoxCategoryChange = (boxIndex, value) => {
    updateSettings((prevSettings) => {
      const bookmarkBoxCategories = [...(prevSettings.layout?.bookmarkBoxCategories || [0, 1, 2, 3, 4])];
      bookmarkBoxCategories[boxIndex] = Number(value);

      return {
        ...prevSettings,
        layout: {
          ...prevSettings.layout,
          bookmarkBoxCategories,
        },
      };
    });
  };

  const handleReset = async () => {
    const resetResult = await resetSettings();
    useSettingsStore.setState({ settings: resetResult.settings });
    setSettingsState(resetResult.settings);
    setThemeMode(resetResult.settings.ui.themeMode);
    setThemePalette(resetResult.settings.ui.themePalette || "zen");
    setCustomThemeVars(null);
    setStatusMessage("Settings reset and backup history refreshed.");
    await refreshStorageDiagnostics();
  };

  const handleSave = async () => {
    await persistSettingsToStore(settingsState);
    setThemeMode(settingsState.ui.themeMode);
    setThemePalette(settingsState.ui.themePalette || "zen");
    setStatusMessage(`Saved settings at ${new Date().toLocaleString()}.`);
    await refreshStorageDiagnostics();
    setOpen(false);
    window.location.reload();
  };

  const handleExport = () => {
    const blob = exportSettingsBlob(settingsState);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = createSettingsExportFilename();
    link.click();
    URL.revokeObjectURL(url);
    setStatusMessage("Backup exported with metadata and schema version.");
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const importedResult = await importSettingsFromFile(file);
      useSettingsStore.setState({ settings: importedResult.settings });
      setSettingsState(importedResult.settings);
      setThemeMode(importedResult.settings.ui.themeMode);
      setThemePalette(importedResult.settings.ui.themePalette || "zen");
      setStatusMessage(
        importedResult.metadata.exportedAt
          ? `Backup imported successfully. Original export: ${new Date(importedResult.metadata.exportedAt).toLocaleString()}.`
          : "Backup imported successfully."
      );
      await refreshStorageDiagnostics();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Backup import failed.");
    }

    event.target.value = "";
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
                    {[
                      { value: "system", title: "System", description: "Follow the OS preference." },
                      { value: "light", title: "Light", description: "Force the brighter variant." },
                      { value: "dark", title: "Dark", description: "Force the darker variant." }
                    ].map((option) => (
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
                    {(settingsState.customThemes || []).map((ct) => {
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
                        {(settingsState.customThemes || []).map((ct) => (
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
                                      onChange={(value) =>
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
              </TabsContent>

              <TabsContent value="layout" className="mt-0 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Visible Modules</CardTitle>
                    <CardDescription>Turn tiles on or off while keeping the current grid structure intact.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2">
                    {visibilityOptions.map((option) => {
                      const isVisible = !settingsState.layout?.hiddenBoxes?.[option.id];
                      return (
                        <div key={option.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                          <div>
                            <p className="font-medium">{option.label}</p>
                            <p className="text-sm text-muted-foreground">{isVisible ? "Currently visible" : "Currently hidden"}</p>
                          </div>
                          <Switch checked={isVisible} onCheckedChange={(checked) => handleHiddenBoxChange(option.id, checked)} />
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
                      onChange={(value) => handleUiChange("tileSize", value)}
                    />
                    <RangeControl
                      label="Bookmark pill size (rem)"
                      value={settingsState.ui?.bookmarkPillSize ?? 3.25}
                      min={2.5}
                      max={5}
                      step={0.25}
                      onChange={(value) => handleUiChange("bookmarkPillSize", value)}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="content" className="mt-0 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Location and API Settings</CardTitle>
                    <CardDescription>Core values used by weather and photo modules.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <SettingField label="Latitude">
                      <Input
                        value={settingsState.latitude ?? ""}
                        onChange={(event) => handleTopLevelChange("latitude", event.target.value === "" ? null : Number(event.target.value))}
                      />
                    </SettingField>
                    <SettingField label="Longitude">
                      <Input
                        value={settingsState.longitude ?? ""}
                        onChange={(event) => handleTopLevelChange("longitude", event.target.value === "" ? null : Number(event.target.value))}
                      />
                    </SettingField>
                    <SettingField label="Units">
                      <select
                        className="h-9 w-full rounded-md border border-input bg-card px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        value={settingsState.units ?? "imperial"}
                        onChange={(event) => handleTopLevelChange("units", event.target.value)}
                      >
                        <option value="imperial">Imperial (°F, mph)</option>
                        <option value="metric">Metric (°C, km/h)</option>
                      </select>
                    </SettingField>
                    <SettingField label="OpenWeather Key">
                      <Input
                        value={settingsState.openWeatherCredential ?? ""}
                        onChange={(event) => handleTopLevelChange("openWeatherCredential", event.target.value || null)}
                      />
                    </SettingField>
                    <SettingField label="Unsplash Access Key" description="Use the Access Key, not the Secret Key." className="md:col-span-2">
                      <Input
                        value={settingsState.unsplashCredential ?? ""}
                        onChange={(event) => handleTopLevelChange("unsplashCredential", event.target.value || null)}
                      />
                    </SettingField>
                    <SettingField label="Default Timer Minutes">
                      <Input
                        value={settingsState.timer?.focusMinutes ?? 25}
                        onChange={(event) =>
                          handleTimerChange("focusMinutes", event.target.value === "" ? 25 : Number(event.target.value))
                        }
                      />
                    </SettingField>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Decorative Video</CardTitle>
                    <CardDescription>
                      Add up to 10 looping MP4 links. One is chosen at random on load, and both tiles look into the same shared scene.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-5">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium text-foreground">Video URLs</p>
                          <p className="text-xs text-muted-foreground">
                            Leave blanks empty. The saved list is capped at 10.
                          </p>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleAddDecorativeVideoUrl}
                          disabled={(settingsState.decorativeVideo?.urls ?? []).length >= 10}
                        >
                          Add link
                        </Button>
                      </div>

                      <div className="space-y-2">
                        {(settingsState.decorativeVideo?.urls?.length
                          ? settingsState.decorativeVideo.urls
                          : [""]
                        ).map((url, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <Input
                              value={url}
                              placeholder="https://example.com/video.mp4"
                              onChange={(event) =>
                                handleDecorativeVideoUrlChange(index, event.target.value)
                              }
                            />

                            {(settingsState.decorativeVideo?.urls?.length || 0) > 1 ? (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => handleRemoveDecorativeVideoUrl(index)}
                              >
                                Remove
                              </Button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
                      <p className="text-sm text-muted-foreground">
                        Move and scale the underlying shared video. The box positions stay fixed, but what you see through them changes together.
                      </p>

                      <RangeControl
                        label="Zoom"
                        value={
                          settingsState.decorativeVideo?.zoom ??
                          settingsState.decorativeVideo?.tall?.zoom ??
                          1.6
                        }
                        min={1}
                        max={3}
                        step={0.05}
                        onChange={(value) => handleDecorativeVideoChange("zoom", value)}
                      />

                      <RangeControl
                        label="Horizontal Offset"
                        value={
                          settingsState.decorativeVideo?.offsetX ??
                          settingsState.decorativeVideo?.tall?.offsetX ??
                          0
                        }
                        min={-180}
                        max={180}
                        step={1}
                        onChange={(value) => handleDecorativeVideoChange("offsetX", value)}
                      />

                      <RangeControl
                        label="Vertical Offset"
                        value={
                          settingsState.decorativeVideo?.offsetY ??
                          settingsState.decorativeVideo?.tall?.offsetY ??
                          0
                        }
                        min={-180}
                        max={180}
                        step={1}
                        onChange={(value) => handleDecorativeVideoChange("offsetY", value)}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Feature Panel</CardTitle>
                    <CardDescription>Choose which modes appear in the rotating feature panel and provide credentials for services that need them.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-foreground">Enabled Modes</p>
                      <div className="grid gap-2 md:grid-cols-2">
                        {ALL_FEATURE_MODES.map((mode) => {
                          const enabledModes = settingsState.featurePanel?.enabledModes ?? ALL_FEATURE_MODES.map((m) => m.key);
                          const enabled = enabledModes.includes(mode.key);
                          return (
                            <div key={mode.key} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
                              <p className="text-sm font-medium">{mode.label}</p>
                              <Switch checked={enabled} onCheckedChange={(checked) => handleFeaturePanelModeToggle(mode.key, checked)} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <p className="text-xs font-medium text-foreground">Credentials &amp; Config</p>
                      <SettingField label="GitHub Username" description="Used by the GitHub Activity mode.">
                        <Input
                          value={settingsState.featurePanel?.githubUsername ?? ""}
                          placeholder="e.g. torvalds"
                          onChange={(e) => handleFeaturePanelChange("githubUsername", e.target.value || null)}
                        />
                      </SettingField>
                      <SettingField label="RSS Feed URL" description="Any valid RSS or Atom feed URL.">
                        <Input
                          value={settingsState.featurePanel?.rssFeedUrl ?? ""}
                          placeholder="https://example.com/feed.xml"
                          onChange={(e) => handleFeaturePanelChange("rssFeedUrl", e.target.value || null)}
                        />
                      </SettingField>
                      <SettingField label="Spotify App Client ID" description="Create an app at developer.spotify.com and add this page's URL as a redirect URI.">
                        <Input
                          value={settingsState.featurePanel?.spotifyClientId ?? ""}
                          placeholder="e.g. 1a2b3c4d5e6f7890..."
                          onChange={(e) => handleFeaturePanelChange("spotifyClientId", e.target.value || null)}
                        />
                      </SettingField>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Search Engines</CardTitle>
                    <CardDescription>
                      Customize the buttons in the search box. Each engine needs a name, an icon, and a search URL that the typed query is appended to (e.g. <code>https://duckduckgo.com/?q=</code>). The first engine is selected by default.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {(settingsState.search?.engines?.length
                      ? settingsState.search.engines
                      : DEFAULT_SEARCH_ENGINES
                    ).map((engine, index, engines) => {
                      const EngineIcon = getSearchEngineIcon(engine.icon);
                      return (
                        <div key={engine.id ?? index} className="rounded-xl border border-border bg-muted/25 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="flex size-7 items-center justify-center rounded-full border border-border/60 bg-card">
                                <EngineIcon className="size-4" aria-hidden="true" />
                              </span>
                              <p className="text-sm font-medium">{engine.name || "Untitled engine"}</p>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleMoveSearchEngine(index, -1)}
                                disabled={index === 0}
                                aria-label="Move engine up"
                              >
                                ↑
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleMoveSearchEngine(index, 1)}
                                disabled={index === engines.length - 1}
                                aria-label="Move engine down"
                              >
                                ↓
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleRemoveSearchEngine(index)}
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                            <SettingField label="Name">
                              <Input
                                value={engine.name}
                                placeholder="e.g. YouTube"
                                onChange={(event) => handleSearchEngineChange(index, "name", event.target.value)}
                              />
                            </SettingField>
                            <SettingField label="Search URL">
                              <Input
                                value={engine.url}
                                placeholder="https://example.com/search?q="
                                onChange={(event) => handleSearchEngineChange(index, "url", event.target.value)}
                              />
                            </SettingField>
                            <SettingField label="Icon">
                              <select
                                className="h-9 w-full rounded-md border border-input bg-card px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                value={engine.icon || "search"}
                                onChange={(event) => handleSearchEngineChange(index, "icon", event.target.value)}
                              >
                                {SEARCH_ICON_OPTIONS.map((option) => (
                                  <option key={option.key} value={option.key}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </SettingField>
                          </div>
                        </div>
                      );
                    })}
                    <Button type="button" variant="outline" onClick={handleAddSearchEngine}>
                      Add engine
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Headline Source</CardTitle>
                    <CardDescription>Controls the rotating hero headlines in the large feature panel.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <SettingField label="Subreddit">
                      <Input
                        value={settingsState.news?.subreddit ?? "worldnews"}
                        onChange={(event) => handleNewsChange("subreddit", event.target.value || "worldnews")}
                      />
                    </SettingField>
                    <SettingField label="Rotation Seconds">
                      <Input
                        value={settingsState.news?.rotationSeconds ?? 8}
                        onChange={(event) =>
                          handleNewsChange("rotationSeconds", event.target.value === "" ? 8 : Number(event.target.value))
                        }
                      />
                    </SettingField>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Unsplash Topics</CardTitle>
                    <CardDescription>Keywords for each rotating image tile. Add or remove individual topics.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {Object.keys(settingsState.unsplash).map((key, boxIndex) => {
                      const topics = settingsState.unsplash[key] || [];
                      const inputValue = newTopicInputs[key] || "";
                      return (
                        <div key={key} className="space-y-2">
                          <Label className="text-xs font-medium text-foreground">Photo tile {boxIndex + 1}</Label>
                          <div className="flex min-h-10 flex-wrap gap-2 rounded-lg border border-border bg-muted/20 p-3">
                            {topics.map((topic, i) => (
                              <span key={i} className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs text-accent-foreground">
                                {topic}
                                <button
                                  type="button"
                                  className="ml-1 leading-none opacity-60 hover:opacity-100"
                                  onClick={() => handleRemoveUnsplashTopic(key, i)}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <Input
                              value={inputValue}
                              placeholder="Add topic…"
                              onChange={(e) => setNewTopicInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddUnsplashTopic(key); } }}
                            />
                            <Button type="button" variant="outline" onClick={() => handleAddUnsplashTopic(key)}>
                              Add
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Bookmarks</CardTitle>
                    <CardDescription>Choose which bookmark category each dashboard box shows.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="rounded-xl border border-border bg-muted/20 p-4">
                      <p className="text-sm font-medium text-foreground">Dashboard box categories</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        {[0, 1, 2, 3, 4].map((boxIndex) => (
                          <SettingField key={boxIndex} label={`Bookmark Box ${boxIndex + 1}`}>
                            <select
                              className="h-9 w-full rounded-md border border-input bg-card px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                              value={(settingsState.layout?.bookmarkBoxCategories || [0, 1, 2, 3, 4])[boxIndex] ?? 0}
                              onChange={(event) => handleBookmarkBoxCategoryChange(boxIndex, event.target.value)}
                            >
                              {settingsState.bookmark.map((category, categoryIndex) => (
                                <option key={`${category.title}-${categoryIndex}`} value={categoryIndex}>
                                  {category.title || `Category ${categoryIndex + 1}`}
                                </option>
                              ))}
                            </select>
                          </SettingField>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>

            <div className="border-t border-border bg-card/60 px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>
                    Active preview: <span className="font-medium text-foreground">{selectedThemePalette}</span> in <span className="font-medium text-foreground">{selectedThemeMode}</span> mode
                  </p>
                  <p>
                    Storage: {storageState?.indexedDbAvailable ? "IndexedDB" : "Local mirror only"} · backups: {storageState?.backupCount ?? 0}
                    {storageState?.lastSavedAt ? ` · last saved ${new Date(storageState.lastSavedAt).toLocaleString()}` : ""}
                  </p>
                  {statusMessage ? <p className="text-foreground">{statusMessage}</p> : null}
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={handleExport}>
                    Export backup
                  </Button>
                  <Button type="button" variant="outline" onClick={handleImportClick}>
                    Import backup
                  </Button>
                  <Button type="button" variant="outline" onClick={handleReset}>
                    Reset
                  </Button>
                  <Button type="button" onClick={handleSave}>
                    Save and reload
                  </Button>
                </div>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleImport}
            />
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default SettingsButton;
