import React from "react";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi2";

import type { WidgetInstance } from "@/lib/dashboard-dimensions";
import { getWidgetType } from "@/features/dashboard/widgetRegistry";

// Generalizes the old FeaturePanel: swipes between an arbitrary list of child
// widget instances instead of a fixed set of hardcoded modes. All items stay
// mounted (so they pre-fetch); CSS just hides the inactive ones.
export function StackWidget({ items, cardClass }: { items: WidgetInstance[]; cardClass?: string }): React.ReactElement {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const safeIndex = items.length ? Math.min(activeIndex, items.length - 1) : 0;

  const move = (direction: number) => {
    if (!items.length) return;
    setActiveIndex((safeIndex + direction + items.length) % items.length);
  };

  if (!items.length) {
    return (
      <div className={cardClass || "flex h-full w-full items-center justify-center rounded-xl bg-card p-4 text-center"}>
        <p className="text-xs text-muted-foreground">Add widgets to this stack in its settings.</p>
      </div>
    );
  }

  return (
    <div className={cardClass || "relative h-full w-full overflow-visible rounded-[inherit]"}>
      <div className="h-full w-full overflow-hidden rounded-[inherit]">
        {items.map((item, index) => {
          const def = getWidgetType(item.type);
          return (
            <div key={item.id} className="h-full w-full" style={{ display: index === safeIndex ? "block" : "none" }}>
              <def.Render instance={item} cardClass="h-full w-full overflow-hidden rounded-[inherit]" />
            </div>
          );
        })}
      </div>

      {items.length > 1 ? (
        <>
          <button
            type="button"
            onClick={() => move(-1)}
            className="absolute -left-3 top-1/2 z-10 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border border-border/80 bg-background/92 text-foreground shadow-md backdrop-blur-sm transition hover:bg-accent hover:text-accent-foreground"
            aria-label="Previous widget"
          >
            <HiChevronLeft className="size-3.5" />
          </button>

          <button
            type="button"
            onClick={() => move(1)}
            className="absolute -right-3 top-1/2 z-10 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border border-border/80 bg-background/92 text-foreground shadow-md backdrop-blur-sm transition hover:bg-accent hover:text-accent-foreground"
            aria-label="Next widget"
          >
            <HiChevronRight className="size-3.5" />
          </button>

          <div className="absolute inset-x-0 -bottom-4 z-10 flex items-center justify-center gap-1.5">
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`size-1.5 rounded-full transition ${
                  index === safeIndex ? "bg-foreground shadow-sm" : "bg-border hover:bg-muted-foreground"
                }`}
                aria-label={`Show ${getWidgetType(item.type).label}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
