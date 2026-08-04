import React from "react";
import { useNavigate } from "react-router-dom";
import {
  HiOutlineArchiveBox,
  HiOutlineBeaker,
  HiOutlineBell,
  HiOutlineBookmark,
  HiOutlineBookOpen,
  HiOutlineChartBar,
  HiOutlineClock,
  HiOutlineCloud,
  HiOutlineCodeBracketSquare,
  HiOutlineGlobeAlt,
  HiOutlineMagnifyingGlass,
  HiOutlineMusicalNote,
  HiOutlineNewspaper,
  HiOutlinePhoto,
  HiOutlineRss,
  HiOutlineSparkles,
  HiOutlineSquares2X2,
  HiOutlineVideoCamera,
} from "react-icons/hi2";

import type { WidgetInstance, WidgetType } from "@/lib/dashboard-dimensions";
import { updateWidgetConfig } from "@/lib/dashboard-dimensions";
import { useSettingsStore } from "@/features/settings/stores";
import { readSettings } from "@/lib/settings";

import Clock from "@/features/dashboard/components/Clock";
import SearchBox from "@/features/dashboard/components/Search";
import {
  DEFAULT_SEARCH_ENGINES,
  SEARCH_ICON_OPTIONS,
  getSearchEngineIcon,
  type SearchEngine,
} from "@/features/dashboard/searchEngines";
import HeadlinesHero from "@/features/dashboard/components/HeadlinesHero";
import TimerBox from "@/features/dashboard/components/TimerBox";
import WikipediaToD from "@/features/dashboard/components/WikipediaToD";
import RSSFeed from "@/features/dashboard/components/RSSFeed";
import GitHubActivity from "@/features/dashboard/components/GitHubActivity";
import { IframeWidget, IframeConfigFields, type IframeWidgetConfig } from "@/features/dashboard/components/IframeWidget";

import Bookmark from "@/features/bookmarks/components/Bookmark";
import { useBookmarkDialogStore } from "@/features/bookmarks/stores/bookmarkDialogStore";
import AirQuality from "@/features/weather/components/AirQuality";
import type { WeatherOverrides } from "@/features/weather/hooks/useWeatherData";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import desert from "@/assets/media/desert.mp4";

// Split out of the eagerly-loaded dashboard bundle: each pulls in a
// dependency (canvas/SVG scenes, a shader library, axios, a stack of other
// widgets) that most dashboards don't need on first paint just because one
// tile of this type exists somewhere in the layout.
const SolarGraph = React.lazy(() => import("@/features/media/solarGraph"));
const Unsplash = React.lazy(() => import("@/features/media/components/Unsplash"));
const WeatherBox = React.lazy(() =>
  import("@/features/weather/components/WeatherBox").then((m) => ({ default: m.WeatherBox })),
);
const WeatherDayDetail = React.lazy(() => import("@/features/weather/components/WeatherDayDetail"));
const WeatherFrostedCard = React.lazy(() => import("@/features/weather/components/WeatherFrostedCard"));
const SpotifyPlayer = React.lazy(() => import("@/features/dashboard/components/SpotifyPlayer"));
const VaultLauncher = React.lazy(() => import("@/features/resourceVault/components/VaultLauncher"));
const StackWidget = React.lazy(() =>
  import("@/features/dashboard/components/StackWidget").then((m) => ({ default: m.StackWidget })),
);

export interface WidgetTypeDef {
  type: WidgetType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultSize: "small" | "wide" | "tall" | "large" | "feature";
  /** Sizes this widget can be set to. Omit to allow all 5 (today's default for every existing widget). */
  allowedSizes?: Array<"small" | "wide" | "tall" | "large" | "feature">;
  makeDefaultConfig: () => Record<string, unknown>;
  Render: React.ComponentType<{ instance: WidgetInstance; cardClass?: string }>;
  ConfigFields?: React.ComponentType<{ config: Record<string, unknown>; onChange: (next: Record<string, unknown>) => void }>;
}

