import React, { Component } from "react";
import FilteredImageShader from "./FilteredImageShader";
import { getEnabledImageFilterKeys } from "@/lib/image-filters";
import { useSettingsStore } from "@/features/settings/stores";
import { useCredentialsStore } from "@/lib/credentials";

// ---------------------------------------------------------------------------
// Two-level photo cache
//
// Level 1 — localStorage  (sync): search terms → last-fetched photo (URL,
//                                  placeholder colour, credit)
// Level 2 — Cache API     (async): URL → image binary stored as a Response
//
// Load flow:
//   cached photo + cached image → blob URL shown instantly, background refresh
//   cached photo, image evicted → re-cache image, show it, background refresh
//   no cache                    → fetch photo + image, show, write both levels
//
// Background refresh updates both levels but never swaps the displayed image
// mid-session. The fresh photo appears on the next page load.
//
// Photos are requested at the tile's size times the screen's pixel density
// (capped at 3×), so they stay sharp on high-density screens without
// downloading more than the tile can show.
// ---------------------------------------------------------------------------

const PHOTO_CACHE_NAME = "startup-page-photos-v1";
const URL_STORE_KEY = "startup-page.photo-urls";
const PHOTO_TTL_MS = 60 * 60 * 1000; // 1 hour
const UNSPLASH_UTM = "utm_source=startup_page&utm_medium=referral";

interface PhotoCredit {
  name: string;
  url: string;
  source: "Unsplash" | "Wikimedia Commons";
}

interface StoredPhoto {
  url: string;
  cachedAt: number;
  color?: string | null;
  credit?: PhotoCredit | null;
}

function buildCacheKey(searchTerms: string[]) {
  return [...searchTerms].sort().join(",");
}

function readStore(): Record<string, StoredPhoto> {
  try {
    return JSON.parse(localStorage.getItem(URL_STORE_KEY) || "{}");
  } catch {
    return {};
  }
}

function getPhotoFromStore(searchTerms: string[]): StoredPhoto | null {
  if (!searchTerms?.length) return null;
  return readStore()[buildCacheKey(searchTerms)] ?? null;
}

function isCacheStale(photo: StoredPhoto | null) {
  return !photo?.cachedAt || Date.now() - photo.cachedAt > PHOTO_TTL_MS;
}

function savePhotoToStore(searchTerms: string[], photo: Omit<StoredPhoto, "cachedAt">) {
  if (!searchTerms?.length) return;
  try {
    const store = readStore();
    store[buildCacheKey(searchTerms)] = { ...photo, cachedAt: Date.now() };
    localStorage.setItem(URL_STORE_KEY, JSON.stringify(store));
  } catch {}
}

async function getCachedBlobUrl(imageUrl: string): Promise<string | null> {
  if (!("caches" in window)) return null;
  try {
    const cache = await caches.open(PHOTO_CACHE_NAME);
    const response = await cache.match(imageUrl);
    if (!response) return null;
    return URL.createObjectURL(await response.blob());
  } catch {
    return null;
  }
}

async function fetchAndCacheImage(imageUrl: string): Promise<string | null> {
  if (!("caches" in window)) return null;
  try {
    const response = await fetch(imageUrl, { mode: "cors" });
    if (!response.ok) return null;
    const cache = await caches.open(PHOTO_CACHE_NAME);
    await cache.put(imageUrl, response.clone());
    return URL.createObjectURL(await response.blob());
  } catch {
    return null;
  }
}

// Drops this tile's cached photo (localStorage) and cached image bytes (Cache
// API) so its next mount fetches a fresh photo instead of reusing the old
// one. Scoped to these exact search terms — clearing one photo tile's cache
// doesn't touch any other tile's.
export async function clearPhotoCache(searchTerms: string[]) {
  if (!searchTerms?.length) return;
  const key = buildCacheKey(searchTerms);
  let cachedUrl: string | null = null;

  try {
    const store = readStore();
    cachedUrl = store[key]?.url ?? null;
    delete store[key];
    localStorage.setItem(URL_STORE_KEY, JSON.stringify(store));
  } catch {}

  if (cachedUrl && "caches" in window) {
    try {
      const cache = await caches.open(PHOTO_CACHE_NAME);
      await cache.delete(cachedUrl);
    } catch {}
  }
}

