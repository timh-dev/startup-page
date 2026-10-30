// The default palette's fonts (Inter, Playfair Display, JetBrains Mono) are
// bundled and load with the app. The other built-in palettes use fonts that
// most users never see, so their Google Fonts stylesheet is only requested
// when that palette is selected.

const GOOGLE_FONTS: Record<string, string> = {
  astrovista: "family=Outfit:wght@400..700&family=Merriweather:wght@400;700&family=Fira+Code:wght@400..500",
  "saas-blue": "family=Plus+Jakarta+Sans:wght@400..700&family=Source+Serif+4:opsz,wght@8..60,400..700&family=IBM+Plex+Mono:wght@400;500",
  moss: "family=Lora:ital,wght@0,400..700;1,400..700",
  resolve: "family=Open+Sans:wght@400..700",
};

const requested = new Set<string>();

export function ensurePaletteFonts(palette: string) {
  const families = GOOGLE_FONTS[palette];
  if (!families || requested.has(palette) || typeof document === "undefined") return;
  requested.add(palette);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
  document.head.appendChild(link);
}
