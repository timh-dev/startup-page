import { isSelfHostedUrl } from "@/features/bookmarks/components/Bookmark";

export function normalizeBookmarkUrl(url: string): string {
  const trimmed = (url || "").trim();
  const hasScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed);
  return hasScheme ? trimmed : `${isSelfHostedUrl(trimmed) ? "http" : "https"}://${trimmed}`;
}
