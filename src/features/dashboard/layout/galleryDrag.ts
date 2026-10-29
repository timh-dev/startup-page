import type { WidgetType } from "@/lib/dashboard-dimensions";

// The widget gallery lives in the side panel, the grid in the dashboard: the
// grid registers how to add a card (by drag or straight in), the gallery
// calls it.
interface GalleryTarget {
  drag: (type: WidgetType, event: PointerEvent) => void;
  add: (type: WidgetType) => void;
}

let target: GalleryTarget | null = null;

export function registerGalleryDrag(handler: GalleryTarget) {
  target = handler;
  return () => {
    if (target === handler) target = null;
  };
}

/** Starts dragging a new card (a click without moving adds it to the first free spot). */
export function startGalleryDrag(type: WidgetType, event: PointerEvent) {
  if (!target) return false;
  target.drag(type, event);
  return true;
}

/** Adds a card without dragging (keyboard). */
export function addFromGallery(type: WidgetType) {
  if (!target) return false;
  target.add(type);
  return true;
}
