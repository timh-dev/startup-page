import Cookies from "js-cookie";
import defaultSettings from "../config/settings.json";
import { ensureBookmarkIds, flattenGroups } from "@/features/bookmarks/lib/tree";

const SETTINGS_COOKIE_KEY = "settings";
const SETTINGS_LOCAL_STORAGE_KEY = "startup-page.settings";
const SETTINGS_DB_NAME = "startup-page-db";
const SETTINGS_SCHEMA_VERSION = 2;
const SETTINGS_STORE_NAME = "settings";
const BACKUPS_STORE_NAME = "settings-backups";
const SETTINGS_RECORD_KEY = "workspace-settings";
// The last settings snapshot both this device and the cloud agreed on — the
// three-way-merge base in syncSettingsFromCloud. Lives in the same store as
// SETTINGS_RECORD_KEY (just a different key), so it needs no schema bump.
const SYNCED_SNAPSHOT_RECORD_KEY = "workspace-settings-last-synced";
const BACKUP_LIMIT = 10;
const SETTINGS_EXPORT_FORMAT = "startup-page-settings";
const SETTINGS_MAX_IMPORT_BYTES = 2 * 1024 * 1024;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function deepEqual(a, b) {
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

export function mergeSettings(defaultValue, savedValue) {
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
    const merged = { ...source };

    Object.keys(defaultValue).forEach((key) => {
      merged[key] = mergeSettings(defaultValue[key], source[key]);
    });

    return merged;
  }

  return savedValue === undefined ? defaultValue : savedValue;
}

