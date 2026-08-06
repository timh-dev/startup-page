import { json, errorResponse, HttpError } from "./_lib/http.js";

// Most pages put <title>/og: meta tags in the first few KB, but some (e.g.
// YouTube stuffs ~680KB of inline script/JSON before </head> even closes)
// don't. We read until </head> shows up rather than a small fixed prefix,
// with this as an absolute safety cap against pathological/huge responses.
const MAX_HTML_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 6000;

// Casual SSRF guard: reject the obvious ways to point this at internal
// infrastructure (localhost, private/link-local ranges, cloud metadata
// endpoints). This is a hostname-string check, not DNS-rebinding-proof —
// proportionate for a personal link-preview convenience, not a hardened
// multi-tenant proxy.
const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^\[?::1\]?$/,
  /^169\.254\./, // link-local + cloud metadata (169.254.169.254)
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
];

export function isBlockedHostname(hostname: string): boolean {
  return BLOCKED_HOSTNAME_PATTERNS.some((pattern) => pattern.test(hostname));
}

export function faviconUrlFor(url: URL): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url.hostname)}&sz=64`;
}

const YOUTUBE_HOSTNAMES = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);

export function isYoutubeUrl(url: URL): boolean {
  return YOUTUBE_HOSTNAMES.has(url.hostname.toLowerCase());
}

// YouTube serves a generic "<video/channel name> - YouTube" title and its
// canned channel-description boilerplate in the static <head> to
// non-browser requests — the real per-video title/description only get
// rendered client-side (into ytInitialData) after JS runs, which this
// scraper never does. oEmbed is YouTube's own unauthenticated JSON endpoint
// for exactly this: given a watch/short URL it returns the real video
// title (no description field, so we surface the channel name instead of
// inventing one). Falls back to the generic scrape below (same as any
// other site) if the URL isn't a real video (e.g. a channel/home page) or
// oEmbed itself fails.
export async function fetchYoutubeOembed(
  target: URL,
): Promise<{ title: string | null; description: string | null } | null> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(target.toString())}&format=json`;
    const response = await fetch(oembedUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data?.title) return null;
    return {
      title: data.title,
      description: data.author_name ? `Video by ${data.author_name}` : null,
    };
  } catch {
    return null;
  }
}

// Best-effort mapping from a URL to one of the vault's fixed link tags
// (kept as plain string literals here, not imported from
// src/features/resourceVault/constants.ts — the api/ functions are a
// separate serverless bundle and don't share a build with src/). Hostname
// rules are checked first since they're cheap and reliable; og:type is a
// fallback for sites we don't special-case. Order matters: first match wins.
const TAG_HOSTNAME_RULES: Array<{ tag: string; test: (hostname: string, pathname: string) => boolean }> = [
  {
    tag: "Watch",
    test: (h) => YOUTUBE_HOSTNAMES.has(h) || /(^|\.)(vimeo\.com|twitch\.tv)$/.test(h),
  },
  {
    tag: "Listen",
    test: (h) =>
      /(^|\.)(open\.spotify\.com|spotify\.com|soundcloud\.com|podcasts\.apple\.com|music\.youtube\.com)$/.test(h),
  },
  {
    tag: "Build",
    test: (h) => /(^|\.)(github\.com|gitlab\.com|bitbucket\.org)$/.test(h),
  },
  {
    tag: "Learn",
    test: (h) => /(^|\.)(udemy\.com|coursera\.org|edx\.org|pluralsight\.com|khanacademy\.org|frontendmasters\.com)$/.test(h),
  },
  {
    tag: "Work",
    test: (h, p) =>
      /(^|\.)(indeed\.com|greenhouse\.io|lever\.co|ashbyhq\.com)$/.test(h) ||
      (/(^|\.)linkedin\.com$/.test(h) && p.startsWith("/jobs")),
  },
  {
    tag: "Follow",
    test: (h, p) =>
      /(^|\.)(twitter\.com|x\.com|instagram\.com|threads\.net)$/.test(h) ||
      (/(^|\.)linkedin\.com$/.test(h) && p.startsWith("/in/")),
  },
  {
    tag: "Travel",
    test: (h) => /(^|\.)(airbnb\.com|booking\.com|tripadvisor\.com|expedia\.com)$/.test(h),
  },
  {
    tag: "Join",
    test: (h) => /(^|\.)(eventbrite\.com|meetup\.com|lu\.ma)$/.test(h),
  },
  {
    tag: "Reference",
    test: (h) => h.startsWith("docs.") || /(^|\.)(devdocs\.io|developer\.mozilla\.org)$/.test(h),
  },
];

