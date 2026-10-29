import React from "react";
import { HiXMark } from "react-icons/hi2";

import type { WidgetInstance } from "@/lib/dashboard-dimensions";
import { getWidgetType } from "@/features/dashboard/widgetRegistry";
import type { Rect } from "@/features/dashboard/layout/joins";

interface DashboardTileProps {
  instance: WidgetInstance;
  /** Position in the list, for the load-in stagger. */
  index: number;
  /** Where the card sits on the grid, in px. */
  rect: Rect;
  /** For a joined card: its group's outline plus fades on its joined edges (CSS mask layers). */
  mask?: string;
  /** Part of a merged video or photo group: the group draws the content once. */
  merged?: boolean;
  editing: boolean;
  selected: boolean;
  dragging: boolean;
  canResize: boolean;
  radiusClass: string;
  cardClass: string;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  /** Outlined while the pointer is on a join node of this card. */
  joinPreview?: boolean;
  onResizeStart: (event: React.PointerEvent<HTMLDivElement>) => void;
  onRemove: () => void;
}

// The card's content re-renders only when the card itself changes, not on
// every position update while dragging.
const TileContent = React.memo(
  function TileContent({ instance, cardClass }: { instance: WidgetInstance; cardClass: string }) {
    const def = getWidgetType(instance.type);
    return <def.Render instance={instance} cardClass={cardClass} />;
  },
  (a, b) =>
    a.cardClass === b.cardClass &&
    a.instance.id === b.instance.id &&
    a.instance.type === b.instance.type &&
    a.instance.size === b.instance.size &&
    a.instance.config === b.instance.config &&
    a.instance.items === b.instance.items,
);

export default function DashboardTile({
  instance,
  index,
  rect,
  mask,
  merged,
  editing,
  selected,
  dragging,
  canResize,
  radiusClass,
  cardClass,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  joinPreview,
  onResizeStart,
  onRemove,
}: DashboardTileProps) {
  const label = getWidgetType(instance.type).label;
  const ref = React.useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      data-tile-id={instance.id}
      className={`dashboard-tile tile-enter ${mask ? "" : radiusClass}`}
      data-editing={editing || undefined}
      data-selected={selected || undefined}
      data-dragging={dragging || undefined}
      data-joined={mask || merged ? "true" : undefined}
      data-merged={merged || undefined}
      data-join-preview={joinPreview || undefined}
      style={
        {
          transform: `translate(${rect.x}px, ${rect.y}px)`,
          width: rect.w,
          height: rect.h,
          maskImage: mask,
          WebkitMaskImage: mask,
          // The group outline and the edge fades all apply (intersect).
          maskComposite: mask ? "intersect" : undefined,
          WebkitMaskComposite: mask ? "source-in" : undefined,
          "--tile-index": index,
          "--wiggle-delay": `${(index * 137) % 400}ms`,
        } as React.CSSProperties
      }
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      role={editing ? "button" : undefined}
      tabIndex={editing ? 0 : undefined}
      aria-label={editing ? `${label}: drag to move, click to edit` : undefined}
    >
      <div className="dashboard-tile-content h-full w-full">
        {!merged && <TileContent instance={instance} cardClass={cardClass} />}
      </div>

      {editing && !mask && !merged && (
        <button
          type="button"
          className="tile-remove"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${label}`}
          title="Remove"
        >
          <HiXMark className="size-3" />
        </button>
      )}
      {editing && canResize && !mask && !merged && <div className="tile-resize" onPointerDown={onResizeStart} role="presentation" title="Drag to resize" />}
    </div>
  );
}
