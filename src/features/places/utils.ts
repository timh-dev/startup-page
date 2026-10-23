import { PLACE_TAGS } from "./constants";
import type { Place } from "./types";

function isValidLat(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLng(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

export function normalizePlaces(value: unknown): Place[] {
  const sourceItems: unknown[] = Array.isArray(value)
    ? value
    : Array.isArray((value as any)?.places)
      ? (value as any).places
      : Array.isArray((value as any)?.items)
        ? (value as any).items
        : [];

  return sourceItems
    .map((item: any, index): Place | null => {
      const name = String(item?.name || "").trim();
      const lat = Number(item?.lat);
      const lng = Number(item?.lng);

      if (!name || !isValidLat(lat) || !isValidLng(lng)) {
        return null;
      }

      const createdAt = item?.createdAt && !Number.isNaN(new Date(item.createdAt).getTime())
        ? new Date(item.createdAt).toISOString()
        : new Date().toISOString();
      const updatedAt = item?.updatedAt && !Number.isNaN(new Date(item.updatedAt).getTime())
        ? new Date(item.updatedAt).toISOString()
        : createdAt;

      return {
        id: String(item?.id || `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`),
        name,
        tag: PLACE_TAGS.includes(item?.tag) ? item.tag : "Other",
        notes: String(item?.notes || "").trim(),
        address: String(item?.address || "").trim(),
        lat,
        lng,
        source: item?.source === "manual" ? "manual" : "search",
        osmId: item?.osmId ? String(item.osmId) : null,
        createdAt,
        updatedAt,
      };
    })
    .filter((item): item is Place => Boolean(item));
}
