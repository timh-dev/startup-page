import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { HiEllipsisHorizontal, HiOutlineFolderOpen, HiOutlinePencil, HiOutlineTrash } from "react-icons/hi2";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { faviconFallbackLabel, faviconSrcSet, faviconUrl, getHostname, isSelfHostedUrl, LocalServiceStatus } from "@/features/bookmarks/components/Bookmark";

export interface BookmarkEntry {
  id: string;
  name: string;
  url: string;
}

/** The site's icon (or a home-lab service's live status), with a letter if it has none. */
export function BookmarkIcon({ bookmark }: { bookmark: BookmarkEntry }) {
  const [failed, setFailed] = React.useState(false);
  const icon = faviconUrl(bookmark.url);
  return (
    <span className="bm-icon" aria-hidden="true">
      {isSelfHostedUrl(bookmark.url) ? (
        <LocalServiceStatus url={bookmark.url} className="size-3.5" />
      ) : icon && !failed ? (
        <img src={icon} srcSet={faviconSrcSet(bookmark.url)} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span className="bm-icon-letter">{faviconFallbackLabel(bookmark.name, bookmark.url)}</span>
      )}
    </span>
  );
}

interface BookmarkRowProps {
  bookmark: BookmarkEntry;
  groupId: string;
  folders: { id: string; title: string; depth: number }[];
  onEdit: (groupId: string, bookmark: BookmarkEntry) => void;
  onRemove: (id: string) => void;
  onMoveToFolder: (id: string, folderId: string) => void;
}

// One bookmark in a folder card: icon, name and site. Drag it to reorder or
// into another folder; ⋯ to edit, move or delete.
export default function BookmarkRow({ bookmark, groupId, folders, onEdit, onRemove, onMoveToFolder }: BookmarkRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: bookmark.id,
    data: { type: "bookmark", groupId },
  });
  const others = folders.filter((folder) => folder.id !== groupId);
  const host = getHostname(bookmark.url);

  return (
    <li
      ref={setNodeRef}
      className="bm-row"
      data-dragging={isDragging || undefined}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <a href={bookmark.url} className="bm-row-link" draggable={false} title={bookmark.url} {...listeners} {...attributes}>
        <BookmarkIcon bookmark={bookmark} />
        <span className="bm-row-name">{bookmark.name || host}</span>
        {host && bookmark.name && <span className="bm-row-host">{host}</span>}
      </a>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="bm-row-menu" aria-label={`${bookmark.name} options`} title="Options">
            <HiEllipsisHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onEdit(groupId, bookmark)}>
            <HiOutlinePencil className="size-3.5" /> Edit
          </DropdownMenuItem>
          {others.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <span className="inline-flex items-center gap-2">
                  <HiOutlineFolderOpen className="size-3.5" /> Move to
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {others.map((folder) => (
                  <DropdownMenuItem key={folder.id} onSelect={() => onMoveToFolder(bookmark.id, folder.id)}>
                    <span style={{ paddingLeft: `${folder.depth * 10}px` }} className="truncate">
                      {folder.title}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => onRemove(bookmark.id)}>
            <HiOutlineTrash className="size-3.5" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
