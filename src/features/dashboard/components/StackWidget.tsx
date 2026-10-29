import React from "react";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi2";

import type { WidgetInstance } from "@/lib/dashboard-dimensions";
import { getWidgetType } from "@/features/dashboard/widgetRegistry";

const MAX_DOTS = 5;

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
    <div className={`group/stack ${cardClass || "relative h-full w-full overflow-hidden rounded-[inherit]"}`}>
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
        <div className="stack-controls surface-glass" role="group" aria-label="Switch widget">
          <button type="button" onClick={() => move(-1)} className="stack-control-arrow" aria-label="Previous widget">
            <HiChevronLeft className="size-3.5" />
          </button>
          {items.length <= MAX_DOTS ? (
            items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                className="stack-control-dot"
                aria-current={index === safeIndex ? "true" : undefined}
                aria-label={`Show ${getWidgetType(item.type).label}`}
                title={getWidgetType(item.type).label}
              />
            ))
          ) : (
            // Past a handful of widgets, dots get busy: name the current one
            // and count instead.
            <span className="stack-control-label" aria-live="polite">
              <span className="truncate">{getWidgetType(items[safeIndex].type).label}</span>
              <span className="stack-control-count numeric">
                {safeIndex + 1}/{items.length}
              </span>
            </span>
          )}
          <button type="button" onClick={() => move(1)} className="stack-control-arrow" aria-label="Next widget">
            <HiChevronRight className="size-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
