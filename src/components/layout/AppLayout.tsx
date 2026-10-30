import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { KBarProvider, useRegisterActions } from "kbar";

import { isBuiltInPalette } from "@/lib/theme-palettes";
import { useSettingsStore } from "@/features/settings/stores";
import { useLayoutEditStore } from "@/features/dashboard/stores/layoutEditStore";
import ThemeProvider, { ThemeContext, type ThemeMode } from "@/components/layout/ThemeContext";
import Toggle from "@/components/layout/ThemeToggle";
import SettingsButton from "@/features/settings/components/SettingsButton";
import BookmarkDialogs from "@/features/bookmarks/components/BookmarkDialogs";
import SidePanel from "@/components/layout/SidePanel";
import AccountButton from "@/features/auth/AccountButton";
import AuthBridge from "@/features/auth/AuthBridge";
import { useIsClerkAvailable } from "@/features/auth/ClerkStatus";
import CommandPalette from "@/components/layout/CommandPalette";
import DebugPanel from "@/components/layout/DebugPanel";
import useKBarActions from "@/features/dashboard/hooks/useKBarActions";
import DashboardPage from "@/features/dashboard/pages";
import { useQuickAddStore } from "@/features/resourceVault/stores/quickAddStore";

function KBarWrapper({ children }: { children: React.ReactNode }) {
  useKBarActions();
  return (
    <>
      <CommandPalette />
      <DebugPanel />
      {children}
    </>
  );
}

function VaultNavigationActions() {
  const navigate = useNavigate();
  const vaultEnabled = useSettingsStore((state) => state.settings.ui?.vaultEnabled ?? true);
  const bookmarksEnabled = useSettingsStore((state) => state.settings.ui?.bookmarksEnabled ?? true);

  const actions = React.useMemo(
    () => [
      ...(bookmarksEnabled ? [{
        id: "open-bookmark-vault",
        name: "Open Bookmark Vault",
        shortcut: ["3"],
        section: "Navigation",
        perform: () => navigate("/bookmarks"),
      }] : []),
      ...(vaultEnabled ? [{
        id: "open-resource-vault",
        name: "Open Resource Vault",
        shortcut: ["1"],
        section: "Navigation",
        perform: () => navigate("/resources"),
      }] : []),
      {
        id: "show-dashboard",
        name: "Show Dashboard",
        shortcut: ["2"],
        section: "Navigation",
        perform: () => navigate("/"),
      },
      ...(vaultEnabled ? [{
        id: "quick-add-resource",
        name: "Add a Resource",
        shortcut: ["a"],
        section: "Navigation",
        // Set the flag before navigating: the Vault (already mounted or about
        // to mount) switches to the reading list and focuses its add field.
        perform: () => {
          useQuickAddStore.getState().requestQuickAdd();
          navigate("/resources");
        },
      }] : []),
    ],
    [navigate, vaultEnabled, bookmarksEnabled],
  );

  useRegisterActions(actions, [actions]);
  return null;
}

// Keeps ThemeContext in sync when settings load from IndexedDB in the background.
function ThemeSync() {
  const storeThemeMode = useSettingsStore((s) => s.settings.ui?.themeMode) as ThemeMode | undefined;
  const storeThemePalette = useSettingsStore((s) => s.settings.ui?.themePalette);
  const customThemes = useSettingsStore((s) => s.settings.customThemes) as any[];
  const { setThemeMode, setThemePalette, setCustomThemeVars } = React.useContext(ThemeContext);

  const prevModeRef = React.useRef<string | undefined>(undefined);
  const prevPaletteRef = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    if (storeThemeMode && storeThemeMode !== prevModeRef.current) {
      prevModeRef.current = storeThemeMode;
      setThemeMode(storeThemeMode);
    }
  }, [storeThemeMode, setThemeMode]);

  React.useEffect(() => {
    if (storeThemePalette && storeThemePalette !== prevPaletteRef.current) {
      prevPaletteRef.current = storeThemePalette;
      setThemePalette(storeThemePalette);
      if (!isBuiltInPalette(storeThemePalette)) {
        const ct = (customThemes || []).find((c: any) => c.id === storeThemePalette);
        setCustomThemeVars(ct ? { light: ct.light, dark: ct.dark } : null);
      } else {
        setCustomThemeVars(null);
      }
    }
  }, [storeThemePalette, setThemePalette, setCustomThemeVars, customThemes]);

  return null;
}

