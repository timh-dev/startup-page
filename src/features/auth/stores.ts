import { create } from "zustand";

export type SubscriptionStatus = "loading" | "none" | "active" | "past_due" | "canceled";

/**
 * idle = no cloud activity yet this session; syncing = a push/pull is in
 * flight (or waiting on the push debounce); synced/error reflect the last
 * completed attempt; offline = the browser has no connection, distinct from a
 * genuine server/request error.
 */
export type SyncStatus = "idle" | "syncing" | "synced" | "error" | "offline";

interface AuthStore {
  clerkUserId: string | null;
  isSignedIn: boolean;
  isLoaded: boolean;
  subscriptionStatus: SubscriptionStatus;
  subscriptionPeriodEnd: string | null;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  isOnline: boolean;
  // Top-level settings keys (e.g. "widgets", "bookmark") that were edited
  // differently on two devices between syncs and had to be auto-resolved
  // rather than cleanly merged — see syncSettingsFromCloud. Cleared the next
  // time a sync completes with nothing left to resolve.
  lastMergeKeys: string[] | null;
  lastMergeAt: string | null;
  setAuthState: (state: { clerkUserId: string | null; isSignedIn: boolean; isLoaded: boolean }) => void;
  setSubscriptionStatus: (status: SubscriptionStatus, periodEnd?: string | null) => void;
  setSyncStatus: (status: SyncStatus, at?: string | null) => void;
  setOnline: (online: boolean) => void;
  hasSyncAccess: () => boolean;
  setMergeInfo: (keys: string[]) => void;
  clearMergeInfo: () => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  clerkUserId: null,
  isSignedIn: false,
  isLoaded: false,
  subscriptionStatus: "loading",
  subscriptionPeriodEnd: null,
  syncStatus: "idle",
  lastSyncedAt: null,
  lastMergeKeys: null,
  lastMergeAt: null,
  isOnline: typeof navigator === "undefined" ? true : navigator.onLine,

  setAuthState: (state) => set(state),

  setSubscriptionStatus: (status, periodEnd = null) =>
    set({ subscriptionStatus: status, subscriptionPeriodEnd: periodEnd }),

  setSyncStatus: (status, at = null) =>
    set((s) => ({ syncStatus: status, lastSyncedAt: at ?? s.lastSyncedAt })),

  setOnline: (online) => set({ isOnline: online }),

  hasSyncAccess: () => {
    const { isSignedIn, subscriptionStatus } = get();
    return isSignedIn && subscriptionStatus === "active";
  },

  setMergeInfo: (keys) => set({ lastMergeKeys: keys, lastMergeAt: new Date().toISOString() }),
  clearMergeInfo: () => set({ lastMergeKeys: null, lastMergeAt: null }),
}));