/** Pixel size to request: the tile's CSS size × density, rounded up to a 200px step so near-identical tiles share cache entries. */
function targetSize(element: HTMLElement | null): { width: number; height: number } {
  const rect = element?.getBoundingClientRect();
  const density = Math.min(window.devicePixelRatio || 1, 3);
  const step = (value: number) => Math.max(400, Math.ceil((value * density) / 200) * 200);
  return { width: step(rect?.width || 400), height: step(rect?.height || 400) };
}

// ---------------------------------------------------------------------------

interface UnsplashProps {
  search?: string[];
  cardClass?: string;
}

interface UnsplashState {
  photos: string | null;
  category: string;
  loaded: boolean;
  filterKey: string | null;
  imageReady: boolean;
  color: string | null;
  credit: PhotoCredit | null;
}

interface UnsplashResult {
  urls: { raw: string; regular: string };
  color?: string | null;
  user?: { name?: string; links?: { html?: string } };
}

interface WikimediaPage {
  title?: string;
  imageinfo?: Array<{ thumburl?: string; url?: string; descriptionurl?: string }>;
}

class Unsplash extends Component<UnsplashProps, UnsplashState> {
  _mounted = false;
  _blobUrl: string | null = null;
  _rootRef = React.createRef<HTMLDivElement>();

  constructor(props: UnsplashProps) {
    super(props);
    this.state = {
      photos: null,
      category: "",
      loaded: false,
      filterKey: null,
      imageReady: false,
      color: null,
      credit: null,
    };
  }

  componentDidMount() {
    this._mounted = true;
    void this._loadPhoto();
  }

  componentWillUnmount() {
    this._mounted = false;
    this._revokeBlobUrl();
  }

  _revokeBlobUrl() {
    if (this._blobUrl) {
      URL.revokeObjectURL(this._blobUrl);
      this._blobUrl = null;
    }
  }

  // Show a photo URL (may be a blob: URL or a plain https: URL as fallback).
  // Tracks and revokes any previous blob URL to avoid memory leaks.
  _show(url: string, category: string, details: Pick<StoredPhoto, "color" | "credit"> = {}) {
    if (!this._mounted) return;
    this._revokeBlobUrl();
    if (url?.startsWith("blob:")) this._blobUrl = url;
    this.setState({
      photos: url,
      category,
      loaded: false,
      filterKey: this.pickFilterKey(),
      imageReady: false,
      color: details.color ?? null,
      credit: details.credit ?? null,
    });
  }

  async _loadPhoto() {
    const category = this.getRandomCategory();
    const searchTerms = this.props.search || [];
    const cached = getPhotoFromStore(searchTerms);

    if (cached) {
      const blobUrl = await getCachedBlobUrl(cached.url);

      // Show immediately — use raw URL if blob was evicted from Cache API.
      this._show(blobUrl || cached.url, category, cached);

      if (!blobUrl) {
        // Re-cache the image in background so next load gets a blob URL.
        void fetchAndCacheImage(cached.url);
      }

      // Only do a network refresh if the photo is older than 1 hour.
      if (isCacheStale(cached)) {
        void this._fetchDisplayAndCache(category, searchTerms, false);
      }
      return;
    }

    // No cache at all — fetch, cache, and display.
    await this._fetchDisplayAndCache(category, searchTerms, true);
  }

  async _useFoundPhoto(photo: Omit<StoredPhoto, "cachedAt">, category: string, searchTerms: string[], updateDisplay: boolean) {
    savePhotoToStore(searchTerms, photo);
    const blobUrl = await fetchAndCacheImage(photo.url);
    if (updateDisplay) {
      this._show(blobUrl || photo.url, category, photo);
    }
  }

