// Client-side RSS/Atom -> JSON.
//
// The startup page is a static site (GitHub Pages) with no backend of its own,
// and feed endpoints don't send CORS headers, so the browser can't fetch them
// directly. Instead of relying on a hosted JSON conversion service (rss2json,
// which now rate-limits and gates parameters behind an API key), we fetch the
// raw feed XML through a CORS-forwarding proxy and parse it in the browser with
// the native DOMParser (already used elsewhere in this app, so no new
// dependency). RSS 2.0, RSS 1.0 (RDF) and Atom are normalized to one shape:
//
//   { feed:  { title, link, description, image },
//     items: [{ title, link, guid, author, pubDate, content, thumbnail,
//                enclosure: { thumbnail } }] }
//
// pubDate is always an ISO-8601 string (or "" when absent) so callers can pass
// it straight to `new Date(...)`.

// CORS-forwarding proxies, tried in order until one returns a parseable feed.
// Public proxies come and go and occasionally rate-limit, so we keep a few.
const PROXY_BUILDERS = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
];

export interface RssItem {
  title: string;
  link: string;
  guid: string;
  author: string;
  pubDate: string;
  content: string;
  thumbnail: string;
  enclosure: { thumbnail: string };
}

export interface RssFeed {
  feed: { title: string; link: string; description: string; image: string };
  items: RssItem[];
}

const FEED_ROOTS = new Set(["rss", "feed", "rdf"]);
const IMAGE_URL_PATTERN = /\.(jpe?g|png|gif|webp|avif)(\?|#|$)/i;
const CONTENT_IMG_PATTERN = /<img[^>]+src="([^"]+)"/i;

function directChildren(parent: Element | null, localName: string): Element[] {
  if (!parent) return [];
  return Array.from(parent.children).filter((child) => child.localName === localName);
}

function firstChild(parent: Element | null, localName: string): Element | null {
  return directChildren(parent, localName)[0] || null;
}

function childText(parent: Element | null, localName: string): string {
  const element = firstChild(parent, localName);
  return element ? element.textContent.trim() : "";
}

function decodeEntities(value: string): string {
  if (typeof value !== "string") return value;
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'");
}

