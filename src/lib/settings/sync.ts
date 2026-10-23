// Reconciling this device's settings with the cloud copy.
import { deepEqual, normalizeSettingsShape, seedSettings } from "./normalize";
import {
  readSettingsFromIndexedDb,
  readSyncedSnapshotFromIndexedDb,
  writeSettingsToIndexedDb,
  writeSettingsToLocalStorage,
  writeSyncedSnapshotToIndexedDb,
} from "./storage";

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
 * Pull cloud settings and reconcile with the local copy via a three-way
 * merge against the last snapshot both sides agreed on (see
 * markSyncedSnapshot), per top-level settings key (`widgets`, `bookmark`,
 * `vaultItems`, `ui`, ...). If this device has never synced before (no
 * `syncedSnapshot`) or has no local record at all, the base/local default to
 * the app's normalized defaults (`seedSettings`) rather than `{}` — an
 * untouched key then reads as unchanged (matches its own default) instead of
 * "changed relative to nothing," so a key a device never customized can't
 * register as a same-key conflict just because its local write happens to
 * carry a fresher timestamp than the real cloud data (every fresh device's
 * first local write is timestamped "now," which used to be enough to win a
 * newer-wins tiebreak against older, real, synced-from-elsewhere cloud data
 * and get pushed back up over it). A key changed on only one side just takes
 * that side's value; a key changed *differently* on both sides (i.e. the
 * device genuinely customized it, e.g. while used signed-out before this
 * sign-in) is a real conflict, resolved by newer-wins and surfaced via
 * useAuthStore's setMergeInfo so it's not silent.
 * Pull failed for any reason (no token yet, offline, server error, no
 * subscription, ...): do nothing. Treating a failed pull as "cloud is empty"
 * is what let an empty local copy silently overwrite real synced data, so a
 * failure must never trigger a push.
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
    const localSettings = localRecord?.settings ?? seedSettings;
    const baseSettings = syncedSnapshot?.settings ?? seedSettings;

    const { merged, conflictKeys, localHasUniqueChanges } = mergeSettingsSnapshots(
      baseSettings,
      localSettings,
      cloudSettings,
      cloudUpdatedAt,
      localUpdatedAt,
    );

    const normalizedMerged = normalizeSettingsShape(merged);
    const mergedDiffersFromLocal = !deepEqual(normalizedMerged, localSettings);

    let updatedAt = localRecord?.updatedAt || new Date().toISOString();
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
