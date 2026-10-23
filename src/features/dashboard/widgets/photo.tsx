import React from "react";
import { HiOutlinePhoto } from "react-icons/hi2";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettingsStore } from "@/features/settings/stores";
import { TextField } from "./TextField";
import { defineWidget, type WidgetRenderProps } from "./types";

const Unsplash = React.lazy(() => import("@/features/media/components/Unsplash"));

interface PhotoConfig {
  searchTerms?: string[];
  /** Bumped by "Clear cached photo" to force a fresh fetch — see PhotoRender's key. */
  cacheBust?: number;
}

function PhotoRender({ instance, cardClass }: WidgetRenderProps) {
  const config = instance.config as PhotoConfig;
  // Keying on cacheBust forces a remount (and so a fresh fetch) right after
  // the cache is cleared, instead of the already-mounted instance quietly
  // keeping its in-memory photo until the next full page load.
  return (
    <React.Suspense fallback={<div className={cardClass} />}>
      <Unsplash key={config.cacheBust ?? 0} search={config.searchTerms} cardClass={cardClass} />
    </React.Suspense>
  );
}

// The Unsplash access key is one shared credential, not something that makes
// sense to vary per tile — editing it here writes straight to the app-wide
// setting (same field every photo widget already falls back to), so setting
// it from any one photo widget applies to all of them. Takes a reload to
// show up on already-mounted widgets, same as it did from Settings before.
function PhotoConfigFields({ config, onChange }: { config: PhotoConfig; onChange: (next: PhotoConfig) => void }) {
  const unsplashCredential = useSettingsStore((state) => state.settings.unsplashCredential) as string | null | undefined;
  const persistSettings = useSettingsStore((state) => state.persistSettings);
  const value = Array.isArray(config.searchTerms) ? config.searchTerms.join(", ") : "";

  const clearCache = () => {
    // Dynamic import so clearing a cache doesn't drag Unsplash's shader
    // dependencies into this config panel's chunk.
    void import("@/features/media/components/Unsplash").then(({ clearPhotoCache }) =>
      clearPhotoCache(config.searchTerms || []),
    );
    onChange({ ...config, cacheBust: Date.now() });
  };

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="photo-terms">Search terms (comma-separated)</Label>
        <Input
          id="photo-terms"
          value={value}
          placeholder="peru, mexico, brazil"
          onChange={(event) =>
            onChange({
              ...config,
              searchTerms: event.target.value.split(",").map((term) => term.trim()).filter(Boolean),
            })
          }
        />
      </div>
      <TextField
        id="photo-access-key"
        label="Unsplash access key (applies to all photo widgets)"
        value={unsplashCredential || ""}
        placeholder="Use the Access Key, not the Secret Key"
        onChange={(value) => void persistSettings((prev) => ({ ...prev, unsplashCredential: value.trim() || null }))}
      />
      <div>
        <Button type="button" variant="outline" onClick={clearCache}>
          Clear cached photo
        </Button>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Drops the saved photo for these search terms so this tile picks up something new. Takes effect once you click Done.
        </p>
      </div>
    </div>
  );
}

export const photoWidget = defineWidget<PhotoConfig>({
  type: "photo",
  label: "Photo",
  icon: HiOutlinePhoto,
  defaultSize: "small",
  makeDefaultConfig: () => ({ searchTerms: [] }),
  Render: PhotoRender,
  ConfigFields: PhotoConfigFields,
});