  async _fetchDisplayAndCache(category: string, searchTerms: string[], updateDisplay: boolean) {
    // Read at call time so a key entered in a photo widget applies without a reload.
    const accessKey = (useCredentialsStore.getState().unsplash || "").trim();

    if (!accessKey) {
      await this._fetchFallback(category, searchTerms, updateDisplay);
      return;
    }

    try {
      const params = new URLSearchParams({ query: category, per_page: "30", orientation: this.orientation(), content_filter: "high" });
      const res = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
        headers: { Authorization: "Client-ID " + accessKey },
      });
      if (!res.ok) throw new Error(`Unsplash responded with ${res.status}`);

      const results: UnsplashResult[] = (await res.json()).results;
      if (!results?.length) {
        await this._fetchFallback(category, searchTerms, updateDisplay);
        return;
      }

      const result = results[Math.floor(Math.random() * results.length)];
      const { width, height } = targetSize(this._rootRef.current);
      // Unsplash's image CDN resizes and crops on request; WebP keeps the
      // larger, sharper image small.
      const url = `${result.urls.raw}&w=${width}&h=${height}&fit=crop&crop=entropy&fm=webp&q=82`;
      const credit: PhotoCredit | null = result.user?.name
        ? { name: result.user.name, url: `${result.user.links?.html ?? "https://unsplash.com"}?${UNSPLASH_UTM}`, source: "Unsplash" }
        : null;
      await this._useFoundPhoto({ url, color: result.color ?? null, credit }, category, searchTerms, updateDisplay);
    } catch {
      await this._fetchFallback(category, searchTerms, updateDisplay);
    }
  }

  orientation(): "portrait" | "landscape" | "squarish" {
    const rect = this._rootRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return "squarish";
    const ratio = rect.width / rect.height;
    return ratio > 1.3 ? "landscape" : ratio < 0.77 ? "portrait" : "squarish";
  }

  // Without an Unsplash key: Wikimedia Commons' best-rated photography.
  // Topical Featured Pictures first (landscapes, mountains, lakes, cities —
  // the general Featured set also holds historical photos and engravings),
  // then Quality Images, then all Featured Pictures, then a curated set. A
  // plain file search turned up snapshots of road signs and hangars.
  async _fetchFallback(category: string, searchTerms: string[], updateDisplay: boolean) {
    const { width } = targetSize(this._rootRef.current);
    const sources = [
      "Featured_pictures_of_landscapes|Featured_pictures_of_mountains|Featured_pictures_of_lakes|Featured_pictures_of_cityscapes",
      "Quality_images",
      "Featured_pictures_on_Wikimedia_Commons",
    ];

    for (const commonsCategory of sources) {
      try {
        const query = `${category} filetype:bitmap incategory:${commonsCategory}`;
        const response = await fetch(
          `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}` +
            `&gsrnamespace=6&gsrlimit=30&prop=imageinfo&iiprop=url&iiurlwidth=${width}&format=json&origin=*`,
        );
        const data = await response.json();
        const pages = (Object.values(data.query?.pages || {}) as WikimediaPage[]).filter(
          (page) => page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url,
        );
        if (!pages.length) continue;

        const page = pages[Math.floor(Math.random() * pages.length)];
        const info = page.imageinfo![0];
        const credit: PhotoCredit = { name: "Wikimedia Commons", url: info.descriptionurl || "https://commons.wikimedia.org", source: "Wikimedia Commons" };
        await this._useFoundPhoto({ url: (info.thumburl || info.url)!, color: null, credit }, category, searchTerms, updateDisplay);
        return;
      } catch {
        // Try the next source.
      }
    }

    const fallbackImage = this.buildFallbackImageUrl(category);
    savePhotoToStore(searchTerms, { url: fallbackImage });
    if (updateDisplay) {
      this._show(fallbackImage, category);
    }
  }

  getRandomCategory(): string {
    const categoryArray = this.props.search || [];
    if (categoryArray.length === 0) return "landscape";
    return categoryArray[Math.floor(Math.random() * categoryArray.length)];
  }

  buildFallbackImageUrl(category: string): string {
    const curatedFallbacks: Record<string, string> = {
      mountains: "https://upload.wikimedia.org/wikipedia/commons/4/4f/Matterhorn_from_Domhütte_-_2.jpg",
      city: "https://upload.wikimedia.org/wikipedia/commons/0/06/Lower_Manhattan_skyline_-_June_2017.jpg",
      bridge: "https://upload.wikimedia.org/wikipedia/commons/0/0c/GoldenGateBridge-001.jpg",
      ocean: "https://upload.wikimedia.org/wikipedia/commons/0/00/Atlantic_near_Faroe_Islands.jpg",
      lake: "https://upload.wikimedia.org/wikipedia/commons/b/bd/Lake_McDonald_in_Glacier_National_Park.jpg",
      architecture: "https://upload.wikimedia.org/wikipedia/commons/a/a6/Paris_Night.jpg",
      aircraft: "https://upload.wikimedia.org/wikipedia/commons/5/56/F-35_Lightning_II.jpg",
      default: "https://upload.wikimedia.org/wikipedia/commons/4/4f/Matterhorn_from_Domhütte_-_2.jpg",
    };

    const normalizedCategory = category.toLowerCase();
    const match = Object.keys(curatedFallbacks).find((key) => normalizedCategory.includes(key));
    return curatedFallbacks[match || "default"];
  }

  pickFilterKey(): string | null {
    const enabledFilterKeys = getEnabledImageFilterKeys(useSettingsStore.getState().settings.ui?.imageEffects);
    if (enabledFilterKeys.length === 0) return null;
    return enabledFilterKeys[Math.floor(Math.random() * enabledFilterKeys.length)];
  }

  render() {
    const settings = useSettingsStore.getState().settings;
    const filterSettings =
      (this.state.filterKey && settings.ui?.imageEffects?.filterSettings?.[this.state.filterKey]) || null;
    const shouldUseShader = Boolean(this.state.filterKey && filterSettings && this.state.photos);
    const { credit, color } = this.state;

    return (
      <div
        ref={this._rootRef}
        className={`group/photo ${this.props.cardClass || "relative h-full overflow-hidden rounded-xl"}`}
        // The photo's own dominant colour (from Unsplash) while it loads.
        style={color ? { backgroundColor: color } : undefined}
      >
        {!this.state.loaded && !color && <div className="skeleton absolute inset-0" aria-hidden="true" />}
        <img
          className={shouldUseShader ? "hidden" : "fade-in-image absolute inset-0 h-full w-full object-cover"}
          data-loaded={this.state.loaded}
          src={this.state.photos || undefined}
          alt={`Photo of ${this.state.category || "a landscape"}`}
          decoding="async"
          onLoad={() => this.setState({ loaded: true, imageReady: true })}
          onError={() => {
            const { photos, category } = this.state;
            if (photos && !photos.startsWith("blob:") && !photos.includes("upload.wikimedia.org")) {
              void this._fetchFallback(category || this.getRandomCategory(), this.props.search || [], true);
              return;
            }
            this.setState({ loaded: false, imageReady: false });
          }}
        />
        {shouldUseShader && this.state.imageReady ? (
          <FilteredImageShader
            image={this.state.photos}
            filterKey={this.state.filterKey}
            filterSettings={filterSettings}
            className="pointer-events-none absolute inset-0 z-10 h-full w-full"
          />
        ) : null}
        {credit && this.state.loaded && (
          <a
            href={credit.url}
            target="_blank"
            rel="noreferrer"
            className="photo-credit"
            title={`${credit.name} on ${credit.source}`}
          >
            {credit.source === "Unsplash" ? `${credit.name} · Unsplash` : credit.source}
          </a>
        )}
      </div>
    );
  }
}

export default Unsplash;
