// Shape normalization: merging saved settings over the defaults, one-time
// migrations of older shapes, and parsing stored records.
import defaultSettings from "../../config/settings.json";
import { ensureBookmarkIds, flattenGroups } from "@/features/bookmarks/lib/tree";
import type { WidgetInstance } from "@/lib/dashboard-dimensions";
import { adoptLegacyCredentials } from "@/lib/credentials";
import { DEFAULT_SCENE, applyScene } from "@/features/scenes/scenes";
import { LEGACY_CREDENTIAL_KEYS, stripWidgetCredentials } from "../../../shared/credentials";
import { SETTINGS_EXPORT_FORMAT, SETTINGS_SCHEMA_VERSION, type Settings } from "./constants";

export function isPlainObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
  }
  if (typeof a === "object") {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    return aKeys.length === bKeys.length && aKeys.every((key) => Object.prototype.hasOwnProperty.call(b, key) && deepEqual(a[key], b[key]));
  }
  return false;
}

export function mergeSettings(defaultValue: any, savedValue: any): any {
  if (Array.isArray(defaultValue)) {
    if (!Array.isArray(savedValue)) {
      return defaultValue;
    }

    return savedValue.map((item, index) =>
      index < defaultValue.length ? mergeSettings(defaultValue[index], item) : item
    );
  }

  if (isPlainObject(defaultValue)) {
    const source = isPlainObject(savedValue) ? savedValue : {};
    const merged: Record<string, any> = { ...source };

    Object.keys(defaultValue).forEach((key) => {
      merged[key] = mergeSettings(defaultValue[key], source[key]);
    });

    return merged;
  }

  return savedValue === undefined ? defaultValue : savedValue;
}

// ---------------------------------------------------------------------------
// Legacy fixed-tile → widget-instance migration
//
// Before the grid-native widget system, the dashboard was a fixed catalog of
// string tile ids (order/size/hidden lived in `layout.*`, and per-tile config
// was scattered across `unsplash.unsplashBoxN`, `layout.bookmarkBoxCategories`,
// and `featurePanel.*`). This reproduces that exact dashboard as a
// `widgets: WidgetInstance[]` array the first time it's seen — both for a
// genuinely brand-new install (nothing saved yet, so every legacy field is
// just its settings.json default) and for a real pre-widgets saved record.
// Runs at most once per record: see the `widgets` presence check in
// normalizeSettingsShape. Legacy fields are left in place afterward (unread,
// harmless) rather than deleted, in case of an early rollback.
// ---------------------------------------------------------------------------

const LEGACY_TILE_ORDER = [
  "videoTall", "videoSmall", "search", "bookmark1", "weather", "unsplash2",
  "bookmark2", "featurePanel", "unsplash3", "bookmark3", "solarGraph",
  "bookmark4", "bookmark5", "unsplash4", "unsplash5", "vaultPreview", "clock",
];

const LEGACY_TILE_SIZES: Record<string, string> = {
  videoTall: "tall", videoSmall: "small", search: "wide", bookmark1: "small",
  weather: "wide", unsplash2: "small", bookmark2: "small", featurePanel: "feature",
  unsplash3: "small", bookmark3: "small", solarGraph: "large", bookmark4: "small",
  bookmark5: "small", unsplash4: "small", unsplash5: "small", vaultPreview: "small",
  clock: "small",
};

// FeaturePanel's old ALL_MODES keys. Weather leads (the old panel opened on
// the Windy embed) so a new dashboard's stack opens on the native forecast.
const LEGACY_FEATURE_MODE_ORDER = [
  "weather", "windy", "headlines", "airQuality", "timer", "wikipedia", "rss", "github", "spotify", "unsplash",
];

function buildLegacyFeatureStackItems(featurePanel: Settings["featurePanel"], mergedSettings: Settings) {
  const enabledKeys = Array.isArray(featurePanel?.enabledModes) && featurePanel.enabledModes.length
    ? featurePanel.enabledModes
    : LEGACY_FEATURE_MODE_ORDER;
  // "weather" is always included, mirroring the old force-include rule.
  const modes = LEGACY_FEATURE_MODE_ORDER.filter((key) => enabledKeys.includes(key) || key === "weather");

  return modes.map((key): WidgetInstance | null => {
    switch (key) {
      case "windy":
        return { id: "legacy-stack-windy", type: "iframe", size: "small", config: { preset: "windy", url: "" } };
      case "weather":
        return { id: "legacy-stack-weather", type: "weather", size: "small", config: { variant: "detail" } };
      case "headlines":
        return { id: "legacy-stack-headlines", type: "headlines", size: "small", config: {} };
      case "airQuality":
        return { id: "legacy-stack-airQuality", type: "airQuality", size: "small", config: {} };
      case "timer":
        return { id: "legacy-stack-timer", type: "timer", size: "small", config: {} };
      case "wikipedia":
        return { id: "legacy-stack-wikipedia", type: "wikipedia", size: "small", config: {} };
      case "rss":
        return { id: "legacy-stack-rss", type: "rss", size: "small", config: { feedUrl: featurePanel?.rssFeedUrl ?? null } };
      case "github":
        return { id: "legacy-stack-github", type: "github", size: "small", config: { username: featurePanel?.githubUsername ?? null } };
      case "spotify":
        return { id: "legacy-stack-spotify", type: "spotify", size: "small", config: { clientId: featurePanel?.spotifyClientId ?? null } };
      case "unsplash":
        return {
          id: "legacy-stack-unsplash6",
          type: "photo",
          size: "small",
          config: { searchTerms: mergedSettings.unsplash?.unsplashBox6 ?? [] },
        };
      default:
        return null;
    }
  }).filter((item) => item !== null);
}

