import React from "react";
import { HiMagnifyingGlass, HiOutlineSquaresPlus } from "react-icons/hi2";

import { PanelFrame } from "@/components/layout/SidePanel";
import { WIDGET_TYPES } from "@/features/dashboard/widgetRegistry";
import { WIDGET_CATALOG, WIDGET_CATEGORIES } from "@/features/dashboard/widgetCatalog";
import { addFromGallery, startGalleryDrag } from "@/features/dashboard/layout/galleryDrag";
import { SIZE_CELLS } from "@/features/dashboard/layout/grid";
import { useLayoutEditStore } from "@/features/dashboard/stores/layoutEditStore";

/**
 * Every widget, grouped and searchable. Drag one onto the dashboard to place
 * it, or click to add it (to the empty cell you clicked, else the first
 * free spot).
 */
export default function WidgetGallery() {
  const [query, setQuery] = React.useState("");
  const insertAt = useLayoutEditStore((state) => state.insertAt);
  const needle = query.trim().toLowerCase();
  const matches = WIDGET_TYPES.filter((def) => {
    if (!needle) return true;
    const meta = WIDGET_CATALOG[def.type];
    return `${def.label} ${meta.description} ${meta.category}`.toLowerCase().includes(needle);
  });

  return (
    <PanelFrame
      title="Add a widget"
      subtitle={insertAt ? "Click one to add it to the cell you picked, or drag it anywhere." : "Drag one onto the dashboard, or click to add it."}
      icon={<HiOutlineSquaresPlus className="size-4" />}
    >
      <label className="gallery-search">
        <HiMagnifyingGlass className="size-4" aria-hidden="true" />
        <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search widgets" aria-label="Search widgets" />
      </label>

      {WIDGET_CATEGORIES.map((category) => {
        const items = matches.filter((def) => WIDGET_CATALOG[def.type].category === category);
        if (!items.length) return null;
        return (
          <section key={category} className="gallery-group">
            <h3 className="eyebrow">{category}</h3>
            <div className="gallery-grid">
              {items.map((def) => {
                const cells = SIZE_CELLS[def.defaultSize];
                return (
                  <button
                    key={def.type}
                    type="button"
                    className="gallery-item"
                    onPointerDown={(event) => {
                      if (event.button !== 0) return;
                      event.preventDefault();
                      startGalleryDrag(def.type, event.nativeEvent);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        addFromGallery(def.type);
                      }
                    }}
                  >
                    <span className="gallery-item-icon">
                      <def.icon className="size-4" />
                    </span>
                    <span className="gallery-item-text">
                      <span className="gallery-item-name">{def.label}</span>
                      <span className="gallery-item-description">{WIDGET_CATALOG[def.type].description}</span>
                    </span>
                    <span className="gallery-item-size numeric" title="Default size">
                      {cells.w}×{cells.h}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
      {!matches.length && <p className="gallery-empty">No widgets match “{query}”.</p>}
    </PanelFrame>
  );
}
