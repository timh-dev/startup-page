import React from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { KBarProvider, useRegisterActions } from "kbar";
import { HiArchiveBox, HiBookmark, HiHome, HiOutlineSquares2X2 } from "react-icons/hi2";

import { isBuiltInPalette } from "@/lib/theme-palettes";
import { useSettingsStore } from "@/features/settings/stores";
import { useLayoutEditStore } from "@/features/dashboard/stores/layoutEditStore";
import ThemeProvider, { ThemeContext, type ThemeMode } from "@/components/layout/ThemeContext";
import Toggle from "@/components/layout/ThemeToggle";
import SettingsButton from "@/features/settings/components/SettingsButton";
import BookmarkDialogs from "@/features/bookmarks/components/BookmarkDialogs";
import AccountButton from "@/features/auth/AccountButton";
import AuthBridge from "@/features/auth/AuthBridge";
import { useIsClerkAvailable } from "@/features/auth/ClerkStatus";
import CommandPalette from "@/components/layout/CommandPalette";
import useKBarActions from "@/features/dashboard/hooks/useKBarActions";
import DashboardPage from "@/features/dashboard/pages";

function KBarWrapper({ children }: { children: React.ReactNode }) {
  useKBarActions();
  return (
    <>
      <CommandPalette />
      {children}
    </>
  );
}

function VaultNavigationActions() {
  const navigate = useNavigate();

  const actions = React.useMemo(
    () => [
      {
        id: "open-bookmark-vault",
        name: "Open Bookmark Vault",
        shortcut: ["3"],
        section: "Navigation",
        perform: () => navigate("/bookmarks"),
      },
      {
        id: "open-resource-vault",
        name: "Open Resource Vault",
        shortcut: ["1"],
        section: "Navigation",
        perform: () => navigate("/resources"),
      },
      {
        id: "show-dashboard",
        name: "Show Dashboard",
        shortcut: ["2"],
        section: "Navigation",
        perform: () => navigate("/"),
      },
    ],
    [navigate],
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

  const isResources = location.pathname === "/resources";
  const isBookmarks = location.pathname === "/bookmarks";
  const isDashboard = !isResources && !isBookmarks;

  const editingLayout = useLayoutEditStore((state) => state.editing);
  const toggleLayoutEditing = useLayoutEditStore((state) => state.toggleEditing);
  const setLayoutEditing = useLayoutEditStore((state) => state.setEditing);

  // Leaving the dashboard should exit edit mode so the toggle (which only shows
  // on the dashboard) can't get stranded in the "on" state.
  React.useEffect(() => {
    if (!isDashboard && editingLayout) {
      setLayoutEditing(false);
    }
  }, [isDashboard, editingLayout, setLayoutEditing]);

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
        if (event.key === "1") {
          event.preventDefault();
          navigate("/resources");
          return;
        }
        if (event.key === "2") {
          event.preventDefault();
          navigate("/");
          return;
        }
        if (event.key === "3") {
          event.preventDefault();
          navigate("/bookmarks");
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate, isDashboard]);

  const handleWheel = React.useCallback(
    (event: React.WheelEvent) => {
      if (Math.abs(event.deltaX) < 72 || Math.abs(event.deltaX) < Math.abs(event.deltaY) * 1.35) {
        return;
      }
      const target = event.target as HTMLElement;
      if (target?.closest?.("input, textarea, select, [contenteditable='true']")) {
        return;
      }

      if (event.deltaX > 0) {
        if (isResources) {
          navigate("/");
        } else if (!isBookmarks) {
          navigate("/bookmarks");
        }
        return;
      }

      if (isBookmarks) {
        navigate("/");
      } else if (!isResources) {
        navigate("/resources");
      }
    },
    [navigate, isResources, isBookmarks],
  );

  return (
    <section
      className="relative min-h-screen overflow-x-hidden bg-background text-foreground transition-colors"
      onWheel={handleWheel}
    >
      <ThemeSync />
      {isClerkAvailable && <AuthBridge />}
      <VaultNavigationActions />
      <BookmarkDialogs />
      <nav className="vault-nav-center" aria-label="Page navigation">
        <button
          type="button"
          className={`vault-nav-button ${isResources ? "vault-nav-button-active" : ""}`}
          onClick={() => navigate("/resources")}
          title="Open Resource Vault (1)"
          aria-label="Resource Vault"
          aria-current={isResources ? "page" : undefined}
        >
          <HiArchiveBox className="size-4" />
          <span className="vault-nav-number">1</span>
        </button>
        <button
          type="button"
          className={`vault-nav-button ${isDashboard ? "vault-nav-button-active" : ""}`}
          onClick={() => navigate("/")}
          title="Dashboard (2)"
          aria-label="Dashboard"
          aria-current={isDashboard ? "page" : undefined}
        >
          <HiHome className="size-4" />
          <span className="vault-nav-number">2</span>
        </button>
        <button
          type="button"
          className={`vault-nav-button ${isBookmarks ? "vault-nav-button-active" : ""}`}
          onClick={() => navigate("/bookmarks")}
          title="Open Bookmark Vault (3)"
          aria-label="Bookmark Vault"
          aria-current={isBookmarks ? "page" : undefined}
        >
          <HiBookmark className="size-4" />
          <span className="vault-nav-number">3</span>
        </button>
      </nav>
      <div className="fixed right-5 top-5 z-40 flex items-center gap-3 text-foreground drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]">
        {isDashboard && (
          <button
            type="button"
            onClick={toggleLayoutEditing}
            className={`cursor-pointer text-4xl transition ${
              editingLayout ? "text-primary" : "text-current opacity-90 hover:opacity-100"
            }`}
            title={editingLayout ? "Finish editing layout" : "Edit layout"}
            aria-label="Edit dashboard layout"
            aria-pressed={editingLayout}
          >
            <HiOutlineSquares2X2 />
          </button>
        )}
        <Toggle />
        {isClerkAvailable && <AccountButton />}
        <SettingsButton />
      </div>
      {/* Dashboard stays mounted across navigation so the WebGL context is never destroyed.
          Shader compilation (1–3 s GPU sync) only happens once on first load, not on every
          return visit from /bookmarks or /resources. */}
      <div style={{ display: isDashboard ? "block" : "none" }} aria-hidden={!isDashboard}>
        <DashboardPage />
      </div>
      {!isDashboard && <Outlet />}
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
