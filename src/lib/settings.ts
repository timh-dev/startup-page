import Cookies from "js-cookie";
import defaultSettings from "../config/settings.json";

const SETTINGS_COOKIE_KEY = "settings";
const SETTINGS_LOCAL_STORAGE_KEY = "startup-page.settings";
const SETTINGS_DB_NAME = "startup-page-db";
const SETTINGS_SCHEMA_VERSION = 2;
const SETTINGS_STORE_NAME = "settings";
const BACKUPS_STORE_NAME = "settings-backups";
const SETTINGS_RECORD_KEY = "workspace-settings";
const BACKUP_LIMIT = 10;
const SETTINGS_EXPORT_FORMAT = "startup-page-settings";
const SETTINGS_MAX_IMPORT_BYTES = 2 * 1024 * 1024;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeSettings(defaultValue, savedValue) {
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

function normalizeSettingsShape(settings) {
  const mergedSettings = mergeSettings(defaultSettings, settings);
  const decorativeVideo = mergedSettings.decorativeVideo || {};

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
    decorativeVideo: {
      ...decorativeVideo,
      urls,
      zoom: decorativeVideo.zoom ?? decorativeVideo.tall?.zoom ?? 1.6,
      offsetX: decorativeVideo.offsetX ?? decorativeVideo.tall?.offsetX ?? 0,
      offsetY: decorativeVideo.offsetY ?? decorativeVideo.tall?.offsetY ?? 0,
    },
  };
}

function normalizeStoredRecord(record) {
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
    return defaultSettings;
  }

  try {
    const parsed = JSON.parse(rawSettings);
    const normalizedRecord = normalizeStoredRecord(parsed);
    if (normalizedRecord) {
      return normalizedRecord.settings;
    }

    return normalizeSettingsShape(parsed);
  } catch (_error) {
    return defaultSettings;
  }
}

function getIndexedDb() {
  return new Promise((resolve, reject) => {
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

async function readSettingsFromIndexedDb() {
  const db = await getIndexedDb();
  if (!db) {
    return null;
  }

  return new Promise((resolve, reject) => {
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

  await new Promise((resolve, reject) => {
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

async function clearSettingsFromIndexedDb() {
  const db = await getIndexedDb();
  if (!db) {
    return;
  }

  await new Promise((resolve, reject) => {
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

  return defaultSettings;
}

export async function writeSettings(settings) {
  const mergedSettings = normalizeSettingsShape(settings);
  writeSettingsToLocalStorage(mergedSettings);
  Cookies.remove(SETTINGS_COOKIE_KEY);
  const record = await writeSettingsToIndexedDb(mergedSettings);
  return {
    settings: mergedSettings,
    updatedAt: record?.updatedAt || new Date().toISOString(),
  };
}

export async function resetSettings() {
  clearSettingsFromLocalStorage();
  Cookies.remove(SETTINGS_COOKIE_KEY);
  await clearSettingsFromIndexedDb();
  writeSettingsToLocalStorage(defaultSettings);
  const record = await writeSettingsToIndexedDb(defaultSettings);
  return {
    settings: defaultSettings,
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
