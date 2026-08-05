import { CONTINENTS } from "./constants";
import type { LocationItem } from "./types";

const EARTH_URL_COORD_PATTERN = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),/;

/**
 * Google Earth Web share links encode the camera position as
 * `@lat,lng,altitude a,distance d,yaw y,heading h,tilt t,roll r` — pulling
 * the first two numbers after `@` is enough, the rest is camera framing we
 * don't need.
 */
export function parseGoogleEarthUrl(url: string): { latitude: number; longitude: number } | null {
  const match = String(url || "").match(EARTH_URL_COORD_PATTERN);
  if (!match) {
    return null;
  }

  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return null;
  }

  return { latitude, longitude };
}

/**
 * A reasonable default camera framing (35° yaw, straight-down tilt, no
 * altitude/heading/roll offset) — mirrors the shape of a real Google Earth
 * Web share link so a place found only via Wikipedia's coordinates still
 * gets a working "Open in Google Earth" link without the user ever visiting
 * Earth themselves.
 */
export function buildGoogleEarthUrl(latitude: number, longitude: number): string {
  return `https://earth.google.com/web/@${latitude},${longitude},0a,20000d,35y,0h,0t,0r`;
}

export function generateLocationId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function parseTagsInput(value: string): string[] {
  return Array.from(
    new Set(
      String(value || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

export function normalizeLocations(value: unknown): LocationItem[] {
  const sourceItems: unknown[] = Array.isArray(value)
    ? value
    : Array.isArray((value as any)?.locations)
      ? (value as any).locations
      : [];

  return sourceItems
    .map((item: any, index): LocationItem | null => {
      const name = String(item?.name || "").trim();
      if (!name) {
        return null;
      }

      const createdAt = item?.createdAt && !Number.isNaN(new Date(item.createdAt).getTime())
        ? new Date(item.createdAt).toISOString()
        : new Date().toISOString();
      const updatedAt = item?.updatedAt && !Number.isNaN(new Date(item.updatedAt).getTime())
        ? new Date(item.updatedAt).toISOString()
        : createdAt;

      const latitude = Number(item?.latitude);
      const longitude = Number(item?.longitude);

      return {
        id: String(item?.id || `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`),
        name,
        description: String(item?.description || "").trim(),
        latitude: Number.isFinite(latitude) ? latitude : null,
        longitude: Number.isFinite(longitude) ? longitude : null,
        googleEarthUrl: String(item?.googleEarthUrl || "").trim(),
        park: String(item?.park || "").trim(),
        country: String(item?.country || "").trim(),
        continent: CONTINENTS.includes(item?.continent) ? item.continent : "",
        tags: Array.isArray(item?.tags) ? item.tags.map((tag: unknown) => String(tag).trim()).filter(Boolean) : [],
        wikiTitle: String(item?.wikiTitle || "").trim(),
        wikiUrl: String(item?.wikiUrl || "").trim(),
        wikiExtract: String(item?.wikiExtract || "").trim(),
        wikiImageUrl: String(item?.wikiImageUrl || "").trim(),
        imageUrl: String(item?.imageUrl || "").trim(),
        createdAt,
        updatedAt,
      };
    })
    .filter((item): item is LocationItem => Boolean(item));
}

/** Free/unlimited Maps Embed API "view" mode — the closest embeddable stand-in for Google Earth's default satellite imagery (earth.google.com itself blocks iframe embedding). */
export function googleMapsSatelliteEmbedUrl(
  apiKey: string,
  latitude: number,
  longitude: number,
  zoom = 15,
): string {
  const params = new URLSearchParams({
    key: apiKey,
    center: `${latitude},${longitude}`,
    zoom: String(zoom),
    maptype: "satellite",
  });
  return `https://www.google.com/maps/embed/v1/view?${params.toString()}`;
}
