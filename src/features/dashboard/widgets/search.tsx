import { HiOutlineMagnifyingGlass } from "react-icons/hi2";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import SearchBox from "@/features/dashboard/components/Search";
import {
  DEFAULT_SEARCH_ENGINES,
  SEARCH_ICON_OPTIONS,
  getSearchEngineIcon,
  type SearchEngine,
} from "@/features/dashboard/searchEngines";
import { readSettings } from "@/lib/settings";
import { TextField } from "./TextField";
import { defineWidget, type WidgetRenderProps } from "./types";

interface SearchConfig {
  engines?: SearchEngine[];
}

function SearchRender({ instance, cardClass }: WidgetRenderProps) {
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

export const searchWidget = defineWidget<SearchConfig>({
  type: "search",
  label: "Search",
  icon: HiOutlineMagnifyingGlass,
  defaultSize: "wide",
  makeDefaultConfig: () => ({ engines: readSettings().search?.engines ?? DEFAULT_SEARCH_ENGINES }),
  Render: SearchRender,
  ConfigFields: SearchConfigFields,
});
