// Cloud sync engine.
//
// Settings are synced per domain (shared/settingsDomains.ts). For each
// domain this device keeps a snapshot: the data and server version it last
// agreed on with the server. A sync:
//
//   1. pulls every domain's current data and version;
//   2. for each domain the server changed since the snapshot, three-way
//      merges (src/lib/sync/merge.ts) snapshot ← local → remote, so edits
//      from both sides survive down to individual list entries and fields;
//   3. pushes domains whose result differs from the server copy, each with
//      the version it was based on. The server writes a domain only if that
//      version is still current; otherwise it returns its newer copy, which
//      is merged and pushed again.
//   4. saves the result locally, folding in any edit made while it ran.
//
// Ordering comes from server versions, never from device clocks. Syncs run
// after local edits (debounced), on sign-in, when the tab regains focus or
// comes back online, and every few minutes while visible.
import { useAuthStore } from "@/features/auth/stores";
import { getAuthToken, getCachedAuthToken } from "@/lib/authToken";
import { deepEqual, merge3, type MergePath } from "@/lib/sync/merge";
import {
  DOMAIN_SETTINGS_KEYS,
  SETTINGS_DOMAINS,
  SETTINGS_DOMAIN_IDS,
  assembleSettings,
  sliceSettings,
  type SettingsDomainId,
} from "../../shared/settingsDomains";

// Same-origin by default (Vercel serves /api next to the app).
// Self-hosters pointing at a remote API can set VITE_API_URL.
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const SYNC_DEBOUNCE_MS = 2000;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const MIN_REFRESH_GAP_MS = 30 * 1000;
const MAX_PUSH_ATTEMPTS = 4;
const SNAPSHOT_FORMAT = "domains-v1";

interface DomainState {
  data: unknown;
  /** Server version this data corresponds to; 0 = no stored copy. */
  version: number;
}

type DomainStates = Record<SettingsDomainId, DomainState>;

class SyncHttpError extends Error {
  constructor(public status: number) {
    super(`Sync request failed: ${status}`);
  }
}

// The settings module imports this one, so load it lazily.
const settingsModule = () => import("@/lib/settings");

function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

// ---------------------------------------------------------------------------
// Snapshot

let snapshotCache: DomainStates | null = null;

async function loadSnapshot(): Promise<DomainStates> {
  const settings = await settingsModule();
  const raw = (await settings.readSyncSnapshot()) as Record<string, any> | null;
  const defaults = sliceSettings(settings.getDefaultSettings());
  const snapshot = {} as DomainStates;

  if (raw?.format === SNAPSHOT_FORMAT && raw.domains && typeof raw.domains === "object") {
    for (const id of SETTINGS_DOMAIN_IDS) {
      const stored = raw.domains[id];
      snapshot[id] = stored && typeof stored.version === "number" ? stored : { data: defaults[id], version: 0 };
    }
  } else {
    // No snapshot (a device that has never synced) merges against the app
    // defaults, so settings it never touched take the cloud's values. A
    // snapshot from before versioned sync still records what this device
    // last agreed with the cloud, so it stays the merge base; version 0
    // makes the first push conflict and merge rather than overwrite.
    const legacySettings = raw && typeof raw.settings === "object" ? settings.normalizeSettingsShape(raw.settings) : null;
    const base = legacySettings ? sliceSettings(legacySettings) : defaults;
    for (const id of SETTINGS_DOMAIN_IDS) snapshot[id] = { data: base[id], version: 0 };
  }

  snapshotCache = snapshot;
  return snapshot;
}

async function saveSnapshot(snapshot: DomainStates) {
  snapshotCache = snapshot;
  const settings = await settingsModule();
  await settings.writeSyncSnapshot({ format: SNAPSHOT_FORMAT, domains: snapshot });
}

// ---------------------------------------------------------------------------
// Server