function toIsoDate(value: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

// Atom links live in the `href` attribute; prefer the human-facing alternate.
function atomLink(parent: Element): string {
  const links = directChildren(parent, "link");
  const chosen =
    links.find((link) => link.getAttribute("rel") === "alternate") ||
    links.find((link) => !link.getAttribute("rel")) ||
    links[0];
  return chosen ? chosen.getAttribute("href") || "" : "";
}

function getAuthor(entry: Element, isAtom: boolean): string {
  if (isAtom) {
    const author = firstChild(entry, "author");
    return author ? childText(author, "name") : "";
  }
  return childText(entry, "creator") || childText(entry, "author");
}

function getFeedImage(channel: Element, isAtom: boolean): string {
  if (isAtom) {
    return childText(channel, "icon") || childText(channel, "logo");
  }
  // RSS 2.0 uses <image><url>; itunes:image / <image href> use an attribute.
  for (const image of directChildren(channel, "image")) {
    const url = childText(image, "url") || image.getAttribute("href") || image.getAttribute("url");
    if (url) return url;
  }
  const mediaThumb = firstChild(channel, "thumbnail");
  return mediaThumb ? mediaThumb.getAttribute("url") || "" : "";
}

// Pull an image URL from the common feed conventions, falling back to the first
// <img> embedded in the item's HTML content (how Reddit surfaces thumbnails).
function getItemImage(entry: Element, contentHtml: string): string {
  const mediaThumb = firstChild(entry, "thumbnail");
  if (mediaThumb && mediaThumb.getAttribute("url")) {
    return decodeEntities(mediaThumb.getAttribute("url"));
  }

  // media:content carries a `url` attribute (Atom's own <content> never does).
  const mediaContent = directChildren(entry, "content").find((element) => {
    const url = element.getAttribute("url");
    if (!url) return false;
    const medium = element.getAttribute("medium");
    const type = element.getAttribute("type") || "";
    return medium === "image" || type.startsWith("image") || IMAGE_URL_PATTERN.test(url);
  });
  if (mediaContent) return decodeEntities(mediaContent.getAttribute("url"));

  const group = firstChild(entry, "group");
  if (group) {
    const grouped = directChildren(group, "content").find((element) => element.getAttribute("url"));
    if (grouped) return decodeEntities(grouped.getAttribute("url"));
  }

  const enclosure = directChildren(entry, "enclosure").find((element) => {
    const type = element.getAttribute("type") || "";
    const url = element.getAttribute("url") || "";
    return type.startsWith("image") || IMAGE_URL_PATTERN.test(url);
  });
  if (enclosure && enclosure.getAttribute("url")) {
    return decodeEntities(enclosure.getAttribute("url"));
  }

  const match = typeof contentHtml === "string" ? contentHtml.match(CONTENT_IMG_PATTERN) : null;
  if (match && match[1].startsWith("http")) return decodeEntities(match[1]);

  return "";
}

function parseItem(entry: Element, isAtom: boolean): RssItem {
  const content =
    childText(entry, "encoded") || // content:encoded
    (isAtom ? childText(entry, "content") : "") ||
    childText(entry, "description") ||
    childText(entry, "summary");

  const link = isAtom ? atomLink(entry) : childText(entry, "link");
  const pubDate = toIsoDate(
    childText(entry, "pubDate") ||
      childText(entry, "published") ||
      childText(entry, "updated") ||
      childText(entry, "date")
  );
  const thumbnail = getItemImage(entry, content);

  return {
    title: decodeEntities(childText(entry, "title")),
    link,
    guid: childText(entry, isAtom ? "id" : "guid") || link,
    author: getAuthor(entry, isAtom),
    pubDate,
    content,
    thumbnail,
    // Kept for callers that read the rss2json-style enclosure shape.
    enclosure: { thumbnail },
  };
}

function parseFeedDocument(doc: Document, limit?: number): RssFeed {
  const root = doc.documentElement;
  const rootName = (root.localName || root.nodeName || "").toLowerCase();
  const isAtom = rootName === "feed";

  let channel: Element;
  let entryElements: Element[];
  if (isAtom) {
    channel = root;
    entryElements = directChildren(root, "entry");
  } else {
    // RSS 2.0 (<rss><channel>) and RSS 1.0 (<rdf:RDF> with sibling <item>s).
    channel = firstChild(root, "channel") || root;
    entryElements = directChildren(channel, "item");
    if (entryElements.length === 0) {
      entryElements = directChildren(root, "item");
    }
  }

  const feed = {
    title: decodeEntities(childText(channel, "title")),
    link: isAtom ? atomLink(channel) : childText(channel, "link"),
    description: decodeEntities(childText(channel, "description") || childText(channel, "subtitle")),
    image: getFeedImage(channel, isAtom),
  };

  const items = entryElements.map((entry) => parseItem(entry, isAtom));
  const limited = typeof limit === "number" && limit > 0 ? items.slice(0, limit) : items;

  return { feed, items: limited };
}

async function fetchFeedDocument(url: string): Promise<Document> {
  let lastError: unknown = null;

  for (const buildProxyUrl of PROXY_BUILDERS) {
    try {
      const response = await fetch(buildProxyUrl(url), {
        headers: {
          Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
        },
      });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);

      const text = await response.text();
      const doc = new DOMParser().parseFromString(text, "text/xml");
      if (doc.getElementsByTagName("parsererror").length > 0) {
        throw new Error("Feed is not valid XML");
      }

      const rootName = (doc.documentElement.localName || doc.documentElement.nodeName || "").toLowerCase();
      if (!FEED_ROOTS.has(rootName)) throw new Error("Response is not an RSS/Atom feed");

      return doc;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Unable to load feed");
}

// Fetch and parse a feed. `limit` optionally caps the number of items returned.
export async function fetchRssFeed(url: string, { limit }: { limit?: number } = {}): Promise<RssFeed> {
  if (!url) throw new Error("No feed URL provided");
  const doc = await fetchFeedDocument(url);
  return parseFeedDocument(doc, limit);
}