function TextField({
  id, label, value, placeholder, onChange,
}: { id: string; label: string; value: string; placeholder?: string; onChange: (value: string) => void }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

// ---- search -----------------------------------------------------------------

interface SearchConfig {
  engines?: SearchEngine[];
}

function SearchRender({ instance, cardClass }: { instance: WidgetInstance; cardClass?: string }) {
  const engines = (instance.config as SearchConfig).engines;
  return <div className={cardClass}><SearchBox engines={engines} /></div>;
}

function SearchConfigFields({ config, onChange }: { config: SearchConfig; onChange: (next: SearchConfig) => void }) {
  const engines = config.engines?.length ? config.engines : DEFAULT_SEARCH_ENGINES;

  const changeEngine = (index: number, key: keyof SearchEngine, value: string) => {
    const next = engines.map((engine, i) => (i === index ? { ...engine, [key]: value } : engine));
    onChange({ ...config, engines: next });
  };

  const addEngine = () => {
    onChange({ ...config, engines: [...engines, { id: `engine-${Date.now()}`, name: "", url: "", icon: "search" }] });
  };

  const removeEngine = (index: number) => {
    onChange({ ...config, engines: engines.filter((_engine, i) => i !== index) });
  };

  const moveEngine = (index: number, direction: number) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= engines.length) return;
    const next = [...engines];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange({ ...config, engines: next });
  };

  return (
    <div className="grid gap-3">
      {engines.map((engine, index) => {
        const EngineIcon = getSearchEngineIcon(engine.icon);
        return (
          <div key={engine.id ?? index} className="rounded-xl border border-border bg-muted/25 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full border border-border/60 bg-card">
                  <EngineIcon className="size-3.5" aria-hidden="true" />
                </span>
                <p className="text-xs font-medium">{engine.name || "Untitled engine"}</p>
              </div>
              <div className="flex gap-1">
                <Button type="button" size="sm" variant="outline" onClick={() => moveEngine(index, -1)} disabled={index === 0} aria-label="Move engine up">↑</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => moveEngine(index, 1)} disabled={index === engines.length - 1} aria-label="Move engine down">↓</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => removeEngine(index)}>Remove</Button>
              </div>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
              <TextField id={`engine-name-${index}`} label="Name" value={engine.name} placeholder="e.g. YouTube" onChange={(value) => changeEngine(index, "name", value)} />
              <TextField id={`engine-url-${index}`} label="Search URL" value={engine.url} placeholder="https://example.com/search?q=" onChange={(value) => changeEngine(index, "url", value)} />
              <div className="grid gap-1.5">
                <Label htmlFor={`engine-icon-${index}`}>Icon</Label>
                <select
                  id={`engine-icon-${index}`}
                  value={engine.icon || "search"}
                  onChange={(event) => changeEngine(index, "icon", event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {SEARCH_ICON_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        );
      })}
      <Button type="button" variant="outline" onClick={addEngine}>Add engine</Button>
    </div>
  );
}

// ---- timer --------------------------------------------------------------

function TimerRender({ instance, cardClass }: { instance: WidgetInstance; cardClass?: string }) {
  const persistSettings = useSettingsStore((state) => state.persistSettings);
  // Falls back to the pre-widget global default for instances migrated before
  // per-widget timer config existed.
  const legacyDefault = useSettingsStore((state) => state.settings.timer?.focusMinutes);
  const focusMinutes = (instance.config as { focusMinutes?: number }).focusMinutes ?? legacyDefault;

  const handleFocusMinutesChange = (minutes: number) => {
    void persistSettings((prev) => {
      const widgets: WidgetInstance[] = Array.isArray(prev.widgets) ? prev.widgets : [];
      return { ...prev, widgets: updateWidgetConfig(widgets, instance.id, { focusMinutes: minutes }) };
    });
  };

  return (
    <div className={cardClass}>
      <TimerBox focusMinutes={focusMinutes} onFocusMinutesChange={handleFocusMinutesChange} />
    </div>
  );
}

// ---- weather --------------------------------------------------------------

interface WeatherConfig {
  variant?: "compact" | "detail";
  lat?: number | null;
  lon?: number | null;
  units?: "imperial" | "metric" | null;
  openWeatherKey?: string | null;
}

function weatherOverridesFrom(config: WeatherConfig): WeatherOverrides {
  return {
    lat: config.lat ?? undefined,
    lon: config.lon ?? undefined,
    units: config.units ?? undefined,
    apiKey: config.openWeatherKey ?? undefined,
  };
}

function WeatherRender({ instance, cardClass }: { instance: WidgetInstance; cardClass?: string }) {
  const config = instance.config as WeatherConfig;
  const overrides = weatherOverridesFrom(config);
  if (config.variant === "detail") {
    return (
      <div className={cardClass}>
        <React.Suspense fallback={null}>
          <WeatherDayDetail instanceId={instance.id} overrides={overrides} />
        </React.Suspense>
      </div>
    );
  }
  return (
    <div className={cardClass}>
      <React.Suspense fallback={null}>
        <WeatherBox instanceId={instance.id} overrides={overrides} />
      </React.Suspense>
    </div>
  );
}