async function fetchRemote(token: string): Promise<DomainStates> {
  const res = await fetch(`${API_URL}/api/settings`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new SyncHttpError(res.status);
  const body = await res.json();
  const remote = {} as DomainStates;
  for (const id of SETTINGS_DOMAIN_IDS) {
    const stored = body?.domains?.[id];
    remote[id] = stored && typeof stored.version === "number" ? stored : { data: undefined, version: 0 };
  }
  return remote;
}

type PushRequest = Partial<Record<SettingsDomainId, { data: unknown; base_version: number }>>;
type PushResult = Partial<
  Record<SettingsDomainId, { status: "ok"; version: number } | { status: "conflict"; data: unknown; version: number }>
>;

async function pushDomains(token: string, domains: PushRequest): Promise<PushResult> {
  const res = await fetch(`${API_URL}/api/settings`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ domains }),
  });
  if (!res.ok) throw new SyncHttpError(res.status);
  return (await res.json()).domains ?? {};
}

// ---------------------------------------------------------------------------
// Sync

type RemoteChangeListener = (settings: Record<string, unknown>) => void;
const remoteChangeListeners = new Set<RemoteChangeListener>();

/** Called with the new settings whenever a sync changes them locally. */
export function subscribeToRemoteChanges(listener: RemoteChangeListener): () => void {
  remoteChangeListeners.add(listener);
  return () => remoteChangeListeners.delete(listener);
}

/** Top-level settings keys a conflict path touches, for the "changed on another device" notice. */
function conflictKey(id: SettingsDomainId, path: MergePath): string {
  const keys: readonly string[] = SETTINGS_DOMAINS[id].keys;
  return keys.length === 1 ? keys[0] : String(path[0] ?? id);
}

let inFlight: Promise<void> | null = null;
let rerunRequested = false;
let lastSyncAt = 0;

async function runSync(): Promise<void> {
  const auth = useAuthStore.getState();
  if (!auth.hasSyncAccess()) return;
  if (!isOnline()) {
    auth.setSyncStatus("offline");
    return;
  }
  const token = await getAuthToken();
  if (!token) return;

  auth.setSyncStatus("syncing");
  lastSyncAt = Date.now();

  try {
    const settings = await settingsModule();
    const remote = await fetchRemote(token);
    const snapshot = await loadSnapshot();
    const startSettings = await settings.readLocalSettings();
    const startSlices = sliceSettings(startSettings);
    const merged = { ...startSlices };
    const conflictKeys = new Set<string>();
    let unresolved = false;

    for (let attempt = 0; attempt < MAX_PUSH_ATTEMPTS; attempt++) {
      const toPush: PushRequest = {};
      for (const id of SETTINGS_DOMAIN_IDS) {
        const base = snapshot[id];
        const theirs = remote[id];
        if (theirs.version !== base.version) {
          // No stored copy means nothing to merge in: local stands.
          const remoteData = theirs.version === 0 ? base.data : theirs.data;
          const result = merge3(base.data, merged[id], remoteData);
          merged[id] = result.value;
          for (const path of result.conflicts) conflictKeys.add(conflictKey(id, path));
          snapshot[id] = { data: theirs.data, version: theirs.version };
        }
        if (merged[id] !== undefined && !deepEqual(merged[id], snapshot[id].data)) {
          toPush[id] = { data: merged[id], base_version: snapshot[id].version };
        }
      }

      if (!Object.keys(toPush).length) {
        unresolved = false;
        break;
      }

      const results = await pushDomains(token, toPush);
      unresolved = false;
      for (const id of Object.keys(toPush) as SettingsDomainId[]) {
        const result = results[id];
        if (result?.status === "ok") {
          snapshot[id] = { data: toPush[id]!.data, version: result.version };
          remote[id] = snapshot[id];
        } else if (result?.status === "conflict") {
          // Someone else wrote first: merge their copy and try again.
          remote[id] = { data: result.data, version: result.version };
          unresolved = true;
        }
      }
      if (!unresolved) break;
    }

    await saveSnapshot(snapshot);
    await applyLocally(startSlices, merged);

    if (unresolved) {
      auth.setSyncStatus("error");
      return;
    }
    auth.setSyncStatus("synced", new Date().toISOString());
    if (conflictKeys.size) auth.setMergeInfo([...conflictKeys]);
    else auth.clearMergeInfo();
  } catch {
    // A dropped connection reads differently from a real failure. Either
    // way local data is untouched, so the next sync just tries again.
    auth.setSyncStatus(isOnline() ? "error" : "offline");
  }
}

