import React, { useContext, useState } from "react";
import { HiOutlineComputerDesktop, HiOutlineMoon, HiOutlineSun } from "react-icons/hi2";
import { ThemeContext, type ThemeMode, type ThemeVarsByMode } from "@/components/layout/ThemeContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { StartupSettings } from "@/features/settings/stores";
import { BUILT_IN_PALETTES, getSwatchesFromCustomTheme, parseCustomThemeCSS } from "@/lib/theme-palettes";
import { PaletteSwatchPreview, SegmentedControl, SettingField, type CustomTheme } from "../controls";
import { setUiValue, type SettingsSectionProps } from "./types";

// Theme mode, palette (built-in and custom), and adding custom themes.
// Mode and palette changes preview live through ThemeContext.
export default function ThemeSettings({ settings, updateSettings }: SettingsSectionProps) {
  const { theme, themeMode, setThemeMode, themePalette, setThemePalette, setCustomThemeVars } = useContext(ThemeContext);
  const [customThemeName, setCustomThemeName] = useState("");
  const [customThemeCSS, setCustomThemeCSS] = useState("");
  const [customThemeError, setCustomThemeError] = useState("");

  const selectedThemeMode = settings.ui?.themeMode || themeMode;
  const selectedThemePalette = settings.ui?.themePalette || themePalette;

  const handleThemeModeChange = (value: ThemeMode) => {
    setUiValue(updateSettings, "themeMode", value);
    setThemeMode(value);
  };

  const handleThemePaletteChange = (value: string, customVars: ThemeVarsByMode | null = null) => {
    setUiValue(updateSettings, "themePalette", value);
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

    if (settings.ui?.themePalette === themeId) {
      handleThemePaletteChange("zen", null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Mode</CardTitle>
          <CardDescription>Follow your system, or keep the page light or dark.</CardDescription>
        </CardHeader>
        <CardContent>
          <SegmentedControl
            label="Theme mode"
            value={selectedThemeMode as ThemeMode}
            onChange={handleThemeModeChange}
            options={[
              { value: "system", label: "System", icon: HiOutlineComputerDesktop },
              { value: "light", label: "Light", icon: HiOutlineSun },
              { value: "dark", label: "Dark", icon: HiOutlineMoon },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Palette</CardTitle>
          <CardDescription>The colours used across the page.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {BUILT_IN_PALETTES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleThemePaletteChange(option.value)}
              className="palette-option"
              aria-pressed={selectedThemePalette === option.value}
            >
              <PaletteSwatchPreview swatches={option.swatches} mode={theme} />
              <div className="palette-option-name">{option.title}</div>
              <div className="palette-option-description">{option.description}</div>
            </button>
          ))}
          {(settings.customThemes || []).map((ct: CustomTheme) => {
            const swatches = {
              light: getSwatchesFromCustomTheme(ct, "light"),
              dark: getSwatchesFromCustomTheme(ct, "dark"),
            };
            return (
              <button
                key={ct.id}
                type="button"
                onClick={() => handleThemePaletteChange(ct.id, { light: ct.light, dark: ct.dark })}
                className="palette-option"
                aria-pressed={selectedThemePalette === ct.id}
              >
                <PaletteSwatchPreview swatches={swatches} mode={theme} />
                <div className="palette-option-name">{ct.name}</div>
                <div className="palette-option-description">Custom palette</div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Custom palette</CardTitle>
          <CardDescription>
            Paste CSS from a shadcn theme generator. Use <code>:root</code> for light and <code>.dark</code> for dark mode variables.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingField label="Theme name">
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
            Add theme
          </Button>

          {(settings.customThemes || []).length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-foreground">Saved Custom Themes</p>
              {(settings.customThemes || []).map((ct: CustomTheme) => (
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
    </>
  );
}