function WeatherConfigFields({ config, onChange }: { config: WeatherConfig; onChange: (next: WeatherConfig) => void }) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="weather-variant">Display</Label>
        <select
          id="weather-variant"
          value={config.variant || "compact"}
          onChange={(event) => onChange({ ...config, variant: event.target.value as WeatherConfig["variant"] })}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <option value="compact">Compact (current + 5-day)</option>
          <option value="detail">Detail (hourly breakdown)</option>
        </select>
      </div>
      <p className="text-xs text-muted-foreground">
        Leave location/key blank to use the app-wide values from Settings → Content.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          id="weather-lat"
          label="Latitude"
          value={config.lat != null ? String(config.lat) : ""}
          onChange={(value) => onChange({ ...config, lat: value === "" ? null : Number(value) })}
        />
        <TextField
          id="weather-lon"
          label="Longitude"
          value={config.lon != null ? String(config.lon) : ""}
          onChange={(value) => onChange({ ...config, lon: value === "" ? null : Number(value) })}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="weather-units">Units</Label>
        <select
          id="weather-units"
          value={config.units || ""}
          onChange={(event) => onChange({ ...config, units: (event.target.value || null) as WeatherConfig["units"] })}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <option value="">App default</option>
          <option value="imperial">Imperial (°F, mph)</option>
          <option value="metric">Metric (°C, km/h)</option>
        </select>
      </div>
      <TextField
        id="weather-key"
        label="OpenWeather API key (optional override)"
        value={config.openWeatherKey || ""}
        onChange={(value) => onChange({ ...config, openWeatherKey: value || null })}
      />
    </div>
  );
}

// ---- weatherV2 (frosted-glass hourly card) ---------------------------------

interface WeatherV2Config {
  lat?: number | null;
  lon?: number | null;
  units?: "imperial" | "metric" | null;
  openWeatherKey?: string | null;
}

function WeatherV2Render({ instance, cardClass }: { instance: WidgetInstance; cardClass?: string }) {
  const config = instance.config as WeatherV2Config;
  const overrides = weatherOverridesFrom(config);
  return (
    <div className={cardClass}>
      <React.Suspense fallback={null}>
        <WeatherFrostedCard instanceId={instance.id} overrides={overrides} />
      </React.Suspense>
    </div>
  );
}

function WeatherV2ConfigFields({ config, onChange }: { config: WeatherV2Config; onChange: (next: WeatherV2Config) => void }) {
  return (
    <div className="grid gap-3">
      <p className="text-xs text-muted-foreground">
        Leave location/key blank to use the app-wide values from Settings → Content.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          id="weather-v2-lat"
          label="Latitude"
          value={config.lat != null ? String(config.lat) : ""}
          onChange={(value) => onChange({ ...config, lat: value === "" ? null : Number(value) })}
        />
        <TextField
          id="weather-v2-lon"
          label="Longitude"
          value={config.lon != null ? String(config.lon) : ""}
          onChange={(value) => onChange({ ...config, lon: value === "" ? null : Number(value) })}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="weather-v2-units">Units</Label>
        <select
          id="weather-v2-units"
          value={config.units || ""}
          onChange={(event) => onChange({ ...config, units: (event.target.value || null) as WeatherV2Config["units"] })}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <option value="">App default</option>
          <option value="imperial">Imperial (°F, mph)</option>
          <option value="metric">Metric (°C, km/h)</option>
        </select>
      </div>
      <TextField
        id="weather-v2-key"
        label="OpenWeather API key (optional override)"
        value={config.openWeatherKey || ""}
        onChange={(value) => onChange({ ...config, openWeatherKey: value || null })}
      />
    </div>
  );
}

// ---- bookmark ---------------------------------------------------------------

function BookmarkRender({ instance, cardClass }: { instance: WidgetInstance; cardClass?: string }) {
  const bookmarkGroups = useSettingsStore((state) => (Array.isArray(state.settings.bookmark) ? state.settings.bookmark : []));
  const navigate = useNavigate();
  const openAddBookmarkDialog = useBookmarkDialogStore((state) => state.openAddBookmark);
  const groupId = (instance.config as { groupId?: string | null }).groupId;
  const group = bookmarkGroups.find((candidate: any) => candidate.id === groupId) || { id: null, title: "", content: [] };

  return (
    <Bookmark
      title={group.title}
      content={group.content}
      cardClass={cardClass}
      onTitleClick={group.id ? () => {
        window.localStorage?.setItem("startup-page.active-bookmark-category", group.id);
        navigate("/bookmarks");
      } : undefined}
      onQuickAdd={group.id ? () => openAddBookmarkDialog(group.id) : undefined}
    />
  );
}

