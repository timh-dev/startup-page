import { useEffect } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useAuthStore } from "@/features/auth/stores";
import { useSettingsStore } from "@/features/settings/stores";
import { startBackgroundSync, subscribeToRemoteChanges, syncNow } from "@/lib/cloudSync";

// Same-origin by default; self-hosters can point at a remote API.
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

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

  // Once the session and subscription status resolve, keep settings synced:
  // now, after local edits (scheduled by writeSettings), and in the
  // background (focus, reconnect, interval). Runs here rather than at boot
  // because window.Clerk doesn't exist until ClerkProvider has mounted.
  const canSync = isLoaded && Boolean(user?.id) && subscriptionStatus !== "loading" && hasSyncAccess();
  useEffect(() => {
    if (!canSync) return undefined;
    const unsubscribe = subscribeToRemoteChanges(() => useSettingsStore.getState().reloadSettings());
    const stopBackgroundSync = startBackgroundSync();
    void syncNow();
    return () => {
      unsubscribe();
      stopBackgroundSync();
    };
  }, [canSync, user?.id]);

  return null;
}
