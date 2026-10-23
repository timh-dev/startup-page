import { z } from "zod";

// Matches the client's import cap (SETTINGS_MAX_IMPORT_BYTES).
export const MAX_SETTINGS_BYTES = 2 * 1024 * 1024;

const list = z.array(z.unknown());
const record = z.record(z.string(), z.unknown());
const nullableText = z.string().nullable();

// Checks the top-level shape only. Item contents evolve with the client and
// are normalized there, so they're accepted as-is; what this stops is a
// malformed push (a string where a list belongs, a non-object body)
// landing in a user's tables. Unknown top-level keys are dropped.
export const settingsSchema = z.object({
  bookmark: list.optional(),
  widgets: list.optional(),
  layout: record.optional(),
  vaultItems: list.optional(),
  readItems: list.optional(),
  customThemes: list.optional(),
  // Older clients stored coordinates from text inputs, so strings are accepted.
  latitude: z.union([z.number(), z.string()]).nullable().optional(),
  longitude: z.union([z.number(), z.string()]).nullable().optional(),
  units: nullableText.optional(),
  unsplashCredential: nullableText.optional(),
  openWeatherCredential: nullableText.optional(),
  ui: record.optional(),
  featurePanel: record.optional(),
  search: record.optional(),
  decorativeVideo: record.optional(),
  news: record.optional(),
  timer: record.optional(),
  unsplash: record.optional(),
});

export const settingsPutSchema = z.object({
  settings: settingsSchema,
  client_updated_at: z.iso.datetime({ offset: true }).nullable().optional(),
});

export type SettingsPut = z.infer<typeof settingsPutSchema>;
