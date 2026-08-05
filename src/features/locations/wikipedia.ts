import { guessContinent, guessCountryFromText } from "./geo";
import type { WikipediaSummary } from "./types";

/**
 * Every request below hits MediaWiki's own API with `origin=*`, which is
 * CORS-enabled for third-party origins by design — this runs entirely
 * client-side, no API key, no server proxy. Best-effort throughout: any
 * failure just means no auto-fill, never a blocking error for the caller.
 */

async function openSearchTitle(query: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=opensearch&format=json&limit=1&namespace=0&origin=*&search=${encodeURIComponent(query)}`;
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }
  const data = await response.json();
  const title = data?.[1]?.[0];
  return typeof title === "string" && title ? title : null;
}

async function fetchPageDetails(title: string) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    // Without this, a title like "Pucón, Chile" — a redirect stub, not the
    // real article — resolves to an empty page instead of following through
    // to "Pucón" and its actual coordinates/extract/thumbnail.
    redirects: "1",
    prop: "coordinates|pageimages|extracts|pageprops",
    ppprop: "disambiguation",
    exintro: "1",
    explaintext: "1",
    exchars: "500",
    piprop: "thumbnail",
    pithumbsize: "600",
    titles: title,
  });
  const response = await fetch(`https://en.wikipedia.org/w/api.php?${params.toString()}`);
  if (!response.ok) {
    return null;
  }
  const data = await response.json();
  const page: any = Object.values(data?.query?.pages || {})[0];
  if (!page || page.missing !== undefined || page.pageprops?.disambiguation !== undefined) {
    return null;
  }

  const coordinate = Array.isArray(page.coordinates) ? page.coordinates[0] : null;
  return {
    title: String(page.title || title),
    extract: String(page.extract || ""),
    imageUrl: page.thumbnail?.source ? String(page.thumbnail.source) : null,
    latitude: coordinate ? Number(coordinate.lat) : null,
    longitude: coordinate ? Number(coordinate.lon) : null,
  };
}

function capitalizeWord(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Resolves a name typed like "Khumbu Icefall Nepal" or "Scimitar Canyon
 * Canada" to a Wikipedia article. Tries the query as typed first (handles
 * exact titles like "Nahanni National Park Reserve"); if that misses, retries
 * with the last word dropped, since a trailing country/region name is common
 * shorthand for disambiguating an otherwise-generic feature name — whatever
 * word made the difference becomes the country guess.
 */
export async function fetchWikipediaSummary(query: string): Promise<WikipediaSummary | null> {
  const trimmed = query.trim();
  if (!trimmed) {
    return null;
  }
  const words = trimmed.split(/\s+/);
  // A trailing word that's a country we recognize is a strong signal on its
  // own — independent of whether dropping it turned out to be *necessary*
  // for the search to match. Without this, a query that resolves on the
  // first attempt (e.g. "Pucon Chile", once the redirect above is followed)
  // would silently lose the "Chile" the user explicitly typed.
  const lastWord = words.length > 1 ? words[words.length - 1] : null;
  const lastWordIsKnownCountry = lastWord ? Boolean(guessContinent(lastWord)) : false;

  try {
    let title = await openSearchTitle(trimmed);
    let strippedLastWordToMatch = false;

    if (!title && words.length > 1) {
      title = await openSearchTitle(words.slice(0, -1).join(" "));
      strippedLastWordToMatch = Boolean(title);
    }

    if (!title) {
      return null;
    }

    const details = await fetchPageDetails(title);
    if (!details) {
      return null;
    }

    const countryHint = lastWordIsKnownCountry || strippedLastWordToMatch
      ? capitalizeWord(lastWord as string)
      : guessCountryFromText(details.extract);

    return {
      title: details.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(details.title.replace(/ /g, "_"))}`,
      extract: details.extract,
      imageUrl: details.imageUrl,
      latitude: details.latitude,
      longitude: details.longitude,
      countryHint,
    };
  } catch (_error) {
    return null;
  }
}
