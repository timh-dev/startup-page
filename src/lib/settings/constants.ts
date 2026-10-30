import { SETTINGS_DOMAINS } from "../../../shared/settingsDomains";

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
// The sync engine's base record (src/lib/cloudSync.ts). Lives in the same
// store as SETTINGS_RECORD_KEY under a different key, so it needs no schema bump.
export const SYNCED_SNAPSHOT_RECORD_KEY = "workspace-settings-last-synced";
export const BACKUP_LIMIT = 10;
export const SETTINGS_EXPORT_FORMAT = "startup-page-settings";
export const SETTINGS_MAX_IMPORT_BYTES = 2 * 1024 * 1024;

// Indexable by any string so callers can look up a domain id from UI state.
export const DOMAIN_KEY_GROUPS: Record<string, { label: string; keys: readonly string[] }> = SETTINGS_DOMAINS;