function synthesizeWidgetsFromLegacy(mergedSettings: Settings): WidgetInstance[] {
  const layout = mergedSettings.layout || {};
  const hidden = layout.hiddenBoxes || {};
  const sizes = layout.sizes || {};
  const savedOrder: string[] = Array.isArray(layout.order) ? layout.order : [];
  const known = savedOrder.filter((id) => LEGACY_TILE_ORDER.includes(id));
  const missing = LEGACY_TILE_ORDER.filter((id) => !known.includes(id));
  const order = known.length ? [...known, ...missing] : [...LEGACY_TILE_ORDER];

  const bookmarkBoxCategories = layout.bookmarkBoxCategories || [];
  const bookmarkGroups: Array<{ id: string }> = Array.isArray(mergedSettings.bookmark) ? mergedSettings.bookmark : [];
  const getBookmarkGroupId = (boxIndex: number) =>
    bookmarkGroups.find((group) => group.id === bookmarkBoxCategories[boxIndex])?.id
    ?? bookmarkGroups[boxIndex]?.id
    ?? bookmarkGroups[0]?.id
    ?? null;

  const decorativeVideoUrl = Array.isArray(mergedSettings.decorativeVideo?.urls)
    ? mergedSettings.decorativeVideo.urls[0] || ""
    : "";
  const videoZoom = mergedSettings.decorativeVideo?.zoom ?? 1.6;
  const videoOffsetX = mergedSettings.decorativeVideo?.offsetX ?? 0;
  const videoOffsetY = mergedSettings.decorativeVideo?.offsetY ?? 0;

  const widgets: WidgetInstance[] = [];

  for (const id of order) {
    if (hidden[id]) continue;
    const size = sizes[id] || LEGACY_TILE_SIZES[id] || "small";

    if (id === "featurePanel") {
      widgets.push({
        id: "legacy-featurePanel",
        type: "stack",
        size,
        config: {},
        items: buildLegacyFeatureStackItems(mergedSettings.featurePanel, mergedSettings),
      });
    } else if (id.startsWith("bookmark")) {
      const boxIndex = Number(id.replace("bookmark", "")) - 1;
      widgets.push({ id: `legacy-${id}`, type: "bookmark", size, config: { groupId: getBookmarkGroupId(boxIndex) } });
    } else if (id.startsWith("unsplash")) {
      const boxKey = `unsplashBox${id.replace("unsplash", "")}`;
      widgets.push({ id: `legacy-${id}`, type: "photo", size, config: { searchTerms: mergedSettings.unsplash?.[boxKey] ?? [] } });
    } else if (id === "videoTall" || id === "videoSmall") {
      widgets.push({
        id: `legacy-${id}`,
        type: "video",
        size,
        config: { url: decorativeVideoUrl, zoom: videoZoom, offsetX: videoOffsetX, offsetY: videoOffsetY },
      });
    } else if (id === "weather") {
      widgets.push({ id: "legacy-weather", type: "weather", size, config: { variant: "compact" } });
    } else if (id === "search") {
      widgets.push({ id: "legacy-search", type: "search", size, config: {} });
    } else if (id === "solarGraph") {
      widgets.push({ id: "legacy-solarGraph", type: "solarGraph", size, config: {} });
    } else if (id === "vaultPreview") {
      widgets.push({ id: "legacy-vaultPreview", type: "vault", size, config: {} });
    } else if (id === "clock") {
      widgets.push({ id: "legacy-clock", type: "clock", size, config: {} });
    }
  }

  return widgets;
}

