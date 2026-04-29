import React from "react";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi2";

import HeadlinesHero from "./HeadlinesHero";
import TimerBox from "./TimerBox";
import Windy from "./Windy";
import Upsplash from "./Unsplash";
import WeatherForecast from "./WeatherForecast";
import AirQuality from "./AirQuality";
import WikipediaToD from "./WikipediaToD";
import RSSFeed from "./RSSFeed";
import GitHubActivity from "./GitHubActivity";
import SpotifyPlayer from "./SpotifyPlayer";
import { readSettings, writeSettings } from "@/lib/settings";

export const ALL_MODES = [
  { key: "headlines", label: "Headlines" },
  { key: "forecast", label: "Forecast" },
  { key: "airQuality", label: "Air Quality" },
  { key: "timer", label: "Timer" },
  { key: "windy", label: "Windy" },
  { key: "wikipedia", label: "Wikipedia" },
  { key: "rss", label: "RSS" },
  { key: "github", label: "GitHub" },
  { key: "spotify", label: "Spotify" },
  { key: "unsplash", label: "Unsplash" },
];

function FeatureContent({ mode, settings }) {
  if (mode === "windy") return <Windy cardClass="h-full w-full overflow-hidden rounded-[inherit]" />;
  if (mode === "timer") return <TimerBox />;
  if (mode === "unsplash") return <Upsplash search={settings.unsplash.unsplashBox6} cardClass="relative overflow-hidden h-full w-full bg-center bg-no-repeat rounded-[inherit]" />;
  if (mode === "forecast") return <WeatherForecast />;
  if (mode === "airQuality") return <AirQuality />;
  if (mode === "wikipedia") return <WikipediaToD />;
  if (mode === "rss") return <RSSFeed />;
  if (mode === "github") return <GitHubActivity />;
  if (mode === "spotify") return <SpotifyPlayer />;
  return <HeadlinesHero />;
}

export default function FeaturePanel() {
  const settings = React.useMemo(() => readSettings(), []);
  const enabledKeys = settings.featurePanel?.enabledModes;
  const FEATURE_MODES = enabledKeys?.length
    ? ALL_MODES.filter((m) => enabledKeys.includes(m.key))
    : ALL_MODES;

  const storedMode = settings.featurePanel?.mode;
  const defaultMode = FEATURE_MODES.some((m) => m.key === storedMode)
    ? storedMode
    : FEATURE_MODES[0].key;
  const [activeMode, setActiveMode] = React.useState(defaultMode);

  const activeIndex = FEATURE_MODES.findIndex((m) => m.key === activeMode);
  const safeIndex = activeIndex >= 0 ? activeIndex : 0;

  const updateMode = (direction) => {
    const nextIndex = (safeIndex + direction + FEATURE_MODES.length) % FEATURE_MODES.length;
    const nextMode = FEATURE_MODES[nextIndex].key;
    setActiveMode(nextMode);
    const current = readSettings();
    void writeSettings({
      ...current,
      featurePanel: { ...current.featurePanel, mode: nextMode },
    });
  };

  return (
    <div className="relative h-full w-full overflow-visible rounded-[inherit]">
      {/* All panels are mounted at once so they pre-fetch. CSS hides inactive ones. */}
      <div className="h-full w-full overflow-hidden rounded-[inherit]">
        {FEATURE_MODES.map((mode) => (
          <div
            key={mode.key}
            className="h-full w-full"
            style={{ display: mode.key === activeMode ? "block" : "none" }}
          >
            <FeatureContent mode={mode.key} settings={settings} />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => updateMode(-1)}
        className="absolute -left-3 top-1/2 z-10 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border border-border/80 bg-background/92 text-foreground shadow-md backdrop-blur-sm transition hover:bg-accent hover:text-accent-foreground"
        aria-label="Previous feature"
      >
        <HiChevronLeft className="size-3.5" />
      </button>

      <button
        type="button"
        onClick={() => updateMode(1)}
        className="absolute -right-3 top-1/2 z-10 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border border-border/80 bg-background/92 text-foreground shadow-md backdrop-blur-sm transition hover:bg-accent hover:text-accent-foreground"
        aria-label="Next feature"
      >
        <HiChevronRight className="size-3.5" />
      </button>

      <div className="absolute inset-x-0 -bottom-4 z-10 flex items-center justify-center gap-1.5">
        {FEATURE_MODES.map((mode, index) => (
          <button
            key={mode.key}
            type="button"
            onClick={() => updateMode(index - safeIndex)}
            className={`size-1.5 rounded-full transition ${
              index === safeIndex
                ? "bg-foreground shadow-sm"
                : "bg-border hover:bg-muted-foreground"
            }`}
            aria-label={`Show ${mode.label}`}
          />
        ))}
      </div>
    </div>
  );
}
