// The settings object's top-level keys, grouped into domains. Cloud sync
// stores each domain in its own table (api/_lib/settingsDomains.ts), and the
// Data tab exports and imports them one at a time (src/lib/settings). This is
// the only copy of the grouping; both the client bundle and the API import it.
export const SETTINGS_DOMAINS = {
  bookmarks: { label: "Bookmarks", keys: ["bookmark"] },
  widgets: { label: "Widgets & layout", keys: ["widgets", "layout"] },
  vaultItems: { label: "Vault", keys: ["vaultItems"] },
  readItems: { label: "Reading list", keys: ["readItems"] },
  themes: { label: "Custom themes", keys: ["customThemes"] },
  preferences: {
    label: "Preferences",
    keys: [
      "latitude", "longitude", "units",
      "ui", "featurePanel", "search", "decorativeVideo", "news", "timer", "unsplash",
    ],
  },
} as const satisfies Record<string, { label: string; keys: readonly string[] }>;

export type SettingsDomainId = keyof typeof SETTINGS_DOMAINS;
