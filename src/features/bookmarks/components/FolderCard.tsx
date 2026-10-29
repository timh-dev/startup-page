import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { HiArrowDown, HiArrowUp, HiOutlineFolderPlus, HiOutlinePencil, HiOutlineTrash, HiPlus } from "react-icons/hi2";

import { MoreMenu } from "@/components/layout/CollectionShell";
import { countBookmarksInGroup } from "@/features/bookmarks/lib/tree";
import BookmarkRow, { type BookmarkEntry } from "./BookmarkRow";

export interface FolderActions {
  folders: { id: string; title: string; depth: number }[];
  onAddBookmark: (folderId: string) => void;
  onAddSubfolder: (folderId: string) => void;
  onRename: (folder: { id: string; title: string }) => void;
  onDelete: (folderId: string) => void;
  onMove: (folderId: string, direction: -1 | 1) => void;
  onEditBookmark: (groupId: string, bookmark: BookmarkEntry) => void;
  onRemoveBookmark: (id: string) => void;
  onMoveBookmark: (id: string, folderId: string) => void;
  /** Whether this folder may be deleted (the last top-level folder can't). */
  canDelete: (folderId: string, depth: number) => boolean;
}

interface FolderSectionProps extends FolderActions {
  group: any;
  depth: number;
}

// A folder and everything in it: its bookmarks, then its subfolders nested
// below (indented, with their own header). Bookmarks can be dropped anywhere
// on it, including when it's empty.
function FolderSection({ group, depth, ...actions }: FolderSectionProps) {
  const content: BookmarkEntry[] = Array.isArray(group.content) ? group.content : [];
  const children: any[] = Array.isArray(group.children) ? group.children : [];
  const { setNodeRef, isOver } = useDroppable({ id: group.id, data: { type: "folder" } });
  const Heading = depth === 0 ? "h2" : "h3";

  return (
    <div ref={setNodeRef} id={`bm-folder-${group.id}`} className="bm-folder" data-depth={depth} data-over={isOver || undefined}>
      <header className="bm-folder-head">
        <Heading className="bm-folder-title">{group.title}</Heading>
        <span className="bm-folder-count numeric">{countBookmarksInGroup(group)}</span>
        <span className="bm-folder-actions">
          <button type="button" className="bm-folder-btn" onClick={() => actions.onAddBookmark(group.id)} title={`Add a bookmark to ${group.title}`} aria-label={`Add a bookmark to ${group.title}`}>
            <HiPlus className="size-3.5" />
          </button>
          <MoreMenu
            label={`${group.title} options`}
            className="bm-folder-btn"
            items={[
              { label: "Rename", icon: HiOutlinePencil, onSelect: () => actions.onRename(group) },
              { label: "New subfolder", icon: HiOutlineFolderPlus, onSelect: () => actions.onAddSubfolder(group.id) },
              { label: "Move up", icon: HiArrowUp, onSelect: () => actions.onMove(group.id, -1), separated: true },
              { label: "Move down", icon: HiArrowDown, onSelect: () => actions.onMove(group.id, 1) },
              ...(actions.canDelete(group.id, depth)
                ? [{ label: "Delete folder", icon: HiOutlineTrash, onSelect: () => actions.onDelete(group.id), destructive: true, separated: true }]
                : []),
            ]}
          />
        </span>
      </header>

      <SortableContext items={content.map((bookmark) => bookmark.id)} strategy={verticalListSortingStrategy}>
        {content.length ? (
          <ul className="bm-list">
            {content.map((bookmark) => (
              <BookmarkRow
                key={bookmark.id}
                bookmark={bookmark}
                groupId={group.id}
                folders={actions.folders}
                onEdit={actions.onEditBookmark}
                onRemove={actions.onRemoveBookmark}
                onMoveToFolder={actions.onMoveBookmark}
              />
            ))}
          </ul>
        ) : (
          !children.length && (
            <button type="button" className="bm-folder-empty" onClick={() => actions.onAddBookmark(group.id)}>
              Empty: drop bookmarks here, or add one
            </button>
          )
        )}
      </SortableContext>

      {children.map((child) => (
        <FolderSection key={child.id} group={child} depth={depth + 1} {...actions} />
      ))}
    </div>
  );
}

/** A top-level folder as a card. */
export default function FolderCard({ group, flash, ...actions }: FolderActions & { group: any; flash?: boolean }) {
  return (
    <section className="bm-card" data-flash={flash || undefined} aria-label={group.title}>
      <FolderSection group={group} depth={0} {...actions} />
    </section>
  );
}
