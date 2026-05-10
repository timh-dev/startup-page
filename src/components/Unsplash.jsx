import React, { Component } from "react";
import axios from "axios";
import FilteredImageShader from "./FilteredImageShader";
import { getEnabledImageFilterKeys } from "@/lib/image-filters";
import { readSettings } from '@/lib/settings';

const settings = readSettings();

// ---------------------------------------------------------------------------
// Two-level photo cache
//
// Level 1 — localStorage  (sync): search terms → last-fetched URL
// Level 2 — Cache API     (async): URL → image binary stored as a Response
//
// Load flow:
//   cached URL + cached image → blob URL shown instantly, background refresh
//   cached URL, image evicted → re-cache image, show it, background refresh
//   no cache                  → fetch URL + image, show, write both levels
//
// Background refresh updates both levels but never swaps the displayed image
// mid-session. The fresh photo appears on the next page load.
// ---------------------------------------------------------------------------

const PHOTO_CACHE_NAME = "startup-page-photos-v1";
const URL_STORE_KEY = "startup-page.photo-urls";

function buildCacheKey(searchTerms) {
  return [...searchTerms].sort().join(",");
}

function getUrlFromStore(searchTerms) {
  if (!searchTerms?.length) return null;
  try {
    const store = JSON.parse(localStorage.getItem(URL_STORE_KEY) || "{}");
    return store[buildCacheKey(searchTerms)]?.url ?? null;
  } catch {
    return null;
  }
}

function saveUrlToStore(searchTerms, url) {
  try {
    const store = JSON.parse(localStorage.getItem(URL_STORE_KEY) || "{}");
    store[buildCacheKey(searchTerms)] = { url, cachedAt: Date.now() };
    localStorage.setItem(URL_STORE_KEY, JSON.stringify(store));
  } catch {}
}

async function getCachedBlobUrl(imageUrl) {
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

async function fetchAndCacheImage(imageUrl) {
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

// ---------------------------------------------------------------------------

class Unsplash extends Component {
  constructor(props) {
    super(props);
    this._mounted = false;
    this._blobUrl = null;
    this.state = {
      photos: null,
      category: "",
      loaded: false,
      filterKey: null,
      imageReady: false,
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
  _show(url, category) {
    if (!this._mounted) return;
    this._revokeBlobUrl();
    if (url?.startsWith("blob:")) this._blobUrl = url;
    this.setState({
      photos: url,
      category,
      loaded: false,
      filterKey: this.pickFilterKey(),
      imageReady: false,
    });
  }

  async _loadPhoto() {
    const category = this.getRandomCategory();
    const searchTerms = this.props.search || [];
    const cachedUrl = getUrlFromStore(searchTerms);

    if (cachedUrl) {
      // Try to get the cached image binary first.
      let blobUrl = await getCachedBlobUrl(cachedUrl);

      if (!blobUrl) {
        // Image was evicted from Cache API — re-fetch and cache it.
        blobUrl = await fetchAndCacheImage(cachedUrl);
      }

      // Show immediately (blob URL if available, raw URL as fallback).
      this._show(blobUrl || cachedUrl, category);

      // Refresh in background for the next page load. Fire and forget.
      void this._refreshInBackground(category, searchTerms);
      return;
    }

    // No cache at all — fetch, cache, and display.
    await this._fetchDisplayAndCache(category, searchTerms, true);
  }

  async _refreshInBackground(category, searchTerms) {
    await this._fetchDisplayAndCache(category, searchTerms, false);
  }

  async _fetchDisplayAndCache(category, searchTerms, updateDisplay) {
    const accessKey = settings.unsplashCredential;

    if (!accessKey) {
      await this._fetchFallback(category, searchTerms, updateDisplay);
      return;
    }

    try {
      const res = await axios.get("https://api.unsplash.com/search/photos", {
        params: { query: category, per_page: 100 },
        headers: { Authorization: "Client-ID " + accessKey },
      });

      const results = res.data.results;
      if (!results?.length) {
        await this._fetchFallback(category, searchTerms, updateDisplay);
        return;
      }

      const url = results[Math.floor(Math.random() * results.length)].urls.regular;
      saveUrlToStore(searchTerms, url);
      const blobUrl = await fetchAndCacheImage(url);

      if (updateDisplay) {
        this._show(blobUrl || url, category);
      }
    } catch {
      await this._fetchFallback(category, searchTerms, updateDisplay);
    }
  }

  async _fetchFallback(category, searchTerms, updateDisplay) {
    const searchTerm = `${category} filetype:bitmap`;
    const fallbackImage = this.buildFallbackImageUrl(category);

    try {
      const response = await fetch(
        `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
          searchTerm
        )}&gsrnamespace=6&gsrlimit=20&prop=imageinfo&iiprop=url&iiurlwidth=1200&format=json&origin=*`
      );
      const data = await response.json();
      const pages = Object.values(data.query?.pages || {});
      const imageUrls = pages
        .map((page) => page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url)
        .filter(Boolean);

      const url = imageUrls.length
        ? imageUrls[Math.floor(Math.random() * imageUrls.length)]
        : fallbackImage;

      saveUrlToStore(searchTerms, url);
      const blobUrl = await fetchAndCacheImage(url);

      if (updateDisplay) {
        this._show(blobUrl || url, category);
      }
    } catch {
      saveUrlToStore(searchTerms, fallbackImage);
      if (updateDisplay) {
        this._show(fallbackImage, category);
      }
    }
  }

  getRandomCategory() {
    const categoryArray = this.props.search || [];
    if (categoryArray.length === 0) return "landscape";
    return categoryArray[Math.floor(Math.random() * categoryArray.length)];
  }

  buildFallbackImageUrl(category) {
    const curatedFallbacks = {
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

  pickFilterKey() {
    const enabledFilterKeys = getEnabledImageFilterKeys(settings.ui?.imageEffects);
    if (enabledFilterKeys.length === 0) return null;
    return enabledFilterKeys[Math.floor(Math.random() * enabledFilterKeys.length)];
  }

  render() {
    const filterSettings =
      settings.ui?.imageEffects?.filterSettings?.[this.state.filterKey] || null;
    const shouldUseShader = Boolean(this.state.filterKey && filterSettings && this.state.photos);

    return (
      <div className={this.props.cardClass || "relative rounded-xl overflow-hidden h-full bg-center bg-no-repeat border-0 dark:border-4 dark:border-off-white2"}>
        {!this.state.loaded && (
          <div className="absolute inset-0 flex items-end bg-[linear-gradient(160deg,color-mix(in_oklab,var(--color-accent)_55%,transparent),transparent_45%),linear-gradient(135deg,color-mix(in_oklab,var(--color-card)_96%,black_4%),color-mix(in_oklab,var(--color-secondary)_24%,var(--color-card)))] p-3">
            <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-foreground shadow-sm">
              {this.state.category || "Loading image"}
            </span>
          </div>
        )}
        <img
          className={shouldUseShader ? "hidden" : "min-w-full min-h-full object-cover"}
          src={this.state.photos || undefined}
          alt={`Theme tile for ${this.state.category || "landscape"}`}
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
      </div>
    );
  }
}

export default Unsplash;
