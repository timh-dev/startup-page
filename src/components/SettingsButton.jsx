import React, { useContext, useMemo, useState } from "react";
import { HiOutlineCog, HiOutlineSparkles, HiOutlineSquares2X2, HiOutlineSwatch } from "react-icons/hi2";

import { ThemeContext } from "@/components/ThemeContext";
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
import { cn } from "@/lib/utils";
import {
  exportSettingsBlob,
  importSettingsFromFile,
  readSettings,
  resetSettings,
  writeSettings,
} from "./readSettings";

const visibilityOptions = [
  { id: "videoTall", label: "Tall media tile" },
  { id: "search", label: "Search box" },
  { id: "weather", label: "Weather" },
  { id: "featurePanel", label: "Feature panel" },
  { id: "solarGraph", label: "Solar graph" },
  { id: "clock", label: "Clock" },
  { id: "themeTools", label: "Theme and settings tile" },
  { id: "bookmark1", label: "Bookmark box 1" },
  { id: "bookmark2", label: "Bookmark box 2" },
  { id: "bookmark3", label: "Bookmark box 3" },
  { id: "bookmark4", label: "Bookmark box 4" },
  { id: "bookmark5", label: "Bookmark box 5" },
  { id: "unsplash1", label: "Photo tile 1" },
  { id: "unsplash2", label: "Photo tile 2" },
  { id: "unsplash3", label: "Photo tile 3" },
  { id: "unsplash4", label: "Photo tile 4" },
  { id: "unsplash5", label: "Photo tile 5" },
  { id: "unsplash6", label: "Photo tile 6" }
];

const paletteOptions = [
  {
    value: "zen",
    title: "Zen",
    description: "Warm paper neutrals with quiet contrast.",
    preview: "from-stone-200 via-amber-100 to-zinc-900"
  },
  {
    value: "chalk",
    title: "Chalk",
    description: "Cool editorial surfaces with crisp navy ink.",
    preview: "from-slate-100 via-indigo-100 to-slate-700"
  },
  {
    value: "astrovista",
    title: "Astrovista",
    description: "Soft space-age neutrals with brighter highlights.",
    preview: "from-slate-100 via-violet-100 to-orange-400"
  }
];

const navItems = [
  { value: "appearance", label: "Appearance", icon: HiOutlineSwatch },
  { value: "layout", label: "Layout", icon: HiOutlineSquares2X2 },
  { value: "content", label: "Content", icon: HiOutlineSparkles }
];

function SettingField({ label, description, children }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {children}
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
    </div>
  );
}

function RangeControl({ label, value, min, max, step, onChange }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm text-foreground">{label}</Label>
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
        "rounded-xl border p-4 text-left transition",
        selected
          ? "border-primary bg-accent text-accent-foreground shadow-sm"
          : "border-border bg-card hover:bg-accent/50"
      )}
    >
      <div className="font-medium">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{description}</div>
    </button>
  );
}

