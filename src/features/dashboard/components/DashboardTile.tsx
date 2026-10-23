import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { HiOutlineArrowsPointingOut, HiOutlineCog6Tooth, HiOutlineXMark } from "react-icons/hi2";
import { TILE_SIZE_SPANS, type WidgetInstance } from "@/lib/dashboard-dimensions";
import { getWidgetType } from "@/features/dashboard/widgetRegistry";

interface DashboardTileProps {
  instance: WidgetInstance;
  /** Position in the grid, for the load-in stagger. */
  index: number;
  editing: boolean;
  radiusClass: string;
  cardClass: string;
  onEdit: () => void;
  onRemove: () => void;
}

export default function DashboardTile({ instance, index, editing, radiusClass, cardClass, onEdit, onRemove }: DashboardTileProps) {
  const def = getWidgetType(instance.type);
  const spanClass = TILE_SIZE_SPANS[instance.size] || TILE_SIZE_SPANS.small;

  // `disabled` when not editing so dnd-kit's sortable machinery is fully
  // inert outside edit mode — no listeners are bound to non-handle elements
  // either way, but this also skips its measuring/transform bookkeeping.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: instance.id,
    disabled: !editing,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    "--tile-index": index,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-tile-id={instance.id}
      className={`tile-enter ${spanClass} min-h-0 min-w-0 relative ${
        editing ? `${radiusClass} ring-2 ${isDragging ? "ring-primary opacity-60 z-20" : "ring-primary/40"}` : ""
      }`}
    >
      <div className={editing ? "pointer-events-none h-full w-full select-none" : "h-full w-full"}>
        <def.Render instance={instance} cardClass={cardClass} />
      </div>

      {editing && (
        <div className="pointer-events-auto absolute left-1 top-1 z-30 flex items-center gap-1 rounded-lg border border-border/60 bg-background/95 px-1 py-1 shadow-lg backdrop-blur-sm">
          <button
            type="button"
            {...attributes}
            {...listeners}
            // touch-action:none stops the browser from treating this handle's
            // touch gestures as a page scroll, which would otherwise fight
            // dnd-kit's pointer-based drag on touch devices.
            style={{ touchAction: "none" }}
            className="flex size-6 cursor-grab items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-accent-foreground active:cursor-grabbing"
            aria-label="Drag to move tile"
            title="Drag to move"
          >
            <HiOutlineArrowsPointingOut className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
            aria-label="Configure widget"
            title={`Configure (${def.label})`}
          >
            <HiOutlineCog6Tooth className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive/15 hover:text-destructive"
            aria-label="Remove widget"
            title="Remove"
          >
            <HiOutlineXMark className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
