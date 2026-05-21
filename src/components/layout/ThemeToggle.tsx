import React from "react";
import { HiMoon, HiSun } from "react-icons/hi";
import { ThemeContext } from "@/components/layout/ThemeContext";

const Toggle = () => {
  const { theme, themeMode, setThemeMode } = React.useContext(ThemeContext);
  const nextTheme = themeMode === "dark" ? "light" : "dark";

  return (
    <div className="transition duration-500 ease-in-out rounded-full p-1">
      {theme === "dark" ? (
        <HiMoon
          onClick={() => setThemeMode(nextTheme)}
          className="text-current text-4xl cursor-pointer"
        />
      ) : (
        <HiSun
          onClick={() => setThemeMode(nextTheme)}
          className="text-current text-4xl cursor-pointer"
        />
      )}
    </div>
  );
};

export default Toggle;