function SettingsButton() {
  const savedSettings = useMemo(() => readSettings(), []);
  const { themeMode, setThemeMode, themePalette, setThemePalette } = useContext(ThemeContext);
  const [open, setOpen] = useState(false);
  const [settingsState, setSettingsState] = useState(savedSettings);
  const fileInputRef = React.useRef(null);

  const openModal = () => {
    const freshSettings = readSettings();
    setSettingsState(freshSettings);
    setThemeMode(freshSettings.ui.themeMode);
    setThemePalette(freshSettings.ui.themePalette || "zen");
    setOpen(true);
  };

  const closeModal = (nextOpen) => {
    if (nextOpen) {
      setOpen(true);
      return;
    }

    const freshSettings = readSettings();
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

  const handleThemeModeChange = (value) => {
    handleUiChange("themeMode", value);
    setThemeMode(value);
  };

  const handleThemePaletteChange = (value) => {
    handleUiChange("themePalette", value);
    setThemePalette(value);
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

  const handleUnsplashTopicsChange = (key, value) => {
    updateSettings((prevSettings) => ({
      ...prevSettings,
      unsplash: {
        ...prevSettings.unsplash,
        [key]: value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      }
    }));
  };

  const handleBookmarkTitleChange = (index, value) => {
    updateSettings((prevSettings) => {
      const bookmark = [...prevSettings.bookmark];
      bookmark[index] = { ...bookmark[index], title: value };
      return { ...prevSettings, bookmark };
    });
  };

  const handleBookmarkItemChange = (index, subIndex, subKey, value) => {
    updateSettings((prevSettings) => {
      const bookmark = [...prevSettings.bookmark];
      const content = [...bookmark[index].content];
      content[subIndex] = { ...content[subIndex], [subKey]: value };
      bookmark[index] = { ...bookmark[index], content };
      return { ...prevSettings, bookmark };
    });
  };

  const handleAddBookmarkItem = (index) => {
    updateSettings((prevSettings) => {
      const bookmark = [...prevSettings.bookmark];
      bookmark[index] = {
        ...bookmark[index],
        content: [...bookmark[index].content, { name: "", url: "" }]
      };
      return { ...prevSettings, bookmark };
    });
  };

  const handleRemoveBookmarkItem = (index) => {
    updateSettings((prevSettings) => {
      const bookmark = [...prevSettings.bookmark];
      bookmark[index] = {
        ...bookmark[index],
        content: bookmark[index].content.slice(0, -1)
      };
      return { ...prevSettings, bookmark };
    });
  };

  const handleReset = async () => {
    const defaults = await resetSettings();
    setSettingsState(defaults);
    setThemeMode(defaults.ui.themeMode);
    setThemePalette(defaults.ui.themePalette || "zen");
  };

  const handleSave = async () => {
    await writeSettings(settingsState);
    setThemeMode(settingsState.ui.themeMode);
    setThemePalette(settingsState.ui.themePalette || "zen");
    setOpen(false);
    window.location.reload();
  };

  const handleExport = () => {
    const blob = exportSettingsBlob(settingsState);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "startup-page-settings.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const importedSettings = await importSettingsFromFile(file);
    setSettingsState(importedSettings);
    setThemeMode(importedSettings.ui.themeMode);
    setThemePalette(importedSettings.ui.themePalette || "zen");
    event.target.value = "";
  };

  const selectedThemeMode = settingsState.ui?.themeMode || themeMode;
  const selectedThemePalette = settingsState.ui?.themePalette || themePalette;
  const selectedGridDensity = settingsState.ui?.gridDensity || "comfortable";
  const selectedCardStyle = settingsState.ui?.cardStyle || "rounded";
  const imageEffects = settingsState.ui?.imageEffects || IMAGE_FILTER_DEFAULTS;

  return (
    <Dialog open={open} onOpenChange={closeModal}>
      <DialogTrigger asChild>
        <button className="text-primary-foreground text-5xl cursor-pointer" onClick={openModal}>
          <HiOutlineCog />
        </button>
      </DialogTrigger>
      <DialogContent className="border-border/60 bg-background/98 p-0">
        <Tabs defaultValue="appearance" orientation="vertical" className="grid min-h-[72vh] lg:grid-cols-[260px_1fr] gap-0">
          <div className="border-b border-border bg-sidebar text-sidebar-foreground lg:border-r lg:border-b-0">
            <div className="p-6">
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl">Workspace Settings</DialogTitle>
                <DialogDescription>
                  Built on the new shadcn-style UI layer with live theme and palette preview.
                </DialogDescription>
              </DialogHeader>
            </div>
            <TabsList className="mx-4 mb-4 bg-transparent p-0">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <TabsTrigger key={item.value} value={item.value} className="w-full justify-start">
                    <Icon className="size-4" />
                    {item.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          <div className="flex flex-col">
            <div className="max-h-[72vh] overflow-y-auto p-6 md:p-8">
              <TabsContent value="appearance" className="mt-0 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Theme Mode</CardTitle>
                    <CardDescription>Choose how light and dark mode should be resolved.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-3">
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
                  <CardContent className="grid gap-3 lg:grid-cols-3">
                    {paletteOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleThemePaletteChange(option.value)}
                        className={cn(
                          "rounded-xl border p-4 text-left transition",
                          selectedThemePalette === option.value
                            ? "border-primary bg-accent shadow-sm"
                            : "border-border bg-card hover:bg-accent/50"
                        )}
                      >
                        <div className={cn("mb-4 h-20 rounded-lg bg-gradient-to-br", option.preview)} />
                        <div className="font-medium">{option.title}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{option.description}</div>
                      </button>
                    ))}
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

              <TabsContent value="layout" className="mt-0 space-y-6">
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

                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle>Next Layout Phase</CardTitle>
                    <CardDescription>
                      The settings model now has a dedicated `layout` section. Dragging, resizing, add/remove, and custom box composition can sit here next without another data migration.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </TabsContent>

              <TabsContent value="content" className="mt-0 space-y-6">
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
                      <Input value={settingsState.units ?? ""} onChange={(event) => handleTopLevelChange("units", event.target.value)} />
                    </SettingField>
                    <SettingField label="OpenWeather Key">
                      <Input
                        value={settingsState.openWeatherCredential ?? ""}
                        onChange={(event) => handleTopLevelChange("openWeatherCredential", event.target.value || null)}
                      />
                    </SettingField>
                    <SettingField label="Unsplash Key" className="md:col-span-2">
                      <Input
                        value={settingsState.unsplashCredential ?? ""}
                        onChange={(event) => handleTopLevelChange("unsplashCredential", event.target.value || null)}
                      />
                    </SettingField>
                    <SettingField label="ListenBrainz Username">
                      <Input
                        value={settingsState.listenBrainzUsername ?? ""}
                        onChange={(event) => handleTopLevelChange("listenBrainzUsername", event.target.value || null)}
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
                    <CardDescription>Comma-separated keywords for each rotating image tile.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    {Object.keys(settingsState.unsplash).map((key) => (
                      <SettingField key={key} label={key}>
                        <Input value={settingsState.unsplash[key].join(", ")} onChange={(event) => handleUnsplashTopicsChange(key, event.target.value)} />
                      </SettingField>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Bookmarks</CardTitle>
                    <CardDescription>Edit titles and links for each bookmark tile.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {settingsState.bookmark.map((item, index) => (
                      <div key={index} className="rounded-xl border border-border bg-muted/25 p-4">
                        <SettingField label={`Bookmark Box ${index + 1} Title`}>
                          <Input value={item.title} onChange={(event) => handleBookmarkTitleChange(index, event.target.value)} />
                        </SettingField>
                        <div className="mt-4 space-y-3">
                          {item.content.map((content, subIndex) => (
                            <div key={subIndex} className="grid gap-3 md:grid-cols-2">
                              <SettingField label="Name">
                                <Input
                                  value={content.name}
                                  onChange={(event) => handleBookmarkItemChange(index, subIndex, "name", event.target.value)}
                                />
                              </SettingField>
                              <SettingField label="URL">
                                <Input
                                  value={content.url}
                                  onChange={(event) => handleBookmarkItemChange(index, subIndex, "url", event.target.value)}
                                />
                              </SettingField>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 flex gap-3">
                          <Button type="button" size="sm" onClick={() => handleAddBookmarkItem(index)}>
                            Add link
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => handleRemoveBookmarkItem(index)}>
                            Remove link
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            </div>

            <div className="border-t border-border bg-card/60 px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Active preview: <span className="font-medium text-foreground">{selectedThemePalette}</span> in <span className="font-medium text-foreground">{selectedThemeMode}</span> mode
                </p>
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
