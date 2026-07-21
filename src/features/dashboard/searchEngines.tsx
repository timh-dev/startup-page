import type { IconType } from "react-icons";
import {
  FaAmazon,
  FaGithub,
  FaGlobe,
  FaGoogle,
  FaRedditAlien,
  FaSearch,
  FaStackOverflow,
  FaTwitter,
  FaWikipediaW,
  FaYoutube,
} from "react-icons/fa";
import {
  SiBrave,
  SiDuckduckgo,
  SiGooglemaps,
  SiPerplexity,
  SiWolframmathematica,
} from "react-icons/si";

export interface SearchEngine {
  id: string;
  name: string;
  url: string;
  icon: string;
}

// Icon keys the user can choose from in Settings. `search` is the generic
// fallback used whenever an engine's icon key is unknown or missing.
export const SEARCH_ENGINE_ICONS: Record<string, IconType> = {
  google: FaGoogle,
  maps: SiGooglemaps,
  duckduckgo: SiDuckduckgo,
  youtube: FaYoutube,
  wikipedia: FaWikipediaW,
  brave: SiBrave,
  perplexity: SiPerplexity,
  stackoverflow: FaStackOverflow,
  wolfram: SiWolframmathematica,
  reddit: FaRedditAlien,
  github: FaGithub,
  amazon: FaAmazon,
  twitter: FaTwitter,
  globe: FaGlobe,
  search: FaSearch,
};

export const SEARCH_ICON_OPTIONS: { key: string; label: string }[] = [
  { key: "search", label: "Search (generic)" },
  { key: "globe", label: "Globe (generic)" },
  { key: "google", label: "Google" },
  { key: "maps", label: "Google Maps" },
  { key: "duckduckgo", label: "DuckDuckGo" },
  { key: "youtube", label: "YouTube" },
  { key: "wikipedia", label: "Wikipedia" },
  { key: "brave", label: "Brave" },
  { key: "perplexity", label: "Perplexity" },
  { key: "stackoverflow", label: "Stack Overflow" },
  { key: "wolfram", label: "Wolfram Alpha" },
  { key: "reddit", label: "Reddit" },
  { key: "github", label: "GitHub" },
  { key: "amazon", label: "Amazon" },
  { key: "twitter", label: "X / Twitter" },
];

// Mirrors config/settings.json so the search box still works if a user clears
// every engine, and so the Settings editor can restore sensible defaults.
export const DEFAULT_SEARCH_ENGINES: SearchEngine[] = [
  { id: "duckduckgo", name: "DuckDuckGo", url: "https://duckduckgo.com/?q=", icon: "duckduckgo" },
  { id: "youtube", name: "YouTube", url: "https://www.youtube.com/results?search_query=", icon: "youtube" },
  { id: "wikipedia", name: "Wikipedia", url: "https://en.wikipedia.org/w/index.php?search=", icon: "wikipedia" },
  { id: "maps", name: "Google Maps", url: "https://www.google.com/maps/search/", icon: "maps" },
];

export function getSearchEngineIcon(iconKey: string | undefined): IconType {
  return (iconKey && SEARCH_ENGINE_ICONS[iconKey]) || SEARCH_ENGINE_ICONS.search;
}

export function normalizeSearchEngines(engines: unknown): SearchEngine[] {
  if (!Array.isArray(engines)) {
    return DEFAULT_SEARCH_ENGINES;
  }

  const cleaned = engines
    .filter((engine): engine is Partial<SearchEngine> => Boolean(engine) && typeof engine === "object")
    .map((engine, index) => ({
      id: String(engine.id || `engine-${index}`),
      name: String(engine.name || "").trim() || "Search",
      url: String(engine.url || "").trim(),
      icon: String(engine.icon || "search"),
    }))
    .filter((engine) => engine.url !== "");

  return cleaned.length ? cleaned : DEFAULT_SEARCH_ENGINES;
}
