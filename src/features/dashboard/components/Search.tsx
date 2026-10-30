import React from "react";
import { HiMagnifyingGlass } from "react-icons/hi2";

import { useSettingsStore } from "@/features/settings/stores";
import {
  getSearchEngineIcon,
  normalizeSearchEngines,
} from "@/features/dashboard/searchEngines";
import { describeIntent, openResult, resolveQuery } from "@/features/dashboard/searchQuery";

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

  const [query, setQuery] = React.useState("");
  const activeEngine = engines.find((item) => item.id === activeEngineId) || engines[0];
  // Same rules as the command palette: bangs, "= sums", sites, then a search.
  const intent = resolveQuery(query, engines, activeEngine);
  const hint = intent && intent.kind !== "search" ? describeIntent(intent) : null;

  const selectEngine = (engineId: string) => {
    setActiveEngineId(engineId);
    setQuery("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setQuery("");
      return;
    }
    if (event.key !== "Enter" || !intent) return;
    event.preventDefault();
    if (intent.kind === "calc") {
      void navigator.clipboard?.writeText(intent.result);
      return;
    }
    openResult(intent.url, event.metaKey || event.ctrlKey || event.shiftKey);
    setQuery("");
  };

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
                className="search-engine-button"
                aria-pressed={isActive}
                onClick={() => selectEngine(engine.id)}
                aria-label={`Search with ${engine.name}`}
                title={engine.name}
              >
                <Icon className="search-engine-icon" aria-hidden="true" />
              </button>
            );
          })}
        </div>
        <label className="search-field">
          <HiMagnifyingGlass className="search-field-icon" aria-hidden="true" />
          <input
            className="search-input"
            autoFocus
            id="search-input"
            type="text"
            placeholder={`Search ${activeEngine?.name ?? "the web"}`}
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            aria-describedby={hint ? "search-hint" : undefined}
          />
          {hint && (
            <span id="search-hint" className="search-hint" aria-live="polite">
              {intent?.kind === "calc" ? `${hint} · Enter to copy` : hint}
            </span>
          )}
        </label>
      </div>
    </div>
  );
}
