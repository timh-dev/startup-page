import React from "react";

function read(): number {
  if (typeof window === "undefined") return 16;
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

/**
 * The root font size in px. It scales with the window (see `html` in
 * design-system.css), so anything sized in px from it, like the dashboard
 * grid, follows the window too.
 */
export function useRootFontSize(): number {
  const [size, setSize] = React.useState(read);
  React.useEffect(() => {
    const update = () => setSize(read());
    window.addEventListener("resize", update);
    update();
    return () => window.removeEventListener("resize", update);
  }, []);
  return size;
}
