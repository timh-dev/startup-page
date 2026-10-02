import { useEffect } from "react";
import { useAuth, useUser } from "@clerk/react";
import { useAuthStore } from "@/features/auth/stores";
import { useSettingsStore } from "@/features/settings/stores";
import { syncSettingsFromCloud } from "@/lib/settings";

// Same-origin by default; self-hosters can point at a remote API.
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

// Module-level guard: sync once per user per page load, even across
// StrictMode double-mounts and subscription-status refreshes.
let lastSyncedUserId: string | null = null;

export default function AuthBridge() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const setAuthState = useAuthStore((s) => s.setAuthState);
  const setSubscriptionStatus = useAuthStore((s) => s.setSubscriptionStatus);
  const hasSyncAccess = useAuthStore((s) => s.hasSyncAccess);
  const subscriptionStatus = useAuthStore((s) => s.subscriptionStatus);

  useEffect(() => {
    setAuthState({
      clerkUserId: user?.id ?? null,
      isSignedIn: isSignedIn ?? false,
      isLoaded,
    });
  }, [isLoaded, isSignedIn, user?.id, setAuthState]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setSubscriptionStatus("none");
      return;
    }
    void (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${API_URL}/api/subscription/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          setSubscriptionStatus("none");
          return;
        }
        const data = await res.json();
        setSubscriptionStatus(data.status, data.period_end ?? null);
      } catch {
        setSubscriptionStatus("none");
      }
    })();
  }, [isLoaded, isSignedIn, getToken, setSubscriptionStatus]);

  // Once the session and subscription status resolve, reconcile local settings
  // with the cloud copy. This runs here (not at app boot) because window.Clerk
  // doesn't exist until ClerkProvider has mounted.
  useEffect(() => {
    if (!isLoaded || !user?.id) return;
    if (subscriptionStatus === "loading" || !hasSyncAccess()) return;
    if (lastSyncedUserId === user.id) return;
    lastSyncedUserId = user.id;

    void (async () => {
      const applied = await syncSettingsFromCloud();
      if (applied) {
        useSettingsStore.getState().reloadSettings();
      }
    })();
  }, [isLoaded, user?.id, subscriptionStatus, hasSyncAccess]);

  return null;
}