export function suggestTag(target: URL, ogType?: string | null): string | null {
  const hostname = target.hostname.toLowerCase();
  const pathname = target.pathname.toLowerCase();

  for (const rule of TAG_HOSTNAME_RULES) {
    if (rule.test(hostname, pathname)) {
      return rule.tag;
    }
  }

  if (ogType) {
    const type = ogType.toLowerCase();
    if (type.startsWith("video")) return "Watch";
    if (type.startsWith("music") || type.startsWith("audio")) return "Listen";
    if (type === "profile") return "Follow";
    if (type === "article" || type === "blog") return "Read";
  }

  return null;
}

export function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export function extractTitle(html: string): string | null {
  const ogMatch =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  if (ogMatch) {
    return decodeEntities(ogMatch[1].trim());
  }

  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (titleMatch) {
    const title = decodeEntities(titleMatch[1].trim());
    return title || null;
  }

  return null;
}

export function extractDescription(html: string): string | null {
  const ogMatch =
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
  if (ogMatch) {
    return decodeEntities(ogMatch[1].trim());
  }

  const nameMatch =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  if (nameMatch) {
    const description = decodeEntities(nameMatch[1].trim());
    return description || null;
  }

  return null;
}

export function extractOgType(html: string): string | null {
  const match =
    html.match(/<meta[^>]+property=["']og:type["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:type["']/i);
  return match ? decodeEntities(match[1].trim()) : null;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const rawUrl = new URL(request.url).searchParams.get("url");
    if (!rawUrl) {
      throw new HttpError(422, "Missing url parameter");
    }

    let target: URL;
    try {
      target = new URL(rawUrl);
    } catch {
      throw new HttpError(422, "Invalid url parameter");
    }

    if (target.protocol !== "http:" && target.protocol !== "https:") {
      throw new HttpError(422, "Only http/https URLs are supported");
    }
    if (isBlockedHostname(target.hostname)) {
      throw new HttpError(422, "That host can't be previewed");
    }

    if (isYoutubeUrl(target)) {
      const oembed = await fetchYoutubeOembed(target);
      if (oembed) {
        return json({
          title: oembed.title,
          description: oembed.description,
          faviconUrl: faviconUrlFor(target),
          tag: suggestTag(target),
        });
      }
      // Not a real video (channel/home page) or oEmbed itself failed — fall
      // through to the generic scrape below, same as any other site.
    }

    const response = await fetch(target.toString(), {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; StartupPageLinkPreview/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new HttpError(502, `Upstream responded with ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("html")) {
      return json({ title: null, description: null, faviconUrl: faviconUrlFor(target), tag: suggestTag(target) });
    }

    // Stop as soon as </head> shows up — nothing we look for lives past it —
    // falling back to MAX_HTML_BYTES only for pages that never close <head>
    // within a sane amount of HTML.
    let html = "";
    const reader = response.body?.getReader();
    if (reader) {
      const decoder = new TextDecoder();
      let bytesRead = 0;
      while (bytesRead < MAX_HTML_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        bytesRead += value.byteLength;
        html += decoder.decode(value, { stream: true });
        if (/<\/head>/i.test(html)) break;
      }
      reader.cancel().catch(() => {});
    } else {
      html = await response.text();
    }

    return json({
      title: extractTitle(html),
      description: extractDescription(html),
      faviconUrl: faviconUrlFor(target),
      tag: suggestTag(target, extractOgType(html)),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