function createSettingsEnvelope(settings, overrides = {}) {
  return {
    format: SETTINGS_EXPORT_FORMAT,
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    settings: mergeSettings(defaultSettings, settings),
    ...overrides,
  };
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

const LEGACY_TILE_SIZES = {
  videoTall: "tall", videoSmall: "small", search: "wide", bookmark1: "small",
  weather: "wide", unsplash2: "small", bookmark2: "small", featurePanel: "feature",
  unsplash3: "small", bookmark3: "small", solarGraph: "large", bookmark4: "small",
  bookmark5: "small", unsplash4: "small", unsplash5: "small", vaultPreview: "small",
  clock: "small",
};

// Mirrors FeaturePanel's old ALL_MODES order/keys.
const LEGACY_FEATURE_MODE_ORDER = [
  "windy", "weather", "headlines", "airQuality", "timer", "wikipedia", "rss", "github", "spotify", "unsplash",
];

function buildLegacyFeatureStackItems(featurePanel, mergedSettings) {
  const enabledKeys = Array.isArray(featurePanel?.enabledModes) && featurePanel.enabledModes.length
    ? featurePanel.enabledModes
    : LEGACY_FEATURE_MODE_ORDER;
  // "weather" is always included, mirroring the old force-include rule.
  const modes = LEGACY_FEATURE_MODE_ORDER.filter((key) => enabledKeys.includes(key) || key === "weather");

  return modes.map((key) => {
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
  }).filter(Boolean);
}

function synthesizeWidgetsFromLegacy(mergedSettings) {
  const layout = mergedSettings.layout || {};
  const hidden = layout.hiddenBoxes || {};
  const sizes = layout.sizes || {};
  const savedOrder = Array.isArray(layout.order) ? layout.order : [];
  const known = savedOrder.filter((id) => LEGACY_TILE_ORDER.includes(id));
  const missing = LEGACY_TILE_ORDER.filter((id) => !known.includes(id));
  const order = known.length ? [...known, ...missing] : [...LEGACY_TILE_ORDER];

  const bookmarkBoxCategories = layout.bookmarkBoxCategories || [];
  const bookmarkGroups = Array.isArray(mergedSettings.bookmark) ? mergedSettings.bookmark : [];
  const getBookmarkGroupId = (boxIndex) =>
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

  const widgets = [];

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

function normalizeBookmarkBoxCategories(bookmarkBoxCategories, nextBookmarks) {
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

export function normalizeSettingsShape(settings) {
  // The one deliberate bootstrap call (`normalizeSettingsShape(defaultSettings)`,
  // below) is the only place `settings` can be this exact reference — every
  // real saved/imported/cloud-pulled record is a different object, even if it
  // happens to be content-identical. That's what lets a brand-new install and
  // a genuinely pre-`widgets` saved record share one migration path below,
  // while never re-synthesizing over a record that already has `widgets`
  // (even a legitimately emptied one).
  const isBootstrapSeed = settings === defaultSettings;
  const mergedSettings = mergeSettings(defaultSettings, settings);
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
        .filter((value) => typeof value === "string" && value.trim() !== "")
        .map((value) => value.trim())
        .slice(0, 10)
    : [];

  if (urls.length === 0 && typeof decorativeVideo.url === "string" && decorativeVideo.url.trim() !== "") {
    urls = [decorativeVideo.url.trim()];
  }

  return {
    ...mergedSettings,
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
// new session" fallback below returns this instead of the raw JSON seed.
const seedSettings = normalizeSettingsShape(defaultSettings);

interface StoredSettingsRecord {
  schemaVersion: number;
  updatedAt: string;
  settings: Record<string, any>;
}

function normalizeStoredRecord(record): StoredSettingsRecord | null {
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

function parseSettings(rawSettings) {
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

function getIndexedDb(): Promise<IDBDatabase | null> {
  return new Promise<IDBDatabase | null>((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      resolve(null);
      return;
    }

    const request = window.indexedDB.open(SETTINGS_DB_NAME, SETTINGS_SCHEMA_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
        db.createObjectStore(SETTINGS_STORE_NAME);
      }
      if (!db.objectStoreNames.contains(BACKUPS_STORE_NAME)) {
        db.createObjectStore(BACKUPS_STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readSettingsFromIndexedDb(): Promise<StoredSettingsRecord | null> {
  const db = await getIndexedDb();
  if (!db) {
    return null;
  }

  return new Promise<StoredSettingsRecord | null>((resolve, reject) => {
    const transaction = db.transaction(SETTINGS_STORE_NAME, "readonly");
    const store = transaction.objectStore(SETTINGS_STORE_NAME);
    const request = store.get(SETTINGS_RECORD_KEY);

    request.onsuccess = () => {
      resolve(normalizeStoredRecord(request.result));
    };
    request.onerror = () => reject(request.error);
  });
}

async function countBackupsInIndexedDb() {
  const db = await getIndexedDb();
  if (!db || !db.objectStoreNames.contains(BACKUPS_STORE_NAME)) {
    return 0;
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BACKUPS_STORE_NAME, "readonly");
    const store = transaction.objectStore(BACKUPS_STORE_NAME);
    const request = store.count();

    request.onsuccess = () => resolve(request.result || 0);
    request.onerror = () => reject(request.error);
  });
}

async function writeSettingsToIndexedDb(settings) {
  const db = await getIndexedDb();
  if (!db) {
    return null;
  }

  const record = {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    settings: normalizeSettingsShape(settings),
  };

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(
      [SETTINGS_STORE_NAME, BACKUPS_STORE_NAME],
      "readwrite"
    );
    const settingsStore = transaction.objectStore(SETTINGS_STORE_NAME);
    const backupsStore = transaction.objectStore(BACKUPS_STORE_NAME);

    settingsStore.put(record, SETTINGS_RECORD_KEY);

    const backupRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      createdAt: record.updatedAt,
      settings: record.settings,
    };
    backupsStore.put(backupRecord);

    const getAllKeysRequest = backupsStore.getAllKeys();
    getAllKeysRequest.onsuccess = () => {
      const sortedKeys = [...(getAllKeysRequest.result || [])].sort();
      const overflow = sortedKeys.length - BACKUP_LIMIT;
      if (overflow > 0) {
        sortedKeys.slice(0, overflow).forEach((key) => backupsStore.delete(key));
      }
    };
    getAllKeysRequest.onerror = () => reject(getAllKeysRequest.error);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

  return record;
}

async function readSyncedSnapshotFromIndexedDb(): Promise<StoredSettingsRecord | null> {
  const db = await getIndexedDb();
  if (!db) {
    return null;
  }

  return new Promise<StoredSettingsRecord | null>((resolve, reject) => {
    const transaction = db.transaction(SETTINGS_STORE_NAME, "readonly");
    const request = transaction.objectStore(SETTINGS_STORE_NAME).get(SYNCED_SNAPSHOT_RECORD_KEY);

    request.onsuccess = () => resolve(normalizeStoredRecord(request.result));
    request.onerror = () => reject(request.error);
  });
}

async function writeSyncedSnapshotToIndexedDb(settings, updatedAt: string) {
  const db = await getIndexedDb();
  if (!db) {
    return;
  }

  const record = { schemaVersion: SETTINGS_SCHEMA_VERSION, updatedAt, settings };

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(SETTINGS_STORE_NAME, "readwrite");
    transaction.objectStore(SETTINGS_STORE_NAME).put(record, SYNCED_SNAPSHOT_RECORD_KEY);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

/** Called after a push the server actually accepted, so the next sync's merge diffs against what's really up there. */
export async function markSyncedSnapshot(settings, updatedAt: string) {
  await writeSyncedSnapshotToIndexedDb(normalizeSettingsShape(settings), updatedAt);
}

async function clearSettingsFromIndexedDb() {
  const db = await getIndexedDb();
  if (!db) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(
      [SETTINGS_STORE_NAME, BACKUPS_STORE_NAME],
      "readwrite"
    );
    transaction.objectStore(SETTINGS_STORE_NAME).delete(SETTINGS_RECORD_KEY);
    transaction.objectStore(BACKUPS_STORE_NAME).clear();

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function readSettingsFromLocalStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  return window.localStorage.getItem(SETTINGS_LOCAL_STORAGE_KEY);
}

function writeSettingsToLocalStorage(settings) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(SETTINGS_LOCAL_STORAGE_KEY, JSON.stringify(settings));
}

function clearSettingsFromLocalStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.removeItem(SETTINGS_LOCAL_STORAGE_KEY);
}

function migrateCookieSettings() {
  const cookieSettings = Cookies.get(SETTINGS_COOKIE_KEY);
  if (!cookieSettings) {
    return null;
  }

  Cookies.remove(SETTINGS_COOKIE_KEY);
  return parseSettings(cookieSettings);
}

function normalizeImportPayload(rawText) {
  if (typeof rawText !== "string" || rawText.trim() === "") {
    throw new Error("Backup file is empty.");
  }

  if (rawText.length > SETTINGS_MAX_IMPORT_BYTES) {
    throw new Error("Backup file is too large.");
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (_error) {
    throw new Error("Backup file is not valid JSON.");
  }

  if (!isPlainObject(parsed)) {
    throw new Error("Backup file must contain a JSON object.");
  }

  if (parsed.format && parsed.format !== SETTINGS_EXPORT_FORMAT) {
    throw new Error("Backup file format is not recognized.");
  }

  const candidateSettings = isPlainObject(parsed.settings) ? parsed.settings : parsed;
  const mergedSettings = normalizeSettingsShape(candidateSettings);

  return {
    settings: mergedSettings,
    metadata: {
      format: parsed.format || SETTINGS_EXPORT_FORMAT,
      schemaVersion: Number(parsed.schemaVersion) || 1,
      exportedAt: parsed.exportedAt || null,
    },
  };
}

export function readSettings() {
  const cachedSettings = readSettingsFromLocalStorage();
  if (cachedSettings) {
    return parseSettings(cachedSettings);
  }

  const migratedCookieSettings = migrateCookieSettings();
  if (migratedCookieSettings) {
    writeSettingsToLocalStorage(migratedCookieSettings);
    void writeSettingsToIndexedDb(migratedCookieSettings);
    return migratedCookieSettings;
  }

  return seedSettings;
}

export async function writeSettings(settings) {
  const mergedSettings = normalizeSettingsShape(settings);
  writeSettingsToLocalStorage(mergedSettings);
  Cookies.remove(SETTINGS_COOKIE_KEY);
  const record = await writeSettingsToIndexedDb(mergedSettings);
  const updatedAt = record?.updatedAt || new Date().toISOString();

  // Dynamic import avoids a circular module graph (cloudSync → auth/stores, not settings)
  void import("@/lib/cloudSync").then(({ schedulePushToCloud }) => {
    schedulePushToCloud(mergedSettings as Record<string, unknown>, updatedAt);
  });

  return { settings: mergedSettings, updatedAt };
}

export async function resetSettings() {
  clearSettingsFromLocalStorage();
  Cookies.remove(SETTINGS_COOKIE_KEY);
  await clearSettingsFromIndexedDb();
  writeSettingsToLocalStorage(seedSettings);
  const record = await writeSettingsToIndexedDb(seedSettings);
  return {
    settings: seedSettings,
    updatedAt: record?.updatedAt || new Date().toISOString(),
  };
}

export async function hydrateSettingsFromIndexedDb() {
  const indexedDbRecord = await readSettingsFromIndexedDb();
  if (!indexedDbRecord) {
    return readSettings();
  }

  writeSettingsToLocalStorage(indexedDbRecord.settings);
  return indexedDbRecord.settings;
}

/**
 * Three-way merge, per top-level settings key, of `local` and `cloud` against
 * their last common `base`. A key changed on only one side just takes that
 * side's value; a key changed *differently* on both sides is a real conflict
 * (reported in `conflictKeys`) resolved by whichever side is newer.
 * `localHasUniqueChanges` tells the caller whether the merge result needs to
 * be pushed back up (local had something the cloud doesn't have yet).
 * Pure and side-effect-free so it can be unit tested directly.
 */
export function mergeSettingsSnapshots(
  base: Record<string, unknown>,
  local: Record<string, unknown>,
  cloud: Record<string, unknown>,
  cloudUpdatedAt: number,
  localUpdatedAt: number,
): { merged: Record<string, unknown>; conflictKeys: string[]; localHasUniqueChanges: boolean } {
  const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(cloud)]);
  const merged: Record<string, unknown> = {};
  const conflictKeys: string[] = [];
  let localHasUniqueChanges = false;

  for (const key of keys) {
    const baseVal = base[key];
    const localVal = local[key];
    const cloudVal = cloud[key];
    const localChanged = !deepEqual(localVal, baseVal);
    const cloudChanged = !deepEqual(cloudVal, baseVal);

    if (localChanged && cloudChanged && !deepEqual(localVal, cloudVal)) {
      conflictKeys.push(key);
      merged[key] = cloudUpdatedAt >= localUpdatedAt ? cloudVal : localVal;
    } else if (cloudChanged) {
      merged[key] = cloudVal;
    } else {
      merged[key] = localVal;
      if (localChanged) localHasUniqueChanges = true;
    }
  }

  return { merged, conflictKeys, localHasUniqueChanges };
}

/**
 * Pull cloud settings and reconcile with the local copy.
 * - No local copy yet, or no synced-snapshot base to diff against (first
 *   sync ever on this device): whole-blob compare by timestamp, same as
 *   before — cloud wins if newer, otherwise local wins and gets pushed up.
 * - Otherwise: three-way merge against the last snapshot both sides agreed
 *   on (see markSyncedSnapshot), per top-level settings key (`widgets`,
 *   `bookmark`, `vaultItems`, ...). A key changed on only one side just
 *   takes that side's value, so e.g. editing the layout on desktop and
 *   bookmarks on a phone — while each was offline or between syncs — no
 *   longer has one whole copy clobber the other. Only a key edited
 *   *differently* on both sides is a real conflict; those fall back to
 *   newer-wins and get surfaced via useAuthStore's setMergeInfo so it's not
 *   silent.
 * - Pull failed for any reason (no token yet, offline, server error, no
 *   subscription, ...): do nothing. Treating a failed pull as "cloud is
 *   empty" is what let an empty local copy silently overwrite real synced
 *   data, so a failure must never trigger a push.
 * Returns the applied settings when local state changed, otherwise null.
 */
export async function syncSettingsFromCloud() {
  try {
    const { pullSettingsFromCloud, schedulePushToCloud } = await import("@/lib/cloudSync");
    const { useAuthStore } = await import("@/features/auth/stores");
    const [cloudResult, localRecord, syncedSnapshot] = await Promise.all([
      pullSettingsFromCloud(),
      readSettingsFromIndexedDb(),
      readSyncedSnapshotFromIndexedDb(),
    ]);

    if (cloudResult.status === "error") {
      return null;
    }

    if (cloudResult.status === "empty") {
      // Confirmed (via 404) that there's genuinely nothing in the cloud yet
      // — seed it with the local copy.
      if (localRecord) {
        schedulePushToCloud(localRecord.settings, localRecord.updatedAt);
        void writeSyncedSnapshotToIndexedDb(localRecord.settings, localRecord.updatedAt);
      }
      return null;
    }

    const cloudSettings = normalizeSettingsShape(cloudResult.settings);
    const cloudUpdatedAt = Date.parse(cloudResult.clientUpdatedAt || cloudResult.serverUpdatedAt || "") || 0;
    const localUpdatedAt = localRecord ? Date.parse(localRecord.updatedAt) || 0 : 0;

    if (!localRecord || !syncedSnapshot) {
      if (cloudUpdatedAt >= localUpdatedAt) {
        writeSettingsToLocalStorage(cloudSettings);
        void writeSettingsToIndexedDb(cloudSettings);
        void writeSyncedSnapshotToIndexedDb(cloudSettings, cloudResult.serverUpdatedAt || new Date().toISOString());
        return cloudSettings;
      }
      // Local wins — sync it up instead of clobbering offline edits.
      schedulePushToCloud(localRecord.settings, localRecord.updatedAt);
      void writeSyncedSnapshotToIndexedDb(localRecord.settings, localRecord.updatedAt);
      return null;
    }

    const localSettings = localRecord.settings;
    const { merged, conflictKeys, localHasUniqueChanges } = mergeSettingsSnapshots(
      syncedSnapshot.settings,
      localSettings,
      cloudSettings,
      cloudUpdatedAt,
      localUpdatedAt,
    );

    const normalizedMerged = normalizeSettingsShape(merged);
    const mergedDiffersFromLocal = !deepEqual(normalizedMerged, localSettings);

    let updatedAt = localRecord.updatedAt;
    if (mergedDiffersFromLocal) {
      writeSettingsToLocalStorage(normalizedMerged);
      const record = await writeSettingsToIndexedDb(normalizedMerged);
      updatedAt = record?.updatedAt || new Date().toISOString();
    }
    void writeSyncedSnapshotToIndexedDb(normalizedMerged, updatedAt);

    if (localHasUniqueChanges || conflictKeys.length) {
      schedulePushToCloud(normalizedMerged, updatedAt);
    }

    if (conflictKeys.length) {
      useAuthStore.getState().setMergeInfo(conflictKeys);
    } else {
      useAuthStore.getState().clearMergeInfo();
    }

    return mergedDiffersFromLocal ? normalizedMerged : null;
  } catch {
    return null;
  }
}

export async function getStorageDiagnostics() {
  const indexedDbRecord = await readSettingsFromIndexedDb();
  const backupCount = await countBackupsInIndexedDb();

  return {
    indexedDbAvailable: typeof window !== "undefined" && Boolean(window.indexedDB),
    localStorageAvailable: typeof window !== "undefined" && Boolean(window.localStorage),
    backupCount,
    lastSavedAt: indexedDbRecord?.updatedAt || null,
    schemaVersion: SETTINGS_SCHEMA_VERSION,
  };
}

export function exportSettingsBlob(settings) {
  const envelope = createSettingsEnvelope(settings, {
    app: {
      name: "startup-page",
    },
  });

  return new Blob([JSON.stringify(envelope, null, 2)], {
    type: "application/json",
  });
}

export function createSettingsExportFilename() {
  const isoDate = new Date().toISOString().replace(/[:.]/g, "-");
  return `startup-page-settings-${isoDate}.json`;
}

export async function importSettingsFromFile(file) {
  const rawFile = await file.text();
  const imported = normalizeImportPayload(rawFile);
  const result = await writeSettings(imported.settings);

  return {
    settings: result.settings,
    metadata: imported.metadata,
    updatedAt: result.updatedAt,
  };
}
