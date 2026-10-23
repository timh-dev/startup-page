import {
  userBookmarks,
  userWidgets,
  userVaultItems,
  userReadItems,
  userThemes,
  userPreferences,
} from "./schema.js";
import type { SettingsDomainId } from "../../shared/settingsDomains.js";

// One table per settings domain (shared/settingsDomains.ts), each holding
// that domain's data for a user plus a server-assigned version.
export const DOMAIN_TABLE_ENTRIES = [
  { key: "bookmarks", table: userBookmarks } as const,
  { key: "widgets", table: userWidgets } as const,
  { key: "vaultItems", table: userVaultItems } as const,
  { key: "readItems", table: userReadItems } as const,
  { key: "themes", table: userThemes } as const,
  { key: "preferences", table: userPreferences } as const,
] satisfies Array<{ key: SettingsDomainId; table: unknown }>;

export type DomainKey = (typeof DOMAIN_TABLE_ENTRIES)[number]["key"];
export type DomainTable = (typeof DOMAIN_TABLE_ENTRIES)[number]["table"];
