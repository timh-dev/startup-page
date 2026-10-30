// Public settings API. Reads are synchronous (localStorage mirror) so the
// first render has settings; writes go to localStorage and IndexedDB, then
// schedule a cloud sync.
import { SETTINGS_LOCAL_STORAGE_KEY, type Settings } from "./constants";
import { normalizeSettingsShape, parseSettings, seedSettings } from "./normalize";
import {
  clearSettingsFromIndexedDb,
  clearSettingsFromLocalStorage,
  migrateCookieSettings,
  readBackupSettings,
  readSettingsFromIndexedDb,
  readSettingsFromLocalStorage,
  removeLegacyCookie,
  writeSettingsToIndexedDb,
  writeSettingsToLocalStorage,
} from "./storage";
import { normalizeImportPayload } from "./importExport";

export { DOMAIN_KEY_GROUPS, type Settings } from "./constants";
export { deepEqual, mergeSettings, normalizeSettingsShape } from "./normalize";
export { getStorageDiagnostics, listBackups, readSyncSnapshot, writeSyncSnapshot, type BackupSummary } from "./storage";
export {
  createDomainExportFilename,
  createSettingsExportFilename,
  exportDomainBlob,
  exportSettingsBlob,
  mergeImportedDomains,
  pickSettingsDomain,
  previewImportFile,
  previewImportPayload,
} from "./importExport";

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

/** Saves to this device only: localStorage mirror and IndexedDB (with a rolling backup). */
export async function saveSettingsLocally(settings: Settings) {
  const normalized = normalizeSettingsShape(settings);
  writeSettingsToLocalStorage(normalized);
  removeLegacyCookie();
  const record = await writeSettingsToIndexedDb(normalized);
  return { settings: normalized, updatedAt: record?.updatedAt || new Date().toISOString() };
}

/** Saves locally, then schedules a cloud sync. Use this for the user's own edits. */
export async function writeSettings(settings: Settings) {
  const result = await saveSettingsLocally(settings);
  // Dynamic import: cloudSync imports this module.
  void import("@/lib/cloudSync").then(({ scheduleSync }) => scheduleSync(result.settings));
  return result;
}

/** The latest saved settings, read from IndexedDB (shared by every tab) when available. */
export async function readLocalSettings(): Promise<Settings> {
  const record = await readSettingsFromIndexedDb();
  return record?.settings ?? readSettings();
}

/** Default settings for a brand-new install. */
export function getDefaultSettings(): Settings {
  return seedSettings;
}

/** Calls `onChange` when another tab of this app saves settings. Returns an unsubscribe. */
export function onSettingsChangedInOtherTab(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handleStorage = (event: StorageEvent) => {
    if (event.key === SETTINGS_LOCAL_STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}

export async function resetSettings() {
  clearSettingsFromLocalStorage();
  removeLegacyCookie();
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

/** Re-applies one of the rolling local backups, the same way an import does. */
export async function restoreBackup(id: string) {
  const settings = await readBackupSettings(id);
  if (!settings) {
    throw new Error("Backup not found — it may have been pruned.");
  }
  return writeSettings(settings);
}

export async function importSettingsFromFile(file: File) {
  const rawFile = await file.text();
  const imported = normalizeImportPayload(rawFile);
  const result = await writeSettings(imported.settings);

  return {
    settings: result.settings,
    metadata: imported.metadata,
    updatedAt: result.updatedAt,
  };
}
