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

function isBlockedHostname(hostname: string): boolean {
  return BLOCKED_HOSTNAME_PATTERNS.some((pattern) => pattern.test(hostname));
}

function faviconUrlFor(url: URL): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url.hostname)}&sz=64`;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function extractTitle(html: string): string | null {
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

function extractDescription(html: string): string | null {
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
      return json({ title: null, description: null, faviconUrl: faviconUrlFor(target) });
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
    });
  } catch (err) {
    return errorResponse(err);
  }
}
