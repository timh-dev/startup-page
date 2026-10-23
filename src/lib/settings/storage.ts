// Where settings live on this device: IndexedDB (the record, rolling backups
// and the last-synced snapshot), a localStorage mirror for synchronous reads
// at startup, and the legacy cookie that's migrated away on first read.
import {
  BACKUP_LIMIT,
  BACKUPS_STORE_NAME,
  SETTINGS_COOKIE_KEY,
  SETTINGS_DB_NAME,
  SETTINGS_LOCAL_STORAGE_KEY,
  SETTINGS_RECORD_KEY,
  SETTINGS_SCHEMA_VERSION,
  SETTINGS_STORE_NAME,
  SYNCED_SNAPSHOT_RECORD_KEY,
  type Settings,
} from "./constants";
import { normalizeSettingsShape, normalizeStoredRecord, parseSettings, type StoredSettingsRecord } from "./normalize";

export function getIndexedDb(): Promise<IDBDatabase | null> {
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

export async function readSettingsFromIndexedDb(): Promise<StoredSettingsRecord | null> {
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

export async function countBackupsInIndexedDb(): Promise<number> {
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

export async function writeSettingsToIndexedDb(settings: Settings): Promise<StoredSettingsRecord | null> {
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

export interface BackupSummary {
  id: string;
  createdAt: string;
  size: number;
}

/** The rolling local backups `writeSettingsToIndexedDb` already collects on every save, newest first. */
export async function listBackups(): Promise<BackupSummary[]> {
  const db = await getIndexedDb();
  if (!db || !db.objectStoreNames.contains(BACKUPS_STORE_NAME)) {
    return [];
  }

  return new Promise<BackupSummary[]>((resolve, reject) => {
    const transaction = db.transaction(BACKUPS_STORE_NAME, "readonly");
    const request = transaction.objectStore(BACKUPS_STORE_NAME).getAll();

    request.onsuccess = () => {
      const backups = (request.result || [])
        // Ids are `${Date.now()}-${random}`, so lexicographic sort is also
        // chronological — same trick writeSettingsToIndexedDb's pruning uses.
        .sort((a, b) => (a.id < b.id ? 1 : -1))
        .map((backup) => ({
          id: backup.id as string,
          createdAt: backup.createdAt as string,
          size: JSON.stringify(backup.settings).length,
        }));
      resolve(backups);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function readBackupSettings(id: string) {
  const db = await getIndexedDb();
  if (!db) return null;

  return new Promise<Record<string, unknown> | null>((resolve, reject) => {
    const transaction = db.transaction(BACKUPS_STORE_NAME, "readonly");
    const request = transaction.objectStore(BACKUPS_STORE_NAME).get(id);

    request.onsuccess = () => resolve(request.result?.settings ?? null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * The sync engine's record of what this device last agreed with the server
 * (see src/lib/cloudSync.ts). Stored as-is; the engine owns its shape and
 * migrates older formats.
 */
export async function readSyncSnapshot(): Promise<unknown> {
  const db = await getIndexedDb();
  if (!db) {
    return null;
  }

  return new Promise<unknown>((resolve, reject) => {
    const transaction = db.transaction(SETTINGS_STORE_NAME, "readonly");
    const request = transaction.objectStore(SETTINGS_STORE_NAME).get(SYNCED_SNAPSHOT_RECORD_KEY);

    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function writeSyncSnapshot(snapshot: unknown) {
  const db = await getIndexedDb();
  if (!db) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(SETTINGS_STORE_NAME, "readwrite");
    transaction.objectStore(SETTINGS_STORE_NAME).put(snapshot, SYNCED_SNAPSHOT_RECORD_KEY);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function clearSettingsFromIndexedDb() {
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

export function readSettingsFromLocalStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  return window.localStorage.getItem(SETTINGS_LOCAL_STORAGE_KEY);
}

export function writeSettingsToLocalStorage(settings: Settings) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(SETTINGS_LOCAL_STORAGE_KEY, JSON.stringify(settings));
}

export function clearSettingsFromLocalStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.removeItem(SETTINGS_LOCAL_STORAGE_KEY);
}

// Settings were stored in a cookie before IndexedDB; read once and migrated.
function readLegacyCookie(): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${SETTINGS_COOKIE_KEY}=`;
  const entry = document.cookie.split("; ").find((cookie) => cookie.startsWith(prefix));
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : null;
}

export function removeLegacyCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${SETTINGS_COOKIE_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

export function migrateCookieSettings() {
  const cookieSettings = readLegacyCookie();
  if (!cookieSettings) {
    return null;
  }

  removeLegacyCookie();
  return parseSettings(cookieSettings);
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
