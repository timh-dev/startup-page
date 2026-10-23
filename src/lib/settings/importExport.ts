// Settings backup files: export (whole or one domain), and parsing/previewing
// an import before it's applied.
import {
  DOMAIN_KEY_GROUPS,
  SETTINGS_EXPORT_FORMAT,
  SETTINGS_MAX_IMPORT_BYTES,
  SETTINGS_SCHEMA_VERSION,
  type Settings,
} from "./constants";
import { isPlainObject, normalizeSettingsShape } from "./normalize";

function createSettingsEnvelope(settings: Settings, overrides: Record<string, unknown> = {}) {
  return {
    format: SETTINGS_EXPORT_FORMAT,
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    settings: normalizeSettingsShape(settings),
    ...overrides,
  };
}

function parseImportPayload(rawText: string) {
  if (typeof rawText !== "string" || rawText.trim() === "") {
    throw new Error("Backup file is empty.");
  }

  if (rawText.length > SETTINGS_MAX_IMPORT_BYTES) {
    throw new Error("Backup file is too large.");
  }

  let parsed: unknown;
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
  return { parsed, candidateSettings };
}

export function normalizeImportPayload(rawText: string) {
  const { parsed, candidateSettings } = parseImportPayload(rawText);

  return {
    settings: normalizeSettingsShape(candidateSettings),
    metadata: {
      format: parsed.format || SETTINGS_EXPORT_FORMAT,
      schemaVersion: Number(parsed.schemaVersion) || 1,
      exportedAt: parsed.exportedAt || null,
    },
  };
}

/**
 * Like normalizeImportPayload, but also reports which domain groups
 * (DOMAIN_KEY_GROUPS) the file actually contains — checked against the raw
 * parsed object, before normalizeSettingsShape fills in defaults for
 * whatever's missing, since that would otherwise make every domain look
 * "present". Lets the import UI show a checklist instead of always
 * replacing everything.
 */
export function previewImportPayload(rawText: string) {
  const { parsed, candidateSettings } = parseImportPayload(rawText);

  const presentDomains = Object.entries(DOMAIN_KEY_GROUPS)
    .filter(([, group]) => group.keys.some((key) => Object.prototype.hasOwnProperty.call(candidateSettings, key)))
    .map(([domainId]) => domainId);

  return {
    settings: normalizeSettingsShape(candidateSettings),
    presentDomains,
    metadata: {
      format: parsed.format || SETTINGS_EXPORT_FORMAT,
      schemaVersion: Number(parsed.schemaVersion) || 1,
      exportedAt: parsed.exportedAt || null,
    },
  };
}

/** Picks only the given top-level settings keys — no default-filling, unlike normalizeSettingsShape. */
export function pickSettingsDomain(settings: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const key of keys) {
    if (settings && Object.prototype.hasOwnProperty.call(settings, key)) {
      picked[key] = settings[key];
    }
  }
  return picked;
}

/** Merges only the selected domains from an imported/backup settings object into the current one. */
export function mergeImportedDomains(
  currentSettings: Record<string, unknown>,
  importedSettings: Record<string, unknown>,
  domainIds: string[],
): Record<string, unknown> {
  const keys = domainIds.flatMap((id) => DOMAIN_KEY_GROUPS[id]?.keys ?? []);
  return { ...currentSettings, ...pickSettingsDomain(importedSettings, keys) };
}

export function exportSettingsBlob(settings: Settings) {
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

/**
 * Exports just one domain group's keys (DOMAIN_KEY_GROUPS), unlike
 * exportSettingsBlob which merges against every default and always produces
 * a full settings shape. Bypasses createSettingsEnvelope for that reason —
 * a domain export should only ever claim the keys it actually has.
 */
export function exportDomainBlob(settings: Record<string, unknown>, domainId: string): Blob {
  const group = DOMAIN_KEY_GROUPS[domainId];
  if (!group) {
    throw new Error(`Unknown settings domain: ${domainId}`);
  }

  const envelope = {
    format: SETTINGS_EXPORT_FORMAT,
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    domain: domainId,
    settings: pickSettingsDomain(normalizeSettingsShape(settings), group.keys),
    app: { name: "startup-page" },
  };

  return new Blob([JSON.stringify(envelope, null, 2)], {
    type: "application/json",
  });
}

export function createDomainExportFilename(domainId: string) {
  const isoDate = new Date().toISOString().replace(/[:.]/g, "-");
  return `startup-page-${domainId}-${isoDate}.json`;
}

/** Parses and previews a file without applying it — see previewImportPayload. */
export async function previewImportFile(file: File) {
  const rawFile = await file.text();
  return previewImportPayload(rawFile);
}
