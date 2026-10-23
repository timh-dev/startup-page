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

export const SETTINGS_DOMAIN_IDS = Object.keys(SETTINGS_DOMAINS) as SettingsDomainId[];

export type DomainSlices = Partial<Record<SettingsDomainId, unknown>>;

/**
 * Splits a settings object into one value per domain: the key's own value
 * for single-key domains (bookmarks → settings.bookmark), an object of the
 * keys for multi-key ones (widgets → { widgets, layout }). Keys that aren't
 * set are left out.
 */
export function sliceSettings(settings: Record<string, unknown>): Record<SettingsDomainId, unknown> {
  const slices = {} as Record<SettingsDomainId, unknown>;
  for (const id of SETTINGS_DOMAIN_IDS) {
    const keys: readonly string[] = SETTINGS_DOMAINS[id].keys;
    if (keys.length === 1) {
      slices[id] = settings[keys[0]];
    } else {
      const picked: Record<string, unknown> = {};
      for (const key of keys) {
        if (settings[key] !== undefined) picked[key] = settings[key];
      }
      slices[id] = picked;
    }
  }
  return slices;
}

/** The inverse of sliceSettings: the settings keys held by the given domains. */
export function assembleSettings(slices: DomainSlices): Record<string, unknown> {
  const settings: Record<string, unknown> = {};
  for (const id of SETTINGS_DOMAIN_IDS) {
    if (!(id in slices)) continue;
    const keys: readonly string[] = SETTINGS_DOMAINS[id].keys;
    const value = slices[id];
    if (keys.length === 1) {
      if (value !== undefined) settings[keys[0]] = value;
    } else if (value && typeof value === "object") {
      for (const key of keys) {
        const keyValue = (value as Record<string, unknown>)[key];
        if (keyValue !== undefined) settings[key] = keyValue;
      }
    }
  }
  return settings;
}

/** Every settings key that belongs to some domain. */
export const DOMAIN_SETTINGS_KEYS: readonly string[] = SETTINGS_DOMAIN_IDS.flatMap((id) => SETTINGS_DOMAINS[id].keys);
