import { useState, type ReactNode } from "react";
import { useAuth, useClerk, useUser } from "@clerk/clerk-react";
import {
  HiOutlineUser,
  HiOutlineCloud,
  HiOutlineComputerDesktop,
  HiOutlineArrowPath,
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
  HiOutlineSignalSlash,
} from "react-icons/hi2";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/features/auth/stores";
import { useSettingsStore } from "@/features/settings/stores";
import { syncSettingsFromCloud } from "@/lib/settings";
import UpgradeModal from "@/features/auth/UpgradeModal";

const PLAN_LABEL: Record<string, string> = {
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
  none: "Free",
  loading: "—",
};

const PLAN_COLOR: Record<string, string> = {
  active: "bg-emerald-400/15 text-emerald-500",
  past_due: "bg-red-400/15 text-red-500",
  canceled: "bg-zinc-400/15 text-muted-foreground",
  none: "bg-zinc-400/15 text-muted-foreground",
  loading: "bg-zinc-400/15 text-muted-foreground",
};

function formatRelativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const diffSec = Math.round((Date.now() - date.getTime()) / 1000);
  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getInitials(name: string | null | undefined, email: string): string {
  const trimmed = (name ?? "").trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return trimmed.slice(0, 2).toUpperCase();
  }
  return email ? email.slice(0, 2).toUpperCase() : "?";
}

interface Presence {
  dotColor: string;
  textColor: string;
  pulse: boolean;
  icon: ReactNode;
  label: string;
  description: string;
}

function getPresence({
  hasAccess,
  isOnline,
  syncStatus,
  lastSyncedLabel,
}: {
  hasAccess: boolean;
  isOnline: boolean;
  syncStatus: string;
  lastSyncedLabel: string | null;
}): Presence {
  if (!hasAccess) {
    return {
      dotColor: "bg-zinc-400",
      textColor: "text-zinc-400",
      pulse: false,
      icon: <HiOutlineComputerDesktop className="text-base" />,
      label: "Local only",
      description: "You're signed in, but settings are stored in this browser only.",
    };
  }
  if (!isOnline) {
    return {
      dotColor: "bg-zinc-400",
      textColor: "text-zinc-400",
      pulse: false,
      icon: <HiOutlineSignalSlash className="text-base" />,
      label: "Offline",
      description: "You're offline. Changes are saved locally and will sync as soon as you reconnect.",
    };
  }
  if (syncStatus === "syncing") {
    return {
      dotColor: "bg-amber-400",
      textColor: "text-amber-500",
      pulse: true,
      icon: <HiOutlineArrowPath className="animate-spin text-base" />,
      label: "Syncing…",
      description: "Saving your changes to the cloud.",
    };
  }
  if (syncStatus === "error") {
    return {
      dotColor: "bg-red-500",
      textColor: "text-red-500",
      pulse: false,
      icon: <HiOutlineExclamationTriangle className="text-base" />,
      label: "Sync failed",
      description: "Your changes are safe locally. We'll automatically retry.",
    };
  }
  return {
    dotColor: "bg-emerald-400",
    textColor: "text-emerald-500",
    pulse: false,
    icon: <HiOutlineCheckCircle className="text-base" />,
    label: "Synced",
    description: lastSyncedLabel
      ? `All changes saved to your account. Last synced ${lastSyncedLabel}.`
      : "All changes saved to your account.",
  };
}

