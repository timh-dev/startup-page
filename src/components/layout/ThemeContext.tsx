import React from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

type ThemeVarsByMode = {
  light?: Record<string, string>;
  dark?: Record<string, string>;
};

interface ThemeContextValue {
  theme: ResolvedTheme;
  themeMode: ThemeMode;
  setThemeMode: React.Dispatch<React.SetStateAction<ThemeMode>>;
  themePalette: string;
  setThemePalette: React.Dispatch<React.SetStateAction<string>>;
  customThemeVars: ThemeVarsByMode | null;
  setCustomThemeVars: React.Dispatch<React.SetStateAction<ThemeVarsByMode | null>>;
}

interface ThemeProviderProps {
  initialThemeMode?: ThemeMode;
  initialThemePalette?: string;
  initialCustomThemeVars?: ThemeVarsByMode | null;
  children: React.ReactNode;
}

const resolveTheme = (themeMode: ThemeMode): ResolvedTheme => {
  if (
    themeMode === "system" &&
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }

  return themeMode === "dark" ? "dark" : "light";
};

export const ThemeContext = React.createContext<ThemeContextValue>({
  theme: "light",
  themeMode: "system",
  setThemeMode: () => undefined,
  themePalette: "zen",
  setThemePalette: () => undefined,
  customThemeVars: null,
  setCustomThemeVars: () => undefined,
});

const isThemeMode = (value: unknown): value is ThemeMode => (
  value === "light" || value === "dark" || value === "system"
);

const getInitialThemeMode = (initialThemeMode?: ThemeMode): ThemeMode => {
  if (initialThemeMode) {
    return initialThemeMode;
  }

  if (typeof window !== "undefined" && window.localStorage) {
    const storedThemeMode = window.localStorage.getItem("color-theme-mode");
    if (isThemeMode(storedThemeMode)) {
      return storedThemeMode;
    }

    const storedTheme = window.localStorage.getItem("color-theme");
    if (storedTheme === "light" || storedTheme === "dark") {
      return storedTheme;
    }
  }

  return "system";
};

const getInitialThemePalette = (initialThemePalette?: string) => {
  if (initialThemePalette) {
    return initialThemePalette;
  }

  if (typeof window !== "undefined" && window.localStorage) {
    const storedThemePalette = window.localStorage.getItem("color-theme-palette");
    if (typeof storedThemePalette === "string") {
      return storedThemePalette;
    }
  }

  return "zen";
};

const THEME_CSS_PROPS = [
  "--background", "--foreground", "--card", "--card-foreground",
  "--popover", "--popover-foreground", "--primary", "--primary-foreground",
  "--secondary", "--secondary-foreground", "--muted", "--muted-foreground",
  "--accent", "--accent-foreground", "--destructive", "--destructive-foreground",
  "--border", "--input", "--ring",
  "--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5",
  "--sidebar", "--sidebar-foreground", "--sidebar-primary", "--sidebar-primary-foreground",
  "--sidebar-accent", "--sidebar-accent-foreground", "--sidebar-border", "--sidebar-ring",
  "--font-sans", "--font-serif", "--font-mono",
  "--radius",
  "--shadow-2xs", "--shadow-xs", "--shadow-sm", "--shadow", "--shadow-md",
  "--shadow-lg", "--shadow-xl", "--shadow-2xl",
  "--tracking-normal",
];

function clearCustomThemeStyles(root: HTMLElement) {
  for (const prop of THEME_CSS_PROPS) {
    root.style.removeProperty(prop);
  }
}

export default function ThemeProvider({
  initialThemeMode,
  initialThemePalette,
  initialCustomThemeVars,
  children,
}: ThemeProviderProps) {
  const [themeMode, setThemeMode] = React.useState(() => getInitialThemeMode(initialThemeMode));
  const [themePalette, setThemePalette] = React.useState(() => getInitialThemePalette(initialThemePalette));
  const [theme, setTheme] = React.useState(() => resolveTheme(getInitialThemeMode(initialThemeMode)));
  const [customThemeVars, setCustomThemeVars] = React.useState(initialCustomThemeVars || null);

  const applyTheme = React.useCallback((
    rawThemeMode: ThemeMode,
    rawThemePalette: string,
    customVars: ThemeVarsByMode | null,
  ) => {
    const resolvedTheme = resolveTheme(rawThemeMode);
    const root = window.document.documentElement;
    const isDark = resolvedTheme === "dark";

    root.classList.remove(isDark ? "light" : "dark");
    root.classList.add(resolvedTheme);

    clearCustomThemeStyles(root);

    if (customVars) {
      root.dataset.theme = "custom";
      const modeVars = isDark ? customVars.dark : customVars.light;
      if (modeVars) {
        for (const [prop, value] of Object.entries(modeVars)) {
          root.style.setProperty(prop, value);
        }
      }
    } else {
      root.dataset.theme = rawThemePalette;
    }

    localStorage.setItem("color-theme", resolvedTheme);
    localStorage.setItem("color-theme-mode", rawThemeMode);
    localStorage.setItem("color-theme-palette", rawThemePalette);
    setTheme(resolvedTheme);
  }, []);

  React.useEffect(() => {
    applyTheme(themeMode, themePalette, customThemeVars);
  }, [applyTheme, themeMode, themePalette, customThemeVars]);

  React.useEffect(() => {
    if (themeMode !== "system") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyTheme("system", themePalette, customThemeVars);

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [applyTheme, themeMode, themePalette, customThemeVars]);

  const contextValue = React.useMemo(
    () => ({ theme, themeMode, setThemeMode, themePalette, setThemePalette, customThemeVars, setCustomThemeVars }),
    [theme, themeMode, themePalette, customThemeVars]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}