/**
 * Saves the merged result locally. If the user edited settings while the
 * sync was in flight, their edit is merged on top (the settings read at the
 * start are the base) and another sync is queued to push it.
 */
async function applyLocally(startSlices: Record<SettingsDomainId, unknown>, merged: Record<SettingsDomainId, unknown>) {
  const settings = await settingsModule();
  const current = await settings.readLocalSettings();
  const currentSlices = sliceSettings(current);
  const final = {} as Record<SettingsDomainId, unknown>;
  let editedMeanwhile = false;

  for (const id of SETTINGS_DOMAIN_IDS) {
    if (deepEqual(currentSlices[id], startSlices[id])) {
      final[id] = merged[id];
    } else {
      final[id] = merge3(startSlices[id], currentSlices[id], merged[id]).value;
      editedMeanwhile = true;
    }
  }

  if (!SETTINGS_DOMAIN_IDS.some((id) => !deepEqual(final[id], currentSlices[id]))) return;

  const next: Record<string, unknown> = { ...current };
  for (const key of DOMAIN_SETTINGS_KEYS) delete next[key];
  Object.assign(next, assembleSettings(final));
  const saved = await settings.saveSettingsLocally(next);
  for (const listener of remoteChangeListeners) listener(saved.settings);
  if (editedMeanwhile) rerunRequested = true;
}

/** Syncs now. Concurrent calls share one run, plus one follow-up if requested meanwhile. */
export function syncNow(): Promise<void> {
  if (inFlight) {
    rerunRequested = true;
    return inFlight;
  }
  inFlight = (async () => {
    try {
      do {
        rerunRequested = false;
        await runSync();
      } while (rerunRequested);
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

// ---------------------------------------------------------------------------
// Scheduling

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let pendingLocal: Record<string, unknown> | null = null;

/** Called after a local edit: syncs once edits pause for a moment. */
export function scheduleSync(settings?: Record<string, unknown>): void {
  if (!useAuthStore.getState().hasSyncAccess()) return;
  if (settings) pendingLocal = settings;
  // Immediate feedback that a change is waiting to be saved.
  useAuthStore.getState().setSyncStatus("syncing");
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    pendingLocal = null;
    void syncNow();
  }, SYNC_DEBOUNCE_MS);
}

/** Skips the debounce: used by "Sync now". */
export function forceSyncNow(): Promise<void> {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
    pendingLocal = null;
  }
  return syncNow();
}

/**
 * When the page is hidden or closed with an edit still waiting on the
 * debounce, push it with keepalive so it outlives the page. There's no
 * chance to read the reply: if it conflicts, the edit is still saved
 * locally and the next sync merges it.
 */
function flushPendingEdit(): void {
  const token = getCachedAuthToken();
  if (!syncTimer || !pendingLocal || !snapshotCache || !token) return;
  clearTimeout(syncTimer);
  syncTimer = null;

  const slices = sliceSettings(pendingLocal);
  pendingLocal = null;
  const domains: PushRequest = {};
  for (const id of SETTINGS_DOMAIN_IDS) {
    if (slices[id] !== undefined && !deepEqual(slices[id], snapshotCache[id].data)) {
      domains[id] = { data: slices[id], base_version: snapshotCache[id].version };
    }
  }
  if (!Object.keys(domains).length) return;

  void fetch(`${API_URL}/api/settings`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ domains }),
    keepalive: true,
  }).catch(() => {});
}

/** Starts syncing on focus, reconnect and an interval. Returns a stop function. */
export function startBackgroundSync(): () => void {
  const refresh = () => {
    if (document.visibilityState === "visible" && Date.now() - lastSyncAt > MIN_REFRESH_GAP_MS) void syncNow();
  };
  const handleOnline = () => void syncNow();
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("online", handleOnline);
  const interval = setInterval(refresh, REFRESH_INTERVAL_MS);

  return () => {
    window.removeEventListener("focus", refresh);
    document.removeEventListener("visibilitychange", refresh);
    window.removeEventListener("online", handleOnline);
    clearInterval(interval);
  };
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushPendingEdit);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushPendingEdit();
  });
  window.addEventListener("online", () => useAuthStore.getState().setOnline(true));
  window.addEventListener("offline", () => useAuthStore.getState().setOnline(false));
}
