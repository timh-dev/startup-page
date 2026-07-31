import React from "react";

import { useSettingsStore } from "@/features/settings/stores";
import {
  getSearchEngineIcon,
  normalizeSearchEngines,
} from "@/features/dashboard/searchEngines";

interface SearchBoxProps {
  engines?: unknown;
}

export default function SearchBox({ engines: configEngines }: SearchBoxProps = {}) {
  const storedEngines = useSettingsStore((state) => state.settings.search?.engines);
  const engines = React.useMemo(
    () => normalizeSearchEngines(configEngines ?? storedEngines),
    [configEngines, storedEngines],
  );

  const [activeEngineId, setActiveEngineId] = React.useState(engines[0]?.id);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Keep a valid engine selected as the list changes (add/remove/reorder).
  React.useEffect(() => {
    if (!engines.some((engine) => engine.id === activeEngineId)) {
      setActiveEngineId(engines[0]?.id);
    }
  }, [engines, activeEngineId]);

  const selectEngine = (engineId: string) => {
    setActiveEngineId(engineId);
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      return;
    }

    const engine =
      engines.find((item) => item.id === activeEngineId) || engines[0];
    if (!engine) {
      return;
    }

    const query = encodeURIComponent(event.currentTarget.value.trim());
    if (!query) {
      return;
    }

    window.open(`${engine.url}${query}`, "_blank", "noopener,noreferrer");
    event.currentTarget.value = "";
  };

  const searchButtonClass =
    "search-engine-button flex items-center justify-center rounded-full border border-border/60 bg-card/80 text-foreground shadow-sm outline-none transition hover:bg-accent/70 disabled:border-primary/40 disabled:bg-primary/14 disabled:opacity-100 opacity-75 cursor-pointer";

  return (
    <div className="search-widget flex h-full w-full items-center justify-center">
      <div className="search-inner">
        <div className="search-engines flex justify-center">
          {engines.map((engine) => {
            const Icon = getSearchEngineIcon(engine.icon);
            const isActive = engine.id === activeEngineId;
            return (
              <button
                key={engine.id}
                type="button"
                className={searchButtonClass}
                disabled={isActive}
                onClick={() => selectEngine(engine.id)}
                aria-label={`Search with ${engine.name}`}
                title={engine.name}
              >
                <Icon className="search-engine-icon" aria-hidden="true" />
              </button>
            );
          })}
        </div>
        <input
          className="search-input items-center border border-input bg-input/45 text-foreground placeholder:text-muted-foreground rounded-xl shadow-sm transition focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
          autoFocus
          id="search-input"
          type="text"
          placeholder={
            engines.find((item) => item.id === activeEngineId)?.name ?? "Search"
          }
          ref={inputRef}
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  );
}
