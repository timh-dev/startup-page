import React from "react";
import { HiOutlineMoon, HiOutlineSun } from "react-icons/hi2";
import { ThemeContext } from "@/components/layout/ThemeContext";

export default function ThemeToggle() {
  const { theme, themeMode, setThemeMode } = React.useContext(ThemeContext);
  const nextTheme = themeMode === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className="toolbar-button"
      onClick={() => setThemeMode(nextTheme)}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <HiOutlineMoon /> : <HiOutlineSun />}
    </button>
  );
}
