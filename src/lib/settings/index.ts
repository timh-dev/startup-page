// Public settings API. Reads are synchronous (localStorage mirror) so the
// first render has settings; writes go to localStorage and IndexedDB, then
// schedule a cloud push.
import type { Settings } from "./constants";
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
export { getStorageDiagnostics, listBackups, markSyncedSnapshot, type BackupSummary } from "./storage";
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
export { mergeSettingsSnapshots, syncSettingsFromCloud } from "./sync";

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

export async function writeSettings(settings: Settings) {
  const mergedSettings = normalizeSettingsShape(settings);
  writeSettingsToLocalStorage(mergedSettings);
  removeLegacyCookie();
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
