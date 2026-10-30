// A link's title, description, suggested tag and share image, through the
// /api/link-preview endpoint. Signed-in users only (the endpoint isn't an
// open proxy); null when signed out, on a static deployment with no /api,
// or on any failure. Auto-fill is a convenience: the user can always type.
import { getAuthToken } from "@/lib/authToken";
import { DEFAULT_READ_TAGS } from "./constants";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export interface LinkPreview {
  title: string | null;
  description: string | null;
  tag: string | null;
  image: string | null;
}

export async function fetchLinkPreview(url: string): Promise<LinkPreview | null> {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  const token = await getAuthToken();
  if (!token) return null;
  try {
    const response = await fetch(`${API_URL}/api/link-preview?url=${encodeURIComponent(trimmed)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return {
      title: typeof data.title === "string" ? data.title : null,
      description: typeof data.description === "string" ? data.description : null,
      tag: (DEFAULT_READ_TAGS as readonly string[]).includes(data.tag) ? data.tag : null,
      image: safeImageUrl(data.image),
    };
  } catch {
    return null;
  }
}

/** An http(s) image URL, or null. */
export function safeImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Does this text look like a link (rather than a title)? */
export function looksLikeUrl(text: string): boolean {
  const value = text.trim();
  return !/\s/.test(value) && (/^https?:\/\//i.test(value) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(value));
}

/** A full URL from what was typed or pasted ("example.com/a" → "https://example.com/a"). */
export function normalizeUrl(text: string): string {
  const value = text.trim();
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

/** A readable stand-in title from a URL, until the real one arrives: "example.com · Some Post". */
export function titleFromUrl(url: string): string {
  try {
    const { hostname, pathname } = new URL(normalizeUrl(url));
    const host = hostname.replace(/^www\./, "");
    const slug = decodeURIComponent(pathname.split("/").filter(Boolean).pop() ?? "")
      .replace(/\.[a-z0-9]{2,5}$/i, "")
      .replace(/[-_+]+/g, " ")
      .trim();
    if (!slug || /^\d+$/.test(slug)) return host;
    return `${slug.charAt(0).toUpperCase()}${slug.slice(1)} · ${host}`;
  } catch {
    return url;
  }
}
