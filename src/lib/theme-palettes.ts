/**
 * Central palette registry shared by SettingsButton, useKBarActions, and ThemeContext.
 */

export const BUILT_IN_PALETTES = [
  {
    value: "zen",
    title: "Zen",
    description: "Warm paper neutrals with quiet contrast.",
    swatches: {
      light: {
        background: "oklch(0.9195 0.0169 88.003)",
        card: "oklch(0.953 0.0156 86.4257)",
        primary: "oklch(0.3012 0 0)",
        accent: "oklch(0.9169 0.0175 99.616)",
        muted: "oklch(0.834 0.0232 87.163)",
      },
      dark: {
        background: "oklch(0.1913 0 0)",
        card: "oklch(0.2264 0 0)",
        primary: "oklch(0.852 0.0205 100.6306)",
        accent: "oklch(0.3329 0 0)",
        muted: "oklch(0.285 0 0)",
      },
    },
  },
  {
    value: "chalk",
    title: "Chalk",
    description: "Cool editorial surfaces with crisp navy ink.",
    swatches: {
      light: {
        background: "oklch(0.9745 0.0079 253.8524)",
        card: "oklch(0.9897 0.0051 247.8755)",
        primary: "oklch(0.2038 0.0264 260.9332)",
        accent: "oklch(0.9442 0.0137 258.3455)",
        muted: "oklch(0.9442 0.0137 258.3455)",
      },
      dark: {
        background: "oklch(0.2292 0.0304 259.0329)",
        card: "oklch(0.261 0.0307 254.7604)",
        primary: "oklch(0.8993 0.0119 239.9205)",
        accent: "oklch(0.3438 0.0389 254.6348)",
        muted: "oklch(0.2947 0.0308 258.3315)",
      },
    },
  },
  {
    value: "astrovista",
    title: "Astrovista",
    description: "Soft space-age neutrals with brighter highlights.",
    swatches: {
      light: {
        background: "oklch(0.9383 0.0042 236.4993)",
        card: "oklch(1 0 0)",
        primary: "oklch(0.642 0.1691 38.5815)",
        accent: "oklch(0.9119 0.0222 243.8174)",
        muted: "oklch(0.9846 0.0017 247.8389)",
      },
      dark: {
        background: "oklch(0.2178 0 0)",
        card: "oklch(0.2435 0 0)",
        primary: "oklch(0.642 0.1691 38.5815)",
        accent: "oklch(0.338 0.0589 267.5867)",
        muted: "oklch(0.285 0 0)",
      },
    },
  },
  {
    value: "saas-blue",
    title: "SaaS Blue",
    description: "Polished corporate blue with clean surfaces.",
    swatches: {
      light: {
        background: "oklch(0.9725 0.0125 250)",
        card: "oklch(0.995 0.0025 250)",
        primary: "oklch(0.545 0.195 260)",
        accent: "oklch(0.935 0.035 250)",
        muted: "oklch(0.945 0.015 250)",
      },
      dark: {
        background: "oklch(0.195 0.025 260)",
        card: "oklch(0.235 0.03 258)",
        primary: "oklch(0.665 0.18 255)",
        accent: "oklch(0.315 0.045 260)",
        muted: "oklch(0.275 0.03 260)",
      },
    },
  },
  {
    value: "moss",
    title: "Moss",
    description: "Earthy olive greens with organic warmth.",
    swatches: {
      light: {
        background: "oklch(0.955 0.02 130)",
        card: "oklch(0.98 0.012 130)",
        primary: "oklch(0.42 0.1 145)",
        accent: "oklch(0.925 0.035 130)",
        muted: "oklch(0.91 0.025 135)",
      },
      dark: {
        background: "oklch(0.2 0.02 145)",
        card: "oklch(0.24 0.025 142)",
        primary: "oklch(0.65 0.12 140)",
        accent: "oklch(0.32 0.04 145)",
        muted: "oklch(0.28 0.025 142)",
      },
    },
  },
  {
    value: "resolve",
    title: "Resolve",
    description: "Deep violet focus with crisp readability.",
    swatches: {
      light: {
        background: "oklch(0.965 0.015 295)",
        card: "oklch(0.99 0.006 295)",
        primary: "oklch(0.49 0.2 290)",
        accent: "oklch(0.93 0.04 295)",
        muted: "oklch(0.94 0.02 295)",
      },
      dark: {
        background: "oklch(0.2 0.025 290)",
        card: "oklch(0.245 0.03 288)",
        primary: "oklch(0.65 0.175 285)",
        accent: "oklch(0.325 0.05 290)",
        muted: "oklch(0.28 0.03 290)",
      },
    },
  },
  {
    value: "vtron",
    title: "VTRON",
    description: "Neon terminal glow on midnight black.",
    swatches: {
      light: {
        background: "oklch(0.955 0.025 165)",
        card: "oklch(0.985 0.01 165)",
        primary: "oklch(0.72 0.19 165)",
        accent: "oklch(0.93 0.04 165)",
        muted: "oklch(0.935 0.02 165)",
      },
      dark: {
        background: "oklch(0.145 0.015 165)",
        card: "oklch(0.185 0.02 165)",
        primary: "oklch(0.78 0.2 165)",
        accent: "oklch(0.25 0.04 165)",
        muted: "oklch(0.22 0.025 165)",
      },
    },
  },
  {
    value: "space",
    title: "Space",
    description: "Night-sky indigo with starlight highlights.",
    swatches: {
      light: {
        background: "oklch(0.9250 0.0140 268)",
        card: "oklch(0.9620 0.0100 268)",
        primary: "oklch(0.3300 0.0750 272)",
        accent: "oklch(0.9050 0.0220 268)",
        muted: "oklch(0.8600 0.0200 268)",
      },
      dark: {
        background: "oklch(0.1500 0.0300 268)",
        card: "oklch(0.1920 0.0340 268)",
        primary: "oklch(0.8300 0.0750 250)",
        accent: "oklch(0.2900 0.0400 268)",
        muted: "oklch(0.2550 0.0350 268)",
      },
    },
  },
  {
    value: "ocean",
    title: "Ocean",
    description: "Sea-glass teal over sandy paper.",
    swatches: {
      light: {
        background: "oklch(0.9300 0.0180 200)",
        card: "oklch(0.9650 0.0120 195)",
        primary: "oklch(0.4600 0.0950 218)",
        accent: "oklch(0.9100 0.0300 190)",
        muted: "oklch(0.8600 0.0300 200)",
      },
      dark: {
        background: "oklch(0.1700 0.0320 228)",
        card: "oklch(0.2080 0.0360 225)",
        primary: "oklch(0.8000 0.0950 195)",
        accent: "oklch(0.3000 0.0500 215)",
        muted: "oklch(0.2700 0.0400 225)",
      },
    },
  },
  {
    value: "arctic",
    title: "Arctic",
    description: "Ice-white surfaces with glacier blue.",
    swatches: {
      light: {
        background: "oklch(0.9550 0.0120 232)",
        card: "oklch(0.9880 0.0060 232)",
        primary: "oklch(0.5000 0.1100 242)",
        accent: "oklch(0.9300 0.0250 225)",
        muted: "oklch(0.9000 0.0200 232)",
      },
      dark: {
        background: "oklch(0.1900 0.0220 242)",
        card: "oklch(0.2320 0.0240 240)",
        primary: "oklch(0.8600 0.0700 220)",
        accent: "oklch(0.3200 0.0350 238)",
        muted: "oklch(0.2900 0.0300 240)",
      },
    },
  },
  {
    value: "desert",
    title: "Desert",
    description: "Sandstone and terracotta, sun-warmed.",
    swatches: {
      light: {
        background: "oklch(0.9150 0.0280 68)",
        card: "oklch(0.9520 0.0200 75)",
        primary: "oklch(0.5200 0.1250 42)",
        accent: "oklch(0.9050 0.0350 72)",
        muted: "oklch(0.8500 0.0350 68)",
      },
      dark: {
        background: "oklch(0.1850 0.0140 50)",
        card: "oklch(0.2220 0.0170 52)",
        primary: "oklch(0.7800 0.1050 55)",
        accent: "oklch(0.3100 0.0250 50)",
        muted: "oklch(0.2800 0.0200 50)",
      },
    },
  },
];

