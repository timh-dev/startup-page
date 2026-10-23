// Storage keys, format markers and the settings-domain grouping shared by the
// settings modules.

/** The whole settings object. Top-level keys are listed in DOMAIN_KEY_GROUPS. */
export type Settings = Record<string, any>;

export const SETTINGS_COOKIE_KEY = "settings";
export const SETTINGS_LOCAL_STORAGE_KEY = "startup-page.settings";
export const SETTINGS_DB_NAME = "startup-page-db";
export const SETTINGS_SCHEMA_VERSION = 2;
export const SETTINGS_STORE_NAME = "settings";
export const BACKUPS_STORE_NAME = "settings-backups";
export const SETTINGS_RECORD_KEY = "workspace-settings";
// The last settings snapshot both this device and the cloud agreed on — the
// three-way-merge base in syncSettingsFromCloud. Lives in the same store as
// SETTINGS_RECORD_KEY (just a different key), so it needs no schema bump.
export const SYNCED_SNAPSHOT_RECORD_KEY = "workspace-settings-last-synced";
export const BACKUP_LIMIT = 10;
export const SETTINGS_EXPORT_FORMAT = "startup-page-settings";
export const SETTINGS_MAX_IMPORT_BYTES = 2 * 1024 * 1024;

// Mirrors the domain split in api/_lib/settingsDomains.ts (user_bookmarks,
// user_widgets, user_vault_items, user_read_items, user_themes,
// user_preferences) — used client-side for per-domain export and for
// detecting which domains an imported file actually contains. Duplicated
// rather than shared across the api/ and src/ bundles since it's a small,
// stable list.
export const DOMAIN_KEY_GROUPS: Record<string, { label: string; keys: string[] }> = {
  bookmarks: { label: "Bookmarks", keys: ["bookmark"] },
  widgets: { label: "Widgets & layout", keys: ["widgets", "layout"] },
  vaultItems: { label: "Vault", keys: ["vaultItems"] },
  readItems: { label: "Reading list", keys: ["readItems"] },
  themes: { label: "Custom themes", keys: ["customThemes"] },
  preferences: {
    label: "Preferences",
    keys: [
      "latitude", "longitude", "units", "unsplashCredential", "openWeatherCredential",
      "ui", "featurePanel", "search", "decorativeVideo", "news", "timer", "unsplash",
    ],
  },
};
