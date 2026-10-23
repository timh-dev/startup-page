import {
  userBookmarks,
  userWidgets,
  userVaultItems,
  userReadItems,
  userThemes,
  userPreferences,
} from "./schema.js";

// The settings object's top-level keys that live in the "preferences" domain
// — everything that isn't its own dedicated table. Keep in sync with
// src/features/settings/components/DataTab.tsx's DOMAIN_KEY_GROUPS (the
// client-side mirror of this same mapping, used for per-domain export).
const PREFERENCE_KEYS = [
  "latitude",
  "longitude",
  "units",
  "unsplashCredential",
  "openWeatherCredential",
  "ui",
  "featurePanel",
  "search",
  "decorativeVideo",
  "news",
  "timer",
  "unsplash",
] as const;

// One entry per domain table, used to drive both the parallel GET fetch and
// the PUT transaction's upserts generically instead of repeating six
// near-identical blocks.
export const DOMAIN_TABLE_ENTRIES = [
  { key: "bookmarks", table: userBookmarks } as const,
  { key: "widgets", table: userWidgets } as const,
  { key: "vaultItems", table: userVaultItems } as const,
  { key: "readItems", table: userReadItems } as const,
  { key: "themes", table: userThemes } as const,
  { key: "preferences", table: userPreferences } as const,
];

export type DomainKey = (typeof DOMAIN_TABLE_ENTRIES)[number]["key"];

interface DomainRow {
  data: unknown;
  clientUpdatedAt: Date | null;
  serverUpdatedAt: Date;
}

export type DomainRows = Partial<Record<DomainKey, DomainRow>>;

/** Reconstruct the combined settings object exactly as the old single-blob shape. */
export function assembleSettings(rows: DomainRows): Record<string, unknown> {
  const widgetsData = (rows.widgets?.data as { widgets?: unknown; layout?: unknown } | undefined) ?? {};

  return {
    bookmark: rows.bookmarks?.data ?? [],
    widgets: widgetsData.widgets ?? [],
    layout: widgetsData.layout ?? {},
    vaultItems: rows.vaultItems?.data ?? [],
    readItems: rows.readItems?.data ?? [],
    customThemes: rows.themes?.data ?? [],
    ...((rows.preferences?.data as Record<string, unknown> | undefined) ?? {}),
  };
}

/** Split an incoming full settings object into the six per-table payloads to upsert. */
export function sliceSettingsIntoDomains(settings: Record<string, unknown>): Record<DomainKey, unknown> {
  const preferences: Record<string, unknown> = {};
  for (const key of PREFERENCE_KEYS) {
    if (key in settings) preferences[key] = settings[key];
  }

  return {
    bookmarks: settings.bookmark ?? [],
    widgets: { widgets: settings.widgets ?? [], layout: settings.layout ?? {} },
    vaultItems: settings.vaultItems ?? [],
    readItems: settings.readItems ?? [],
    themes: settings.customThemes ?? [],
    preferences,
  };
}

/** Latest of a set of (possibly absent) row timestamps, or null if none exist. */
export function maxTimestamp(rows: Array<DomainRow | undefined>, field: "clientUpdatedAt" | "serverUpdatedAt"): Date | null {
  let max: Date | null = null;
  for (const row of rows) {
    const value = row?.[field];
    if (value && (!max || value.getTime() > max.getTime())) {
      max = value;
    }
  }
  return max;
}
