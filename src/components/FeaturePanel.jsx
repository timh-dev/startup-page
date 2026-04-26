import React from "react";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi2";

import HeadlinesHero from "./HeadlinesHero";
import TimerBox from "./TimerBox";
import Windy from "./Windy";
import { readSettings, writeSettings } from "./readSettings";

const FEATURE_MODES = [
  { key: "headlines", label: "Headlines" },
  { key: "windy", label: "Windy" },
  { key: "timer", label: "Timer" }
];

function FeatureContent({ mode }) {
  if (mode === "windy") {
    return <Windy cardClass="h-full w-full overflow-hidden rounded-[inherit]" />;
  }

  if (mode === "timer") {
    return <TimerBox />;
  }

  return <HeadlinesHero />;
}

export default function FeaturePanel() {
  const settings = React.useMemo(() => readSettings(), []);
  const storedMode = settings.featurePanel?.mode;
  const defaultMode = FEATURE_MODES.some((mode) => mode.key === storedMode)
    ? storedMode
    : FEATURE_MODES[0].key;
  const [activeMode, setActiveMode] = React.useState(defaultMode);

  const activeIndex = FEATURE_MODES.findIndex((mode) => mode.key === activeMode);

  const updateMode = (direction) => {
    const nextIndex = (activeIndex + direction + FEATURE_MODES.length) % FEATURE_MODES.length;
    const nextMode = FEATURE_MODES[nextIndex].key;
    setActiveMode(nextMode);
    void writeSettings({
      ...readSettings(),
      featurePanel: {
        mode: nextMode,
      },
    });
  };

  return (
    <div className="relative h-full w-full overflow-visible rounded-[inherit]">
      <div className="h-full w-full overflow-hidden rounded-[inherit]">
        <FeatureContent mode={activeMode} />
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
            onClick={() => updateMode(index - activeIndex)}
            className={`size-1.5 rounded-full transition ${
              index === activeIndex
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
