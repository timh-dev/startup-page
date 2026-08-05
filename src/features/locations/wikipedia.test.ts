import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWikipediaSummary } from "./wikipedia";

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body } as Response;
}

function opensearchResult(title: string | null) {
  return ["query", title ? [title] : [], [""], title ? [`https://en.wikipedia.org/wiki/${title}`] : []];
}

function pageDetailsResult(overrides: Record<string, unknown> = {}) {
  return {
    query: {
      pages: {
        1: {
          title: "Khumbu Icefall",
          extract: "The Khumbu Icefall lies on the Nepalese slopes of Mount Everest.",
          thumbnail: { source: "https://upload.wikimedia.org/thumb.jpg" },
          coordinates: [{ lat: 27.99583333, lon: 86.87277778 }],
          ...overrides,
        },
      },
    },
  };
}

// Routes a mocked fetch by inspecting the query string, rather than call
// order, since the number of requests fetchWikipediaSummary makes varies
// with whether the first attempt matches.
function mockFetchByAction(handlers: { opensearch: (search: string) => string | null; query?: () => unknown }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const parsed = new URL(url);
      if (parsed.searchParams.get("action") === "opensearch") {
        const search = parsed.searchParams.get("search") || "";
        return jsonResponse(opensearchResult(handlers.opensearch(search)));
      }
      return jsonResponse(handlers.query ? handlers.query() : pageDetailsResult());
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchWikipediaSummary", () => {
  it("resolves an exact match (e.g. a named park) without a country hint", async () => {
    mockFetchByAction({ opensearch: () => "Nahanni National Park Reserve" });
    const summary = await fetchWikipediaSummary("Nahanni National Park Reserve");
    expect(summary?.title).toBe("Khumbu Icefall"); // from the shared pageDetailsResult fixture
    expect(summary?.latitude).toBeCloseTo(27.99583333);
    expect(summary?.longitude).toBeCloseTo(86.87277778);
  });

  it("falls back to dropping the trailing word and reports it as a country hint", async () => {
    mockFetchByAction({
      opensearch: (search) => (search === "Khumbu Icefall Nepal" ? null : "Khumbu Icefall"),
    });
    const summary = await fetchWikipediaSummary("Khumbu Icefall Nepal");
    expect(summary?.title).toBe("Khumbu Icefall");
    expect(summary?.countryHint).toBe("Nepal");
  });

  it("returns null when neither the full query nor the trimmed query match anything", async () => {
    mockFetchByAction({ opensearch: () => null });
    const summary = await fetchWikipediaSummary("Scimitar Canyon canada");
    expect(summary).toBeNull();
  });

  it("returns null for a disambiguation page instead of surfacing a useless match", async () => {
    mockFetchByAction({
      opensearch: () => "Virginia Falls",
      query: () => pageDetailsResult({ pageprops: { disambiguation: "" }, coordinates: undefined }),
    });
    const summary = await fetchWikipediaSummary("Virginia Falls");
    expect(summary).toBeNull();
  });

  it("guesses the country from the extract text when no word was stripped off the query", async () => {
    mockFetchByAction({
      opensearch: () => "Nahanni National Park Reserve",
      query: () =>
        pageDetailsResult({
          extract: "...in the Dehcho Region of the Northwest Territories, Canada, protects a portion...",
        }),
    });
    const summary = await fetchWikipediaSummary("Nahanni National Park Reserve");
    expect(summary?.countryHint).toBe("Canada");
  });

  it("returns null for blank input without making any request", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await fetchWikipediaSummary("   ")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("requests redirects=1 so a redirect-stub title (e.g. 'Pucón, Chile') resolves to the real article", async () => {
    let queryUrl: URL | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const parsed = new URL(url);
        if (parsed.searchParams.get("action") === "opensearch") {
          return jsonResponse(opensearchResult("Pucón, Chile"));
        }
        queryUrl = parsed;
        return jsonResponse(pageDetailsResult({ title: "Pucón" }));
      }),
    );
    await fetchWikipediaSummary("Pucon Chile");
    expect(queryUrl?.searchParams.get("redirects")).toBe("1");
  });

  it("reports a recognized trailing country as the hint even when the full query matches on the first try", async () => {
    // Regression: previously the country hint was only captured when
    // dropping the trailing word was *necessary* for the match — so a query
    // that resolved directly (e.g. after the redirects=1 fix above) silently
    // lost a country the user explicitly typed.
    mockFetchByAction({ opensearch: () => "Pucón" });
    const summary = await fetchWikipediaSummary("Pucon Chile");
    expect(summary?.countryHint).toBe("Chile");
  });
});
