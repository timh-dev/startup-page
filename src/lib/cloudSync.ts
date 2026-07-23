import { useAuthStore } from "@/features/auth/stores";

// Same-origin by default (Vercel serves /api next to the app).
// Self-hosters pointing at a remote API can set VITE_API_URL.
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const PUSH_DEBOUNCE_MS = 2000;

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPush: { settings: Record<string, unknown>; updatedAt: string } | null = null;
let pushInFlight = false;
// Kept fresh on every token fetch so the pagehide flush can send synchronously
// without awaiting Clerk (Clerk session tokens live ~60s, so it's valid).
let cachedToken: string | null = null;

function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

async function getToken(): Promise<string | null> {
  try {
    // Clerk JS SDK exposes the active session on window.Clerk after ClerkProvider loads.
    // Using window.Clerk avoids React hook restrictions in plain TS modules.
    const session = (window as unknown as { Clerk?: { session?: { getToken: () => Promise<string> } } }).Clerk?.session;
    if (!session) return null;
    cachedToken = await session.getToken();
    return cachedToken;
  } catch {
    return cachedToken;
  }
}

export async function pullSettingsFromCloud(): Promise<{
  settings: Record<string, unknown>;
  serverUpdatedAt: string;
  clientUpdatedAt: string | null;
} | null> {
  const token = await getToken();
  if (!token) return null;

  if (!isOnline()) {
    useAuthStore.getState().setSyncStatus("offline");
    return null;
  }

  useAuthStore.getState().setSyncStatus("syncing");

  try {
    const res = await fetch(`${API_URL}/api/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) {
      // Sync works; there's just nothing in the cloud yet.
      useAuthStore.getState().setSyncStatus("synced", new Date().toISOString());
      return null;
    }
    if (res.status === 402) return null;
    if (!res.ok) throw new Error(`Pull failed: ${res.status}`);
    const data = await res.json();
    useAuthStore.getState().setSyncStatus("synced", new Date().toISOString());
    return {
      settings: data.settings,
      serverUpdatedAt: data.server_updated_at,
      clientUpdatedAt: data.client_updated_at ?? null,
    };
  } catch {
    // Network dropped mid-request vs. a genuine server/request failure read
    // differently to the user, so tell them apart.
    useAuthStore.getState().setSyncStatus(isOnline() ? "error" : "offline");
    return null;
  }
}

function buildPushBody(push: { settings: Record<string, unknown>; updatedAt: string }): string {
  return JSON.stringify({
    settings: push.settings,
    schema_version: 2,
    client_updated_at: push.updatedAt,
  });
}

async function executePush(push: { settings: Record<string, unknown>; updatedAt: string }): Promise<void> {
  if (!isOnline()) {
    // Keep it pending rather than dropping it — the 'online' listener below
    // retries automatically once the connection comes back.
    pendingPush = push;
    useAuthStore.getState().setSyncStatus("offline");
    return;
  }

  const token = await getToken();
  if (!token) return;

  pushInFlight = true;
  try {
    const res = await fetch(`${API_URL}/api/settings`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: buildPushBody(push),
    });
    if (res.ok) {
      useAuthStore.getState().setSyncStatus("synced", new Date().toISOString());
    } else {
      useAuthStore.getState().setSyncStatus("error");
    }
  } catch {
    // Fire-and-forget: local write already succeeded. Network dropped mid-flight
    // vs. a genuine failure read differently to the user, so tell them apart.
    if (!isOnline()) {
      pendingPush = push;
      useAuthStore.getState().setSyncStatus("offline");
    } else {
      useAuthStore.getState().setSyncStatus("error");
    }
  } finally {
    pushInFlight = false;
  }
}

export function schedulePushToCloud(settings: Record<string, unknown>, updatedAt: string): void {
  if (!useAuthStore.getState().hasSyncAccess()) return;
  pendingPush = { settings, updatedAt };
  // Immediate feedback that a change is waiting to be saved, even though the
  // actual request doesn't fire until the debounce below elapses.
  useAuthStore.getState().setSyncStatus("syncing");
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    if (pendingPush) {
      const toSend = pendingPush;
      pendingPush = null;
      void executePush(toSend);
    }
  }, PUSH_DEBOUNCE_MS);
}

/** Bypasses the debounce to push (or re-check) right now — used by the manual "Sync now" action. */
export function forcePushNow(): void {
  if (!useAuthStore.getState().hasSyncAccess() || pushInFlight) return;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  if (pendingPush) {
    const toSend = pendingPush;
    pendingPush = null;
    void executePush(toSend);
  }
}

/**
 * Flush a debounced push when the page is hidden or closed so edits made in
 * the last 2s aren't lost. keepalive lets the request outlive the page;
 * sendBeacon can't carry the Authorization header, so it's not usable here.
 */
function flushPendingPush(): void {
  if (!pendingPush || !cachedToken) return;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  const body = buildPushBody(pendingPush);
  pendingPush = null;
  void fetch(`${API_URL}/api/settings`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${cachedToken}`, "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushPendingPush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushPendingPush();
  });

  window.addEventListener("online", () => {
    useAuthStore.getState().setOnline(true);
    // Whatever didn't make it out while offline (a debounced edit, or a push
    // that failed mid-flight) gets one more attempt now that we're back.
    if (pendingPush) forcePushNow();
  });
  window.addEventListener("offline", () => {
    useAuthStore.getState().setOnline(false);
  });
}
