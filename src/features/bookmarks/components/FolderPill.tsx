/*eslint-disable*/
import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  HiChevronLeft,
  HiChevronRight,
  HiEllipsisVertical,
  HiMinus,
  HiOutlineFolderPlus,
  HiOutlinePencil,
  HiOutlineTrash,
  HiPlus,
} from "react-icons/hi2";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FolderPillProps {
  group: { id: string; title: string };
  nested: boolean;
  isCollapsed: boolean;
  count: number;
  canDelete: boolean;
  pillStyle: React.CSSProperties;
  iconSize: number;
  controlButtonStyle: React.CSSProperties;
  style?: React.CSSProperties;
  onToggleCollapse: () => void;
  onRename: () => void;
  onAddSubfolder: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export default function FolderPill({
  group,
  nested,
  isCollapsed,
  count,
  canDelete,
  pillStyle,
  iconSize,
  controlButtonStyle,
  style,
  onToggleCollapse,
  onRename,
  onAddSubfolder,
  onDelete,
  onMoveUp,
  onMoveDown,
}: FolderPillProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id: group.id,
    data: { type: "folder" },
  });

  const dragStyle: React.CSSProperties = {
    ...style,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  const colorClass = isCollapsed
    ? "bg-amber-400 font-semibold text-slate-950 ring-2 ring-amber-100/80"
    : nested
      ? "bg-cyan-400 font-semibold text-slate-950 ring-2 ring-cyan-100/80"
      : "bg-primary font-medium text-primary-foreground";

  return (
    <span ref={setNodeRef} style={dragStyle} className="group/category relative inline-flex">
      <button
        type="button"
        onClick={onToggleCollapse}
        {...listeners}
        {...attributes}
        className={`inline-flex cursor-grab items-center justify-between gap-2 rounded-full shadow-lg transition active:cursor-grabbing hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring ${colorClass} ${
          isOver ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : ""
        }`}
        style={pillStyle}
        title={`${isCollapsed ? "Expand" : "Collapse"} ${group.title} — drop a bookmark here to move it into this folder`}
        aria-expanded={!isCollapsed}
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          <span
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-background/25 text-current"
            style={{ width: `${Math.max(20, iconSize * 1.05)}px`, height: `${Math.max(20, iconSize * 1.05)}px` }}
          >
            {isCollapsed ? (
              <HiPlus style={{ width: `${Math.max(12, iconSize * 0.62)}px`, height: `${Math.max(12, iconSize * 0.62)}px` }} />
            ) : (
              <HiMinus style={{ width: `${Math.max(12, iconSize * 0.62)}px`, height: `${Math.max(12, iconSize * 0.62)}px` }} />
            )}
          </span>
          {nested ? (
            <span className="rounded-full bg-background/35 px-2 py-0.5 text-[0.65em] uppercase tracking-wide text-current">
              Sub
            </span>
          ) : null}
          <span className="block truncate">{group.title}</span>
        </span>
        <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-background/20 px-2 py-0.5 text-[0.72em]">
          {count}
        </span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onClick={(event) => event.stopPropagation()}
            className="absolute -right-1.5 -top-1.5 inline-flex items-center justify-center rounded-full border border-border/60 bg-card text-card-foreground opacity-0 shadow-md transition hover:bg-accent hover:text-accent-foreground focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring group-hover/category:opacity-100 data-[state=open]:opacity-100"
            style={controlButtonStyle}
            title={`${group.title} options`}
          >
            <HiEllipsisVertical className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={onRename}>
            <HiOutlinePencil className="size-3.5" /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onAddSubfolder}>
            <HiOutlineFolderPlus className="size-3.5" /> Add sub-folder
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onMoveUp}>
            <HiChevronLeft className="size-3.5" /> Move earlier
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onMoveDown}>
            <HiChevronRight className="size-3.5" /> Move later
          </DropdownMenuItem>
          {canDelete ? (
            <DropdownMenuItem destructive onSelect={onDelete}>
              <HiOutlineTrash className="size-3.5" /> Delete
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