function BookmarkConfigFields({ config, onChange }: { config: { groupId?: string | null }; onChange: (next: any) => void }) {
  const bookmarkGroups = useSettingsStore((state) => (Array.isArray(state.settings.bookmark) ? state.settings.bookmark : []));
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="bookmark-group">Folder</Label>
      <select
        id="bookmark-group"
        value={config.groupId || ""}
        onChange={(event) => onChange({ ...config, groupId: event.target.value || null })}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <option value="">Select a folder…</option>
        {bookmarkGroups.map((group: any) => (
          <option key={group.id} value={group.id}>{group.title}</option>
        ))}
      </select>
    </div>
  );
}

// ---- photo ------------------------------------------------------------------

interface PhotoConfig {
  searchTerms?: string[];
  /** Bumped by "Clear cached photo" to force a fresh fetch — see PhotoRender's key. */
  cacheBust?: number;
}

function PhotoRender({ instance, cardClass }: { instance: WidgetInstance; cardClass?: string }) {
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
    // Dynamic import so clearing a cache doesn't drag Unsplash's axios/shader
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

// ---- video --------------------------------------------------------------

interface VideoConfig {
  url?: string;
  zoom?: number;
  offsetX?: number;
  offsetY?: number;
}

function VideoRender({ instance, cardClass }: { instance: WidgetInstance; cardClass?: string }) {
  const config = instance.config as VideoConfig;
  const globalUrls = useSettingsStore((state) => state.settings.decorativeVideo?.urls) as string[] | undefined;
  const [fallbackUrl] = React.useState(() => {
    const pool = Array.isArray(globalUrls) ? globalUrls.filter(Boolean) : [];
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : desert;
  });
  const src = (config.url || "").trim() || fallbackUrl;
  const zoom = config.zoom ?? 1.6;
  const offsetX = config.offsetX ?? 0;
  const offsetY = config.offsetY ?? 0;

  return (
    <div className={`${cardClass || ""} relative overflow-hidden`}>
      <video
        className="absolute max-w-none object-cover"
        style={{
          width: `${100 * zoom}%`,
          height: `${100 * zoom}%`,
          left: `${offsetX}px`,
          top: `${offsetY}px`,
        }}
        src={src}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

function VideoConfigFields({ config, onChange }: { config: VideoConfig; onChange: (next: VideoConfig) => void }) {
  return (
    <div className="grid gap-3">
      <TextField
        id="video-url"
        label="Video URL (.mp4)"
        value={config.url || ""}
        placeholder="Leave blank to use a random URL from Settings → Content"
        onChange={(value) => onChange({ ...config, url: value })}
      />
      <div className="grid grid-cols-3 gap-3">
        <TextField id="video-zoom" label="Zoom" value={String(config.zoom ?? 1.6)} onChange={(value) => onChange({ ...config, zoom: Number(value) || 1 })} />
        <TextField id="video-offx" label="Offset X" value={String(config.offsetX ?? 0)} onChange={(value) => onChange({ ...config, offsetX: Number(value) || 0 })} />
        <TextField id="video-offy" label="Offset Y" value={String(config.offsetY ?? 0)} onChange={(value) => onChange({ ...config, offsetY: Number(value) || 0 })} />
      </div>
    </div>
  );
}

// ---- vault ------------------------------------------------------------------

function VaultRender({ cardClass }: { instance: WidgetInstance; cardClass?: string }) {
  return (
    <div className={cardClass}>
      <React.Suspense fallback={null}>
        <VaultLauncher />
      </React.Suspense>
    </div>
  );
}

// ---- solarGraph ---------------------------------------------------------

function SolarGraphRender({ cardClass }: { instance: WidgetInstance; cardClass?: string }) {
  return (
    <div className={cardClass}>
      <React.Suspense fallback={null}>
        <SolarGraph />
      </React.Suspense>
    </div>
  );
}

// ---- simple wrapped types with per-instance credentials ------------------

function RSSConfigFields({ config, onChange }: { config: { feedUrl?: string | null }; onChange: (next: any) => void }) {
  return (
    <TextField
      id="rss-url"
      label="RSS/Atom feed URL"
      value={config.feedUrl || ""}
      placeholder="https://example.com/feed.xml"
      onChange={(value) => onChange({ ...config, feedUrl: value || null })}
    />
  );
}

function GitHubConfigFields({ config, onChange }: { config: { username?: string | null }; onChange: (next: any) => void }) {
  return (
    <TextField
      id="github-username"
      label="GitHub username"
      value={config.username || ""}
      placeholder="torvalds"
      onChange={(value) => onChange({ ...config, username: value || null })}
    />
  );
}

function SpotifyConfigFields({ config, onChange }: { config: { clientId?: string | null }; onChange: (next: any) => void }) {
  return (
    <TextField
      id="spotify-client"
      label="Spotify app client ID"
      value={config.clientId || ""}
      placeholder="Create an app at developer.spotify.com"
      onChange={(value) => onChange({ ...config, clientId: value || null })}
    />
  );
}

function HeadlinesConfigFields({ config, onChange }: { config: { subreddit?: string | null; rotationSeconds?: number | null }; onChange: (next: any) => void }) {
  return (
    <div className="grid gap-3">
      <TextField
        id="headlines-subreddit"
        label="Subreddit"
        value={config.subreddit || ""}
        placeholder="worldnews"
        onChange={(value) => onChange({ ...config, subreddit: value || null })}
      />
      <TextField
        id="headlines-rotation"
        label="Rotation seconds"
        value={config.rotationSeconds != null ? String(config.rotationSeconds) : ""}
        placeholder="8"
        onChange={(value) => onChange({ ...config, rotationSeconds: value === "" ? null : Number(value) })}
      />
    </div>
  );
}

// ---- iframe -------------------------------------------------------------

function IframeRender({ instance, cardClass }: { instance: WidgetInstance; cardClass?: string }) {
  return <IframeWidget config={instance.config as IframeWidgetConfig} cardClass={cardClass} />;
}

// ---- stack ----------------------------------------------------------------

function StackRender({ instance, cardClass }: { instance: WidgetInstance; cardClass?: string }) {
  return (
    <React.Suspense fallback={<div className={cardClass} />}>
      <StackWidget items={instance.items || []} cardClass={cardClass} />
    </React.Suspense>
  );
}

// ---------------------------------------------------------------------------

export const WIDGET_TYPES: WidgetTypeDef[] = [
  {
    type: "clock",
    label: "Clock",
    icon: HiOutlineClock,
    defaultSize: "small",
    makeDefaultConfig: () => ({}),
    Render: ({ cardClass }) => <div className={cardClass}><Clock /></div>,
  },
  {
    type: "search",
    label: "Search",
    icon: HiOutlineMagnifyingGlass,
    defaultSize: "wide",
    makeDefaultConfig: () => ({ engines: readSettings().search?.engines ?? DEFAULT_SEARCH_ENGINES }),
    Render: SearchRender,
    ConfigFields: SearchConfigFields as unknown as WidgetTypeDef["ConfigFields"],
  },
  {
    type: "weather",
    label: "Weather",
    icon: HiOutlineCloud,
    defaultSize: "wide",
    makeDefaultConfig: () => ({ variant: "compact" }),
    Render: WeatherRender,
    ConfigFields: WeatherConfigFields as unknown as WidgetTypeDef["ConfigFields"],
  },
  {
    type: "weatherV2",
    label: "Weather (Frosted)",
    icon: HiOutlineSparkles,
    defaultSize: "feature",
    allowedSizes: ["feature"],
    makeDefaultConfig: () => ({}),
    Render: WeatherV2Render,
    ConfigFields: WeatherV2ConfigFields as unknown as WidgetTypeDef["ConfigFields"],
  },
  {
    type: "bookmark",
    label: "Bookmark folder",
    icon: HiOutlineBookmark,
    defaultSize: "small",
    makeDefaultConfig: () => ({ groupId: readSettings().bookmark?.[0]?.id ?? null }),
    Render: BookmarkRender,
    ConfigFields: BookmarkConfigFields as WidgetTypeDef["ConfigFields"],
  },
  {
    type: "photo",
    label: "Photo",
    icon: HiOutlinePhoto,
    defaultSize: "small",
    makeDefaultConfig: () => ({ searchTerms: [] }),
    Render: PhotoRender,
    ConfigFields: PhotoConfigFields as unknown as WidgetTypeDef["ConfigFields"],
  },
  {
    type: "vault",
    label: "Vault",
    icon: HiOutlineArchiveBox,
    defaultSize: "large",
    makeDefaultConfig: () => ({}),
    Render: VaultRender,
  },
  {
    type: "solarGraph",
    label: "Solar graph",
    icon: HiOutlineChartBar,
    defaultSize: "large",
    makeDefaultConfig: () => ({}),
    Render: SolarGraphRender,
  },
  {
    type: "video",
    label: "Video",
    icon: HiOutlineVideoCamera,
    defaultSize: "small",
    makeDefaultConfig: () => ({ url: "", zoom: 1.6, offsetX: 0, offsetY: 0 }),
    Render: VideoRender,
    ConfigFields: VideoConfigFields as unknown as WidgetTypeDef["ConfigFields"],
  },
  {
    type: "iframe",
    label: "Embedded page",
    icon: HiOutlineGlobeAlt,
    defaultSize: "small",
    makeDefaultConfig: () => ({ preset: "windy", url: "" }),
    Render: IframeRender,
    ConfigFields: IframeConfigFields as unknown as WidgetTypeDef["ConfigFields"],
  },
  {
    type: "stack",
    label: "Stack (swipeable)",
    icon: HiOutlineSquares2X2,
    defaultSize: "feature",
    makeDefaultConfig: () => ({}),
    Render: StackRender,
  },
  {
    type: "headlines",
    label: "Headlines",
    icon: HiOutlineNewspaper,
    defaultSize: "small",
    makeDefaultConfig: () => ({}),
    Render: ({ instance, cardClass }) => (
      <div className={cardClass}>
        <HeadlinesHero
          subreddit={(instance.config as any).subreddit}
          rotationSeconds={(instance.config as any).rotationSeconds}
        />
      </div>
    ),
    ConfigFields: HeadlinesConfigFields as WidgetTypeDef["ConfigFields"],
  },
  {
    type: "timer",
    label: "Timer",
    icon: HiOutlineBell,
    defaultSize: "small",
    makeDefaultConfig: () => ({ focusMinutes: readSettings().timer?.focusMinutes ?? 25 }),
    Render: TimerRender,
  },
  {
    type: "wikipedia",
    label: "Wikipedia",
    icon: HiOutlineBookOpen,
    defaultSize: "small",
    makeDefaultConfig: () => ({}),
    Render: ({ cardClass }) => <div className={cardClass}><WikipediaToD /></div>,
  },
  {
    type: "rss",
    label: "RSS feed",
    icon: HiOutlineRss,
    defaultSize: "small",
    makeDefaultConfig: () => ({ feedUrl: null }),
    Render: ({ instance, cardClass }) => (
      <div className={cardClass}><RSSFeed feedUrl={(instance.config as any).feedUrl} /></div>
    ),
    ConfigFields: RSSConfigFields as WidgetTypeDef["ConfigFields"],
  },
  {
    type: "github",
    label: "GitHub activity",
    icon: HiOutlineCodeBracketSquare,
    defaultSize: "small",
    makeDefaultConfig: () => ({ username: null }),
    Render: ({ instance, cardClass }) => (
      <div className={cardClass}><GitHubActivity username={(instance.config as any).username} /></div>
    ),
    ConfigFields: GitHubConfigFields as WidgetTypeDef["ConfigFields"],
  },
  {
    type: "spotify",
    label: "Spotify now playing",
    icon: HiOutlineMusicalNote,
    defaultSize: "small",
    makeDefaultConfig: () => ({ clientId: null }),
    Render: ({ instance, cardClass }) => (
      <div className={cardClass}>
        <React.Suspense fallback={null}>
          <SpotifyPlayer clientId={(instance.config as any).clientId} />
        </React.Suspense>
      </div>
    ),
    ConfigFields: SpotifyConfigFields as WidgetTypeDef["ConfigFields"],
  },
  {
    type: "airQuality",
    label: "Air quality",
    icon: HiOutlineBeaker,
    defaultSize: "small",
    makeDefaultConfig: () => ({}),
    Render: ({ cardClass }) => <div className={cardClass}><AirQuality /></div>,
  },
];

const WIDGET_TYPES_BY_KEY: Record<string, WidgetTypeDef> = Object.fromEntries(
  WIDGET_TYPES.map((def) => [def.type, def]),
);

export function getWidgetType(type: WidgetType): WidgetTypeDef {
  return WIDGET_TYPES_BY_KEY[type] || WIDGET_TYPES[0];
}