function AppLayoutInner() {
  const isClerkAvailable = useIsClerkAvailable();
  const navigate = useNavigate();
  const location = useLocation();
  const vaultEnabled = useSettingsStore((state) => state.settings.ui?.vaultEnabled ?? true);
  const bookmarksEnabled = useSettingsStore((state) => state.settings.ui?.bookmarksEnabled ?? true);

  const isResources = location.pathname === "/resources";
  const isBookmarks = location.pathname === "/bookmarks";
  const isDashboard = !isResources && !isBookmarks;

  const editingLayout = useLayoutEditStore((state) => state.editing);
  const setLayoutEditing = useLayoutEditStore((state) => state.setEditing);

  // Leaving the card pages (for the Vault or Bookmarks) ends edit mode.
  React.useEffect(() => {
    if (!isDashboard && editingLayout) {
      setLayoutEditing(false);
    }
  }, [isDashboard, editingLayout, setLayoutEditing]);

  // A feature can be turned off from Settings while its page is open (or via
  // a stale deep link/back-button) — bounce back to the dashboard instead of
  // leaving a disabled page on screen.
  React.useEffect(() => {
    if (isResources && !vaultEnabled) {
      navigate("/");
    } else if (isBookmarks && !bookmarksEnabled) {
      navigate("/");
    }
  }, [isResources, isBookmarks, vaultEnabled, bookmarksEnabled, navigate]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target?.closest?.("input, textarea, select, [contenteditable='true']")) {
        return;
      }

      if (event.key === "Escape" && !isDashboard) {
        event.preventDefault();
        navigate("/");
        return;
      }

      if (!event.metaKey && !event.ctrlKey && !event.altKey) {
        if (event.key === "1" && vaultEnabled) {
          event.preventDefault();
          navigate("/resources");
          return;
        }
        if (event.key === "2") {
          event.preventDefault();
          navigate("/");
          return;
        }
        if (event.key === "3" && bookmarksEnabled) {
          event.preventDefault();
          navigate("/bookmarks");
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate, isDashboard, vaultEnabled, bookmarksEnabled]);



  return (
    <section
      className="relative min-h-screen overflow-x-hidden text-foreground"
    >
      <ThemeSync />
      {isClerkAvailable && <AuthBridge />}
      <VaultNavigationActions />
      <BookmarkDialogs />
      <SidePanel />
      <header className="app-header">
        <div className="app-toolbar surface-glass">
          <Toggle />
          {isClerkAvailable && <AccountButton />}
          <SettingsButton />
        </div>
      </header>
      {/* One vertical pager: card pages with the Vault and Bookmarks pages
          after the first. The route follows it (#/resources, #/bookmarks). */}
      <DashboardPage />
    </section>
  );
}

export default function AppLayout() {
  const settings = useSettingsStore((state) => state.settings);
  const ui = settings.ui || {};
  const customThemes = settings.customThemes || [];
  const activeCustomTheme = !isBuiltInPalette(ui.themePalette)
    ? customThemes.find((ct: any) => ct.id === ui.themePalette)
    : null;
  const initialCustomThemeVars = activeCustomTheme
    ? { light: activeCustomTheme.light, dark: activeCustomTheme.dark }
    : null;

  return (
    <ThemeProvider
      initialThemeMode={ui.themeMode}
      initialThemePalette={ui.themePalette}
      initialCustomThemeVars={initialCustomThemeVars}
    >
      <KBarProvider>
        <KBarWrapper>
          <AppLayoutInner />
        </KBarWrapper>
      </KBarProvider>
    </ThemeProvider>
  );
}
