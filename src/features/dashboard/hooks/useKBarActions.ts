import React from "react";
import { useKBar, useRegisterActions, Priority } from "kbar";
import { ThemeContext } from "@/components/layout/ThemeContext";
import { BUILT_IN_PALETTES } from "@/lib/theme-palettes";
import {
  readSettings,
  writeSettings,
  resetSettings,
  exportSettingsBlob,
  createSettingsExportFilename,
} from "@/lib/settings";
import { useSettingsStore } from "@/features/settings/stores";

// Search-provider bangs: "!yt lofi beats" → YouTube search
const SEARCH_BANGS = {
  g: { label: "Google", url: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}` },
  ddg: { label: "DuckDuckGo", url: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}` },
  yt: { label: "YouTube", url: (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}` },
  gh: { label: "GitHub", url: (q) => `https://github.com/search?q=${encodeURIComponent(q)}` },
  w: { label: "Wikipedia", url: (q) => `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(q)}` },
  r: { label: "Reddit", url: (q) => `https://www.reddit.com/search/?q=${encodeURIComponent(q)}` },
  maps: { label: "Google Maps", url: (q) => `https://www.google.com/maps/search/${encodeURIComponent(q)}` },
  npm: { label: "npm", url: (q) => `https://www.npmjs.com/search?q=${encodeURIComponent(q)}` },
};

// Inline calculator for "= 340*1.08" queries. The whitelist regex keeps
// Function() safe: digits, operators, parens, and scientific notation only —
// no letters (beyond e/E), brackets, or quotes ever reach evaluation.
function safeCalculate(expression) {
  const cleaned = expression.replace(/\^/g, "**").replace(/,/g, "");
  if (!/^[\d\s+\-*/().%eE]*$/.test(cleaned) || !/\d/.test(cleaned)) return null;
  try {
    const value = Function(`"use strict"; return (${cleaned});`)();
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    return value;
  } catch {
    return null;
  }
}

const TILE_LABELS = {
  videoTall: "Tall Video",
  videoSmall: "Small Video",
  search: "Search Box",
  weather: "Weather",
  featurePanel: "Feature Panel",
  solarGraph: "Solar Graph",
  vaultPreview: "Vault Preview",
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
  // Subscribing to the store keeps bookmark/vault actions fresh after edits
  const storeSettings = useSettingsStore((s) => s.settings);

  const actions = React.useMemo(() => {
    const list = [];
    const settings = storeSettings || readSettings();
    const customThemes = settings.customThemes || [];

    // --- Bookmarks: fuzzy-search every saved link ---
    const bookmarkGroups = Array.isArray(settings.bookmark) ? settings.bookmark : [];
    bookmarkGroups.forEach((group, groupIndex) => {
      (group?.content || []).forEach((link, linkIndex) => {
        if (!link?.url) return;
        list.push({
          id: `bookmark-${groupIndex}-${linkIndex}`,
          name: link.name || link.url,
          subtitle: link.url,
          keywords: `${link.url} ${group?.title || ""}`,
          section: "Bookmarks",
          perform: () => window.location.assign(link.url),
        });
      });
    });

    // --- Resource Vault: search saved items by title, tag, and description ---
    const readItems = Array.isArray(settings.readItems) ? settings.readItems : [];
    readItems.forEach((item) => {
      if (!item?.url) return;
      list.push({
        id: `vault-item-${item.id}`,
        name: item.title || item.url,
        subtitle: item.url,
        keywords: `${item.tag || ""} ${String(item.description || "").slice(0, 80)}`,
        section: "Resource Vault",
        perform: () => window.location.assign(item.url),
      });
    });

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
  }, [setThemeMode, setThemePalette, setCustomThemeVars, storeSettings]);

  useRegisterActions(actions, [actions]);

  // ── Query-driven actions: calculator, web-search bangs, quick-add ─────────
  // These only exist while the query matches their trigger; setting the raw
  // query as `keywords` guarantees they pass kbar's fuzzy filter.
  const { searchQuery } = useKBar((state) => ({ searchQuery: state.searchQuery }));

  const dynamicActions = React.useMemo(() => {
    const query = (searchQuery || "").trim();
    const out = [];

    // Calculator: "= 340*1.08"
    if (query.startsWith("=") && query.length > 1) {
      const result = safeCalculate(query.slice(1));
      if (result !== null) {
        const pretty = Number.isInteger(result)
          ? String(result)
          : String(Math.round(result * 1e10) / 1e10);
        out.push({
          id: "calc-result",
          name: `= ${pretty}`,
          subtitle: "Press Enter to copy",
          keywords: query,
          section: "Calculator",
          priority: Priority.HIGH,
          perform: () => {
            void navigator.clipboard?.writeText(pretty);
          },
        });
      }
    }

    // Web search bangs: "!yt query", "!gh query", …
    const bang = query.match(/^!(\w+)\s+(.+)$/);
    if (bang) {
      const provider = SEARCH_BANGS[bang[1].toLowerCase()];
      if (provider) {
        out.push({
          id: `bang-${bang[1].toLowerCase()}`,
          name: `Search ${provider.label} for “${bang[2]}”`,
          keywords: query,
          section: "Web Search",
          priority: Priority.HIGH,
          perform: () => window.location.assign(provider.url(bang[2])),
        });
      }
    }

    // Quick-add to Resource Vault: "+ https://example.com optional title"
    const quickAdd = query.match(/^\+\s*(https?:\/\/\S+)(?:\s+(.+))?$/);
    if (quickAdd) {
      const url = quickAdd[1];
      let title = quickAdd[2]?.trim();
      if (!title) {
        try {
          title = new URL(url).hostname.replace(/^www\./, "");
        } catch {
          title = url;
        }
      }
      out.push({
        id: "vault-quick-add",
        name: `Add “${title}” to Resource Vault`,
        subtitle: url,
        keywords: query,
        section: "Resource Vault",
        priority: Priority.HIGH,
        perform: () => {
          const s = readSettings();
          const items = Array.isArray(s.readItems) ? s.readItems : [];
          s.readItems = [
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              title,
              description: "",
              url,
              tag: "Read",
              status: "todo",
              createdAt: new Date().toISOString(),
              completedAt: null,
            },
            ...items,
          ];
          void writeSettings(s).then(() => {
            useSettingsStore.getState().reloadSettings();
          });
        },
      });
    }

    return out;
  }, [searchQuery]);

  useRegisterActions(dynamicActions, [dynamicActions]);
}
