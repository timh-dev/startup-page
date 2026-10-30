import React from "react";
import { useKBar, useRegisterActions, Priority, type Action } from "kbar";
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
import { useDebugStore } from "@/lib/debug";
import { normalizeSearchEngines } from "@/features/dashboard/searchEngines";
import { describeIntent, openResult, resolveQuery } from "@/features/dashboard/searchQuery";

// Whether the key that chose the last palette result held ⌘/Ctrl or Shift,
// so a search can open in a new tab (kbar's perform() gets no event).
let lastEnterWantsNewTab = false;
if (typeof window !== "undefined") {
  window.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter") lastEnterWantsNewTab = event.metaKey || event.ctrlKey || event.shiftKey;
    },
    true,
  );
}

export default function useKBarActions() {
  const { setThemeMode, setThemePalette, setCustomThemeVars } = React.useContext(ThemeContext);
  // Subscribing to the store keeps bookmark/vault actions fresh after edits
  const storeSettings = useSettingsStore((s) => s.settings);

  const actions = React.useMemo(() => {
    const list: Action[] = [];
    const settings = storeSettings || readSettings();
    const customThemes = settings.customThemes || [];

    // --- Bookmarks: fuzzy-search every saved link ---
    const bookmarkGroups = Array.isArray(settings.bookmark) ? settings.bookmark : [];
    bookmarkGroups.forEach((group, groupIndex) => {
      (group?.content || []).forEach((link: { name?: string; url?: string }, linkIndex: number) => {
        if (!link?.url) return;
        const url = link.url;
        list.push({
          id: `bookmark-${groupIndex}-${linkIndex}`,
          name: link.name || link.url,
          subtitle: link.url,
          keywords: `${link.url} ${group?.title || ""}`,
          section: "Bookmarks",
          perform: () => window.location.assign(url),
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
    customThemes.forEach((ct: { id: string; name: string; light: Record<string, string>; dark: Record<string, string> }) => {
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

    // --- Debugger ---
    list.push({
      id: "open-debugger",
      name: "Debugger: change the time or place",
      shortcut: [],
      keywords: "debug time travel location timezone sun",
      section: "Settings",
      perform: () => useDebugStore.getState().setPanelOpen(true),
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

  // ── Query-driven actions: sums, searches and sites, quick-add ─────────────
  // These only exist while the query matches their trigger; setting the raw
  // query as `keywords` guarantees they pass kbar's fuzzy filter.
  const { searchQuery } = useKBar((state) => ({ searchQuery: state.searchQuery }));
  const storedEngines = useSettingsStore((s) => s.settings.search?.engines);
  const engines = React.useMemo(() => normalizeSearchEngines(storedEngines), [storedEngines]);

  const dynamicActions = React.useMemo(() => {
    const query = (searchQuery || "").trim();
    const out: Action[] = [];

    // Sums, bangs, sites and web searches: the same rules as the search card.
    const intent = query.startsWith("+") ? null : resolveQuery(query, engines);
    if (intent?.kind === "calc") {
      out.push({
        id: "calc-result",
        name: describeIntent(intent),
        subtitle: "Press Enter to copy",
        keywords: query,
        section: "Calculator",
        priority: Priority.HIGH,
        perform: () => {
          void navigator.clipboard?.writeText(intent.result);
        },
      });
    } else if (intent) {
      // A plain search comes after any bookmark or link that matches.
      out.push({
        id: `web-${intent.kind}`,
        name: describeIntent(intent),
        subtitle: intent.kind === "url" ? undefined : "⌘ Enter for a new tab",
        keywords: query,
        section: "Web Search",
        priority: intent.kind === "search" ? Priority.LOW : Priority.HIGH,
        perform: () => openResult(intent.url, lastEnterWantsNewTab),
      });
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
  }, [searchQuery, engines]);

  useRegisterActions(dynamicActions, [dynamicActions]);
}
