import React from "react";
import { useRegisterActions } from "kbar";
import { ThemeContext } from "./ThemeContext";
import { BUILT_IN_PALETTES } from "@/lib/theme-palettes";
import {
  readSettings,
  writeSettings,
  resetSettings,
  exportSettingsBlob,
  createSettingsExportFilename,
} from "./readSettings";

const TILE_LABELS = {
  videoTall: "Tall Video",
  videoSmall: "Small Video",
  search: "Search Box",
  weather: "Weather",
  featurePanel: "Feature Panel",
  solarGraph: "Solar Graph",
  clock: "Clock",
  themeTools: "Theme Tools",
  bookmark1: "Bookmark 1",
  bookmark2: "Bookmark 2",
  bookmark3: "Bookmark 3",
  bookmark4: "Bookmark 4",
  bookmark5: "Bookmark 5",
  unsplash1: "Photo 1",
  unsplash2: "Photo 2",
  unsplash3: "Photo 3",
  unsplash4: "Photo 4",
  unsplash5: "Photo 5",
};

export default function useKBarActions() {
  const { setThemeMode, setThemePalette, setCustomThemeVars } = React.useContext(ThemeContext);

  const actions = React.useMemo(() => {
    const list = [];
    const settings = readSettings();
    const customThemes = settings.customThemes || [];

    // --- Theme: Mode ---
    list.push({
      id: "theme-light",
      name: "Light Mode",
      shortcut: [],
      section: "Theme",
      perform: () => setThemeMode("light"),
    });
    list.push({
      id: "theme-dark",
      name: "Dark Mode",
      shortcut: [],
      section: "Theme",
      perform: () => setThemeMode("dark"),
    });
    list.push({
      id: "theme-system",
      name: "System Mode",
      shortcut: [],
      section: "Theme",
      perform: () => setThemeMode("system"),
    });

    // --- Theme: Palette (built-in) ---
    BUILT_IN_PALETTES.forEach((palette) => {
      list.push({
        id: `palette-${palette.value}`,
        name: `${palette.title} Palette`,
        shortcut: [],
        section: "Theme",
        perform: () => {
          setThemePalette(palette.value);
          setCustomThemeVars(null);
        },
      });
    });

    // --- Theme: Palette (custom) ---
    customThemes.forEach((ct) => {
      list.push({
        id: `palette-${ct.id}`,
        name: `${ct.name} Palette`,
        shortcut: [],
        section: "Theme",
        perform: () => {
          setThemePalette(ct.id);
          setCustomThemeVars({ light: ct.light, dark: ct.dark });
        },
      });
    });

    // --- Search ---
    list.push({
      id: "focus-search",
      name: "Focus Search",
      shortcut: [],
      section: "Search",
      perform: () => {
        const input = document.getElementById("search-input");
        if (input) input.focus();
      },
    });

    // --- Feature Panel ---
    list.push({
      id: "feature-headlines",
      name: "Show Headlines",
      shortcut: [],
      section: "Feature Panel",
      perform: () => {
        const s = readSettings();
        s.featurePanel = { ...s.featurePanel, mode: "headlines" };
        writeSettings(s).then(() => window.location.reload());
      },
    });
    list.push({
      id: "feature-windy",
      name: "Show Windy",
      shortcut: [],
      section: "Feature Panel",
      perform: () => {
        const s = readSettings();
        s.featurePanel = { ...s.featurePanel, mode: "windy" };
        writeSettings(s).then(() => window.location.reload());
      },
    });
    list.push({
      id: "feature-timer",
      name: "Show Timer",
      shortcut: [],
      section: "Feature Panel",
      perform: () => {
        const s = readSettings();
        s.featurePanel = { ...s.featurePanel, mode: "timer" };
        writeSettings(s).then(() => window.location.reload());
      },
    });

    // --- Layout: Toggle tiles ---
    Object.entries(TILE_LABELS).forEach(([id, label]) => {
      list.push({
        id: `toggle-${id}`,
        name: `Toggle ${label}`,
        shortcut: [],
        section: "Layout",
        perform: () => {
          const s = readSettings();
          const hidden = s.layout?.hiddenBoxes || {};
          hidden[id] = !hidden[id];
          s.layout = { ...s.layout, hiddenBoxes: hidden };
          writeSettings(s).then(() => window.location.reload());
        },
      });
    });

    // --- Settings ---
    list.push({
      id: "export-settings",
      name: "Export Settings",
      shortcut: [],
      section: "Settings",
      perform: () => {
        const s = readSettings();
        const blob = exportSettingsBlob(s);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = createSettingsExportFilename();
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      },
    });
    list.push({
      id: "reset-settings",
      name: "Reset Settings",
      shortcut: [],
      section: "Settings",
      perform: () => {
        resetSettings().then(() => window.location.reload());
      },
    });

    return list;
  }, [setThemeMode, setThemePalette, setCustomThemeVars]);

  useRegisterActions(actions, [actions]);
}