/** Small colored dot overlaid on the account button showing sync state. */
function StatusDot({ color, pulse, title }: { color: string; pulse: boolean; title: string }) {
  return (
    <span
      title={title}
      className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-background ${color} ${pulse ? "animate-pulse" : ""}`}
    />
  );
}

function Avatar({ imageUrl, initials, size }: { imageUrl?: string | null; initials: string; size: string }) {
  if (imageUrl) {
    return <img src={imageUrl} alt="Account" className={`${size} rounded-full object-cover`} />;
  }
  return (
    <span
      className={`${size} flex items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary`}
    >
      {initials}
    </span>
  );
}

export default function AccountButton() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { openSignIn, signOut } = useClerk();
  const subscriptionStatus = useAuthStore((s) => s.subscriptionStatus);
  const syncStatus = useAuthStore((s) => s.syncStatus);
  const lastSyncedAt = useAuthStore((s) => s.lastSyncedAt);
  const isOnline = useAuthStore((s) => s.isOnline);
  const hasSyncAccess = useAuthStore((s) => s.hasSyncAccess);
  const [accountOpen, setAccountOpen] = useState(false);
  const [localInfoOpen, setLocalInfoOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [manualSyncing, setManualSyncing] = useState(false);

  if (!isLoaded) return null;

  // ── Signed out: explain local mode, offer sign-in ──────────────────────────
  if (!isSignedIn) {
    return (
      <Dialog open={localInfoOpen} onOpenChange={setLocalInfoOpen}>
        <button
          type="button"
          className="relative cursor-pointer text-2xl"
          onClick={() => setLocalInfoOpen(true)}
          title="Local mode — settings stored in this browser. Click for details."
        >
          <HiOutlineUser />
          <StatusDot color="bg-zinc-400" pulse={false} title="Local mode" />
        </button>
        <DialogContent className="w-[min(92vw,420px)] border-border/60 bg-background/98 p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-8">
              <HiOutlineComputerDesktop className="text-xl" />
              You&apos;re in local mode
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-foreground/80">
              Your settings, bookmarks, and themes are stored <strong>in this browser only</strong>{" "}
              (IndexedDB with a localStorage mirror). They won&apos;t follow you to other devices,
              and clearing browser data will remove them — you can export a backup from Settings.
            </p>
            <Button className="w-full" onClick={() => openSignIn()}>
              Sign in to enable cloud sync
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Signed in ───────────────────────────────────────────────────────────────
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? "";
  const hasAccess = hasSyncAccess();
  const lastSyncedLabel = formatRelativeTime(lastSyncedAt);
  const presence = getPresence({ hasAccess, isOnline, syncStatus, lastSyncedLabel });
  const initials = getInitials(user?.fullName, email);
  const canSyncNow = hasAccess && isOnline && !manualSyncing;

  const handleSyncNow = async () => {
    if (!canSyncNow) return;
    setManualSyncing(true);
    try {
      const applied = await syncSettingsFromCloud();
      if (applied) useSettingsStore.getState().reloadSettings();
    } finally {
      setManualSyncing(false);
    }
  };

  return (
    <>
      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <button
          type="button"
          className="relative cursor-pointer"
          onClick={() => setAccountOpen(true)}
          title={`Signed in as ${email} — ${presence.label}`}
        >
          <Avatar imageUrl={user?.imageUrl} initials={initials} size="h-7 w-7" />
          <StatusDot color={presence.dotColor} pulse={presence.pulse} title={presence.label} />
        </button>
        <DialogContent className="w-[min(92vw,420px)] border-border/60 bg-background/98 p-6">
          <DialogHeader>
            <DialogTitle className="pr-8">Your Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar imageUrl={user?.imageUrl} initials={initials} size="h-10 w-10 text-sm" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{user?.fullName || email}</p>
                  <p className="truncate text-xs text-muted-foreground">{email}</p>
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${PLAN_COLOR[subscriptionStatus] ?? PLAN_COLOR.none}`}
              >
                {PLAN_LABEL[subscriptionStatus] ?? subscriptionStatus}
              </span>
            </div>

            <div className="rounded-lg border border-foreground/10 bg-foreground/[0.03] p-4">
              <div className="flex items-center gap-2">
                <span className={presence.textColor}>{presence.icon}</span>
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  {hasAccess ? <HiOutlineCloud className="text-base text-muted-foreground" /> : null}
                  {presence.label}
                </p>
                {hasAccess && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-7 px-2 text-xs"
                    disabled={!canSyncNow}
                    onClick={handleSyncNow}
                  >
                    <HiOutlineArrowPath className={manualSyncing ? "animate-spin" : ""} />
                    Sync now
                  </Button>
                )}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{presence.description}</p>
              {subscriptionStatus === "past_due" && (
                <p className="mt-2 text-xs text-red-500">
                  Payment failed — update your card to keep syncing.
                </p>
              )}
            </div>

            {!hasAccess && subscriptionStatus !== "loading" && (
              <Button
                className="w-full"
                onClick={() => {
                  setAccountOpen(false);
                  setUpgradeOpen(true);
                }}
              >
                Upgrade to Cloud Sync
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setAccountOpen(false);
                void signOut();
              }}
            >
              Sign out
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </>
  );
}
