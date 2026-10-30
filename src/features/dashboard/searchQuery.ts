import type { SearchEngine } from "@/features/dashboard/searchEngines";

// What a typed query means, shared by the search card and the command
// palette so both treat "!yt lofi", "= 2^10", "example.com" and a plain
// search the same way.

// Search-provider bangs: "!yt lofi beats" → YouTube search. The user's own
// engines also work as bangs by their id ("!maps paris").
export const SEARCH_BANGS: Record<string, { label: string; url: (q: string) => string }> = {
  g: { label: "Google", url: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}` },
  ddg: { label: "DuckDuckGo", url: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}` },
  yt: { label: "YouTube", url: (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}` },
  gh: { label: "GitHub", url: (q) => `https://github.com/search?q=${encodeURIComponent(q)}` },
  w: { label: "Wikipedia", url: (q) => `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(q)}` },
  r: { label: "Reddit", url: (q) => `https://www.reddit.com/search/?q=${encodeURIComponent(q)}` },
  maps: { label: "Google Maps", url: (q) => `https://www.google.com/maps/search/${encodeURIComponent(q)}` },
  npm: { label: "npm", url: (q) => `https://www.npmjs.com/search?q=${encodeURIComponent(q)}` },
};

// Inline calculator for "= 340*1.08" queries. The whitelist regex keeps
// Function() safe: digits, operators, parens, and scientific notation only —
// no letters (beyond e/E), brackets, or quotes ever reach evaluation.
export function safeCalculate(expression: string) {
  const cleaned = expression.replace(/\^/g, "**").replace(/,/g, "");
  if (!/^[\d\s+\-*/().%eE]*$/.test(cleaned) || !/\d/.test(cleaned)) return null;
  try {
    const value = Function(`"use strict"; return (${cleaned});`)();
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    return value;
  } catch {
    return null;
  }
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 1e10) / 1e10);
}

/** "example.com", "localhost:3000/x" or a full http(s) URL, as a URL to open; null for anything else. */
export function asUrl(text: string): string | null {
  if (/\s/.test(text)) return null;
  if (/^https?:\/\/\S+$/i.test(text)) return text;
  const host = text.split(/[/?#]/)[0];
  const isDomain = /^([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?$/i.test(host);
  const isLocal = /^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?$/i.test(host);
  if (!isDomain && !isLocal) return null;
  return `${isLocal ? "http" : "https"}://${text}`;
}

export type QueryIntent =
  | { kind: "calc"; result: string }
  | { kind: "bang"; label: string; query: string; url: string }
  | { kind: "url"; url: string }
  | { kind: "search"; label: string; query: string; url: string };

/**
 * What `raw` asks for: a sum, a bang search, a site to open, or a search with
 * `engine` (the first of the user's engines when not given). Null for an
 * empty query, an unfinished sum, or no engine to search with.
 */
export function resolveQuery(raw: string, engines: SearchEngine[], engine: SearchEngine | undefined = engines[0]): QueryIntent | null {
  const query = raw.trim();
  if (!query) return null;

  if (query.startsWith("=")) {
    const value = query.length > 1 ? safeCalculate(query.slice(1)) : null;
    return value === null ? null : { kind: "calc", result: formatNumber(value) };
  }

  const bang = query.match(/^!(\S+)\s+(.+)$/);
  if (bang) {
    const key = bang[1].toLowerCase();
    const terms = bang[2].trim();
    const own = engines.find((item) => item.id.toLowerCase() === key);
    if (own) return { kind: "bang", label: own.name, query: terms, url: `${own.url}${encodeURIComponent(terms)}` };
    const builtIn = SEARCH_BANGS[key];
    if (builtIn) return { kind: "bang", label: builtIn.label, query: terms, url: builtIn.url(terms) };
  }

  const url = asUrl(query);
  if (url) return { kind: "url", url };

  if (!engine) return null;
  return { kind: "search", label: engine.name, query, url: `${engine.url}${encodeURIComponent(query)}` };
}

/** A short line describing what Enter will do. */
export function describeIntent(intent: QueryIntent): string {
  switch (intent.kind) {
    case "calc":
      return `= ${intent.result}`;
    case "bang":
    case "search":
      return `Search ${intent.label} for “${intent.query}”`;
    case "url":
      return `Open ${intent.url.replace(/^https?:\/\//, "")}`;
  }
}

/** Opens a result here, or in a new tab when ⌘/Ctrl or Shift is held. */
export function openResult(url: string, newTab: boolean) {
  if (newTab) window.open(url, "_blank", "noopener,noreferrer");
  else window.location.assign(url);
}
