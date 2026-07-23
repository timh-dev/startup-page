/*eslint-disable*/
import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  HiEllipsisVertical,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineFolderOpen,
  HiChevronLeft,
  HiChevronRight,
} from "react-icons/hi2";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  faviconFallbackLabel,
  faviconSrcSet,
  faviconUrl,
  isSelfHostedUrl,
  LocalServiceStatus,
} from "@/features/bookmarks/components/Bookmark";

interface BookmarkPillProps {
  bookmark: { id: string; name: string; url: string };
  groupId: string;
  flatFolders: { id: string; title: string; depth: number }[];
  pillStyle: React.CSSProperties;
  iconWrapStyle: React.CSSProperties;
  iconSize: number;
  controlButtonStyle: React.CSSProperties;
  style?: React.CSSProperties;
  onEdit: (groupId: string, bookmark: { id: string; name: string; url: string }) => void;
  onRemove: (bookmarkId: string) => void;
  onMoveToFolder: (bookmarkId: string, targetFolderId: string) => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
}

export default function BookmarkPill({
  bookmark,
  groupId,
  flatFolders,
  pillStyle,
  iconWrapStyle,
  iconSize,
  controlButtonStyle,
  style,
  onEdit,
  onRemove,
  onMoveToFolder,
  onMoveLeft,
  onMoveRight,
}: BookmarkPillProps) {
  const { name, url } = bookmark;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: bookmark.id,
    data: { type: "bookmark", groupId },
  });

  const dragStyle: React.CSSProperties = {
    ...style,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  const iconUrl = faviconUrl(url);
  const selfHosted = isSelfHostedUrl(url);
  const otherFolders = flatFolders.filter((folder) => folder.id !== groupId);

  return (
    <span ref={setNodeRef} style={dragStyle} className="group relative inline-flex">
      <a
        href={url}
        draggable={false}
        {...listeners}
        {...attributes}
        className="inline-flex cursor-grab items-center rounded-full bg-card text-card-foreground shadow-lg transition active:cursor-grabbing hover:bg-accent hover:text-accent-foreground"
        style={pillStyle}
        title={url}
      >
        <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-background/65" style={iconWrapStyle}>
          {selfHosted ? (
            <LocalServiceStatus url={url} className="size-4" />
          ) : iconUrl ? (
            <>
              <img
                src={iconUrl}
                srcSet={faviconSrcSet(url)}
                alt=""
                className="rounded-sm object-contain"
                style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                  event.currentTarget.nextElementSibling?.removeAttribute("hidden");
                }}
              />
              <span
                hidden
                className="bookmark-favicon-fallback"
                style={{ width: `${iconSize}px`, height: `${iconSize}px`, fontSize: `${Math.max(10, iconSize * 0.48)}px` }}
              >
                {faviconFallbackLabel(name, url)}
              </span>
            </>
          ) : (
            <span
              className="bookmark-favicon-fallback"
              style={{ width: `${iconSize}px`, height: `${iconSize}px`, fontSize: `${Math.max(10, iconSize * 0.48)}px` }}
            >
              {faviconFallbackLabel(name, url)}
            </span>
          )}
        </span>
        <span className="truncate font-medium">{name}</span>
      </a>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="absolute -right-1.5 -top-1.5 inline-flex items-center justify-center rounded-full border border-border/60 bg-card text-card-foreground opacity-0 shadow-md transition hover:bg-accent hover:text-accent-foreground focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring group-hover:opacity-100 data-[state=open]:opacity-100"
            style={controlButtonStyle}
            title={`${name} options`}
          >
            <HiEllipsisVertical className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => onEdit(groupId, bookmark)}>
            <HiOutlinePencil className="size-3.5" /> Edit
          </DropdownMenuItem>
          {otherFolders.length ? (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <span className="inline-flex items-center gap-2">
                  <HiOutlineFolderOpen className="size-3.5" /> Move to folder
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {otherFolders.map((folder) => (
                  <DropdownMenuItem key={folder.id} onSelect={() => onMoveToFolder(bookmark.id, folder.id)}>
                    <span style={{ paddingLeft: `${folder.depth * 10}px` }} className="truncate">
                      {folder.title}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : null}
          <DropdownMenuItem onSelect={onMoveLeft}>
            <HiChevronLeft className="size-3.5" /> Move earlier
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onMoveRight}>
            <HiChevronRight className="size-3.5" /> Move later
          </DropdownMenuItem>
          <DropdownMenuItem destructive onSelect={() => onRemove(bookmark.id)}>
            <HiOutlineTrash className="size-3.5" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