function normalizeBookmarkBoxCategories(bookmarkBoxCategories: unknown, nextBookmarks: Array<{ id: string }>) {
  const nextFlatIds = new Set(flattenGroups(nextBookmarks).map((folder) => folder.id));
  const topLevelIds = nextBookmarks.map((group) => group.id);

  const entries = Array.isArray(bookmarkBoxCategories) ? bookmarkBoxCategories : [];

  return entries.map((entry, boxIndex) => {
    // Already migrated to an id from a previous run — keep it if it's still valid.
    if (typeof entry === "string") {
      return nextFlatIds.has(entry) ? entry : topLevelIds[boxIndex] || topLevelIds[0] || null;
    }

    // Legacy shape: a top-level array index into the bookmark array. Merge and
    // id-backfill both preserve top-level order/length, so the same index into
    // `nextBookmarks` still points at the same folder.
    const legacyIndex = Number(entry);
    const migratedId = Number.isInteger(legacyIndex) ? topLevelIds[legacyIndex] : undefined;
    return migratedId || topLevelIds[boxIndex] || topLevelIds[0] || null;
  });
}

export function normalizeSettingsShape(settings: Settings): Settings {
  // The one deliberate bootstrap call (`normalizeSettingsShape(defaultSettings)`,
  // below) is the only place `settings` can be this exact reference — every
  // real saved/imported/cloud-pulled record is a different object, even if it
  // happens to be content-identical. That's what lets a brand-new install and
  // a genuinely pre-`widgets` saved record share one migration path below,
  // while never re-synthesizing over a record that already has `widgets`
  // (even a legitimately emptied one).
  const isBootstrapSeed = settings === defaultSettings;
  // API keys live in the device-local credential store, never in settings.
  // Every load, import, restore and pull passes through here, so this is
  // where keys saved by older versions are picked up before being dropped.
  adoptLegacyCredentials(settings);
  const mergedSettings = mergeSettings(defaultSettings, settings);
  for (const key of LEGACY_CREDENTIAL_KEYS) delete mergedSettings[key];
  const decorativeVideo = mergedSettings.decorativeVideo || {};
  const bookmark = ensureBookmarkIds(mergedSettings.bookmark);
  const layout = {
    ...mergedSettings.layout,
    bookmarkBoxCategories: normalizeBookmarkBoxCategories(mergedSettings.layout?.bookmarkBoxCategories, bookmark),
  };

  if (isBootstrapSeed || !Array.isArray(settings?.widgets)) {
    mergedSettings.widgets = synthesizeWidgetsFromLegacy({ ...mergedSettings, bookmark });
  }

  let urls = Array.isArray(decorativeVideo.urls)
    ? decorativeVideo.urls
        .filter((value: unknown): value is string => typeof value === "string" && value.trim() !== "")
        .map((value: string) => value.trim())
        .slice(0, 10)
    : [];

  if (urls.length === 0 && typeof decorativeVideo.url === "string" && decorativeVideo.url.trim() !== "") {
    urls = [decorativeVideo.url.trim()];
  }

  return {
    ...mergedSettings,
    widgets: stripWidgetCredentials(mergedSettings.widgets),
    bookmark,
    layout,
    decorativeVideo: {
      ...decorativeVideo,
      urls,
      zoom: decorativeVideo.zoom ?? decorativeVideo.tall?.zoom ?? 1.6,
      offsetX: decorativeVideo.offsetX ?? decorativeVideo.tall?.offsetX ?? 0,
      offsetY: decorativeVideo.offsetY ?? decorativeVideo.tall?.offsetY ?? 0,
    },
  };
}

// Bookmark ids (and any other shape migrations normalizeSettingsShape applies)
// need to exist even before a user has ever saved settings, so every "brand
// new session" fallback below returns this instead of the raw JSON seed. A
// brand-new install starts in the default theme, cards and all.
export const seedSettings = normalizeSettingsShape(applyScene(normalizeSettingsShape(defaultSettings), DEFAULT_SCENE, "layout"));

export interface StoredSettingsRecord {
  schemaVersion: number;
  updatedAt: string;
  settings: Settings;
}

export function normalizeStoredRecord(record: any): StoredSettingsRecord | null {
  if (!record) {
    return null;
  }

  if (record.format === SETTINGS_EXPORT_FORMAT && isPlainObject(record.settings)) {
    return {
      schemaVersion: Number(record.schemaVersion) || SETTINGS_SCHEMA_VERSION,
      updatedAt: record.updatedAt || record.exportedAt || new Date().toISOString(),
      settings: normalizeSettingsShape(record.settings),
    };
  }

  if (isPlainObject(record.settings)) {
    return {
      schemaVersion: Number(record.schemaVersion) || SETTINGS_SCHEMA_VERSION,
      updatedAt: record.updatedAt || new Date().toISOString(),
      settings: normalizeSettingsShape(record.settings),
    };
  }

  if (isPlainObject(record)) {
    return {
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      settings: normalizeSettingsShape(record),
    };
  }

  return null;
}

export function parseSettings(rawSettings: string | null): Settings {
  if (!rawSettings) {
    return seedSettings;
  }

  try {
    const parsed = JSON.parse(rawSettings);
    const normalizedRecord = normalizeStoredRecord(parsed);
    if (normalizedRecord) {
      return normalizedRecord.settings;
    }

    return normalizeSettingsShape(parsed);
  } catch (_error) {
    return seedSettings;
  }
}
