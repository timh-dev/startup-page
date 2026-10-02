import { useState } from "react";
import { useAuth } from "@clerk/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Same-origin by default; self-hosters can point at a remote API.
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function UpgradeModal({ open, onOpenChange }: UpgradeModalProps) {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/subscription/create-checkout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to create checkout session");
      const data = await res.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(92vw,460px)] border-border/60 bg-background/98 p-6">
        <DialogHeader>
          <DialogTitle className="pr-8">Cloud Sync — $0.99 / month</DialogTitle>
          <DialogDescription>Your settings, everywhere.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <ul className="space-y-2 text-sm text-foreground/80">
            <li>✓ Bookmarks, vault, themes, and all preferences synced automatically</li>
            <li>✓ Works across every browser and device</li>
            <li>✓ Cancel anytime — local storage always keeps working</li>
          </ul>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button className="w-full" onClick={handleUpgrade} disabled={loading}>
            {loading ? "Redirecting to Stripe…" : "Subscribe — $0.99 / month"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Billed monthly. Cancel anytime from your account.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