export function isBuiltInPalette(value: string) {
  return BUILT_IN_PALETTES.some((p) => p.value === value);
}

const CSS_VAR_RE = /--([\w-]+)\s*:\s*([^;]+)/g;

/**
 * Parse CSS text containing `:root { --var: val; }` and `.dark { --var: val; }` blocks.
 * Returns { light: { '--var': 'val', ... }, dark: { '--var': 'val', ... } }
 */
export function parseCustomThemeCSS(cssText: string) {
  const light: Record<string, string> = {};
  const dark: Record<string, string> = {};

  const blockRe = /([^{]*)\{([^}]*)\}/g;
  let match;

  while ((match = blockRe.exec(cssText)) !== null) {
    const selector = match[1].trim();
    const body = match[2];

    const isDark =
      selector.includes(".dark") ||
      selector.includes('[class*="dark"]') ||
      selector.includes("dark");
    const isRoot =
      selector.includes(":root") ||
      selector.includes("html") ||
      selector === "" ||
      selector === "*";

    // Determine which bucket: if selector mentions dark, it's dark; otherwise light
    const target = isDark && !isRoot ? dark : selector.includes(".dark") ? dark : light;

    let varMatch;
    CSS_VAR_RE.lastIndex = 0;
    while ((varMatch = CSS_VAR_RE.exec(body)) !== null) {
      const varName = `--${varMatch[1]}`;
      const varValue = varMatch[2].trim();
      target[varName] = varValue;
    }
  }

  if (Object.keys(light).length === 0 && Object.keys(dark).length === 0) {
    throw new Error("No CSS custom properties found. Paste CSS with :root { --variable: value; } blocks.");
  }

  return { light, dark };
}

const SWATCH_KEYS = ["--background", "--card", "--primary", "--accent", "--muted"];

/**
 * Extract the 5 swatch colors from a stored custom theme for a given mode.
 */
export function getSwatchesFromCustomTheme(
  customTheme: { light: Record<string, string>; dark: Record<string, string> },
  mode: "light" | "dark",
) {
  const vars = mode === "dark" ? customTheme.dark : customTheme.light;
  const result: Record<string, string> = {};
  for (const key of SWATCH_KEYS) {
    const shortKey = key.replace("--", "");
    result[shortKey] = vars[key] || "oklch(0.5 0 0)";
  }
  return result;
}
