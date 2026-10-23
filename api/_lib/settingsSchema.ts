import { z } from "zod";

// Matches the client's import cap (SETTINGS_MAX_IMPORT_BYTES).
export const MAX_SETTINGS_BYTES = 2 * 1024 * 1024;

const list = z.array(z.unknown());
const record = z.record(z.string(), z.unknown());
const nullableText = z.string().nullable();

// The shape of each domain's data (see shared/settingsDomains.ts). Only the
// top level is checked: item contents evolve with the client and are
// normalized there. What this stops is a malformed push (a string where a
// list belongs) landing in a user's tables. Unknown keys are dropped.
export const domainDataSchemas = {
  bookmarks: list,
  widgets: z.object({
    widgets: list.optional(),
    layout: record.optional(),
  }),
  vaultItems: list,
  readItems: list,
  themes: list,
  preferences: z.object({
    // Older clients stored coordinates from text inputs, so strings are accepted.
    latitude: z.union([z.number(), z.string()]).nullable().optional(),
    longitude: z.union([z.number(), z.string()]).nullable().optional(),
    units: nullableText.optional(),
    ui: record.optional(),
    featurePanel: record.optional(),
    search: record.optional(),
    decorativeVideo: record.optional(),
    news: record.optional(),
    timer: record.optional(),
    unsplash: record.optional(),
  }),
};

function domainChange<T extends z.ZodType>(data: T) {
  return z.object({
    data,
    // The version this change was made on top of; 0 when the client has
    // never seen a stored copy.
    base_version: z.number().int().min(0),
  });
}

export const settingsPutSchema = z.object({
  domains: z.object({
    bookmarks: domainChange(domainDataSchemas.bookmarks).optional(),
    widgets: domainChange(domainDataSchemas.widgets).optional(),
    vaultItems: domainChange(domainDataSchemas.vaultItems).optional(),
    readItems: domainChange(domainDataSchemas.readItems).optional(),
    themes: domainChange(domainDataSchemas.themes).optional(),
    preferences: domainChange(domainDataSchemas.preferences).optional(),
  }),
});

export type SettingsPut = z.infer<typeof settingsPutSchema>;
