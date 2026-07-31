import React from "react";
import { getOrRequestLocation } from "@/lib/geolocation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export interface IframeWidgetConfig {
  preset?: "windy" | "googleMaps" | "custom";
  url?: string;
  query?: string;
}

// Mirrors the old Windy.tsx: prefer the app-wide lat/lon, fall back to
// geolocation, then to an unpositioned world view.
function useWindyUrl(): string {
  const [link, setLink] = React.useState("https://embed.windy.com/embed.html?type=map&overlay=rain");

  React.useEffect(() => {
    void getOrRequestLocation().then((coords) => {
      if (coords) {
        setLink(`https://embed.windy.com/embed.html?type=map&overlay=rain&lat=${coords.lat}&lon=${coords.lon}`);
      }
    });
  }, []);

  return link;
}

function resolveSrc(config: IframeWidgetConfig, windyUrl: string): string {
  if (config.preset === "windy") return windyUrl;
  if (config.preset === "googleMaps") {
    const query = (config.query || "").trim();
    return query ? `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed` : "";
  }
  return (config.url || "").trim();
}

export function IframeWidget({ config, cardClass }: { config: IframeWidgetConfig; cardClass?: string }): React.ReactElement {
  const windyUrl = useWindyUrl();
  const src = resolveSrc(config, windyUrl);

  if (!src) {
    return (
      <div className={cardClass || "flex h-full w-full items-center justify-center rounded-xl bg-card p-4 text-center"}>
        <p className="text-xs text-muted-foreground">Add a URL in this widget's settings.</p>
      </div>
    );
  }

  return (
    <div className={cardClass || "h-full w-full overflow-hidden rounded-xl"}>
      <iframe
        className="h-full w-full overflow-hidden rounded-[inherit] border-0 bg-card"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        src={src}
        title="Embedded widget"
      />
    </div>
  );
}

export function IframeConfigFields({
  config,
  onChange,
}: {
  config: IframeWidgetConfig;
  onChange: (next: IframeWidgetConfig) => void;
}): React.ReactElement {
  const preset = config.preset || "custom";

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="iframe-preset">Source</Label>
        <select
          id="iframe-preset"
          value={preset}
          onChange={(event) => onChange({ ...config, preset: event.target.value as IframeWidgetConfig["preset"] })}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <option value="windy">Windy (rain map, uses your location)</option>
          <option value="googleMaps">Google Maps</option>
          <option value="custom">Custom URL</option>
        </select>
      </div>
      {preset === "googleMaps" ? (
        <div className="grid gap-1.5">
          <Label htmlFor="iframe-query">Place or address</Label>
          <Input
            id="iframe-query"
            value={config.query || ""}
            placeholder="Golden Gate Bridge"
            onChange={(event) => onChange({ ...config, query: event.target.value })}
          />
        </div>
      ) : null}
      {preset === "custom" ? (
        <div className="grid gap-1.5">
          <Label htmlFor="iframe-url">URL</Label>
          <Input
            id="iframe-url"
            value={config.url || ""}
            placeholder="https://example.com/embed"
            onChange={(event) => onChange({ ...config, url: event.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Many sites block being embedded (X-Frame-Options/CSP) — this works best with pages built for embedding.
          </p>
        </div>
      ) : null}
    </div>
  );
}
