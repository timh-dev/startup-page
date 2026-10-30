/*eslint-disable*/
import React from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  HiArrowDownTray,
  HiArrowUpTray,
  HiOutlineBookmark,
  HiOutlineFolder,
  HiOutlineFolderPlus,
  HiOutlineMagnifyingGlassCircle,
  HiPlus,
} from "react-icons/hi2";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import CollectionShell, { CollectionHeader, MoreMenu, RailGroup, RailItem, RailSearch } from "@/components/layout/CollectionShell";
import { BookmarkIcon } from "@/features/bookmarks/components/BookmarkRow";
import FolderCard, { type FolderActions } from "@/features/bookmarks/components/FolderCard";
import useBookmarkActions from "@/features/bookmarks/hooks/useBookmarkActions";
import { useBookmarkDialogStore } from "@/features/bookmarks/stores/bookmarkDialogStore";
import { detectBookmarkBrowser, parseBrowserBookmarksHtml } from "@/features/bookmarks/lib/importExport";
import {
  countBookmarksInGroup,
  filterBookmarkTree,
  findGroup,
  findGroupWithParent,
  flattenGroups,
} from "@/features/bookmarks/lib/tree";

interface BookmarkViewProps {
  bookmarks: any[];
}

// Bookmarks: every folder is an open card (subfolders nested inside), in
// columns. The sidebar lists the folders to jump to; search filters them all.
// Drag a bookmark to reorder it or drop it on another folder.
export default function BookmarkView({ bookmarks }: BookmarkViewProps) {
  const actions = useBookmarkActions();
  const openAddBookmark = useBookmarkDialogStore((s) => s.openAddBookmark);
  const openEditBookmark = useBookmarkDialogStore((s) => s.openEditBookmark);
  const openAddFolder = useBookmarkDialogStore((s) => s.openAddFolder);
  const openEditFolder = useBookmarkDialogStore((s) => s.openEditFolder);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const detectedBrowser = React.useMemo(() => detectBookmarkBrowser(), []);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [focusId, setFocusId] = React.useState<string | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);
  const [importError, setImportError] = React.useState("");
  const [draggingImport, setDraggingImport] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const [activeDrag, setActiveDrag] = React.useState<any>(null);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    if (!toast) return undefined;
    const timeoutId = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const flatFolders = React.useMemo(() => flattenGroups(bookmarks), [bookmarks]);
  const filteredBookmarks = React.useMemo(() => filterBookmarkTree(bookmarks, query), [bookmarks, query]);
  const totalBookmarks = React.useMemo(
    () => bookmarks.reduce((sum, group) => sum + countBookmarksInGroup(group), 0),
    [bookmarks],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Over a bookmark: that spot. Otherwise the innermost folder under the
  // pointer (a subfolder before the card around it), else the nearest.
  const collision: CollisionDetection = React.useCallback((args) => {
    const hits = pointerWithin(args);
    const typeOf = (id: unknown) => args.droppableContainers.find((c) => c.id === id)?.data.current?.type;
    const rows = hits.filter((hit) => typeOf(hit.id) === "bookmark");
    if (rows.length) return rows;
    if (hits.length) {
      const area = (id: unknown) => {
        const rect = args.droppableRects.get(id as string);
        return rect ? rect.width * rect.height : Infinity;
      };
      return [...hits].sort((a, b) => area(a.id) - area(b.id));
    }
    return closestCenter(args);
  }, []);

  const jumpTo = (folderId: string | null) => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    setFocusId(folderId);
    if (!folderId) {
      scroller.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const el = document.getElementById(`bm-folder-${folderId}`);
    if (!el) return;
    // Within the pane only (scrollIntoView would also move the page pager).
    const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 16;
    scroller.scrollTo({ top, behavior: "smooth" });
  };

  React.useEffect(() => {
    if (!focusId) return undefined;
    const timer = window.setTimeout(() => setFocusId(null), 1400);
    return () => window.clearTimeout(timer);
  }, [focusId]);

  const showToast = (message: string) => setToast(message);

  const openImportModal = () => {
    setImportError("");
    setImportOpen(true);
  };

  const importBookmarkFile = async (file: File) => {
    if (!file) return;
    try {
      const html = await file.text();
      const importedGroups = parseBrowserBookmarksHtml(html);

      if (!importedGroups.length) {
        const message =
          "No bookmarks were found in that export file. Use your browser's HTML bookmark export.";
        setImportError(message);
        showToast(message);
        return;
      }

      await actions.importBookmarks(importedGroups);
      setImportOpen(false);
      setImportError("");
      showToast(
        `Imported ${importedGroups.reduce((total, group) => total + countBookmarksInGroup(group), 0)} bookmarks.`,
      );
    } catch (_error) {
      const message = "Could not import that bookmarks file. Try an HTML bookmarks export from your browser.";
      setImportError(message);
      showToast(message);
    }
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.target.files || []);
    event.target.value = "";
    await importBookmarkFile(file);
  };

  const handleImportDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    setDraggingImport(false);
    const [file] = Array.from(event.dataTransfer.files || []) as File[];
    await importBookmarkFile(file);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDrag({ id: event.active.id, ...(event.active.data.current || {}) });
  };

  const handleDragCancel = () => setActiveDrag(null);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDrag(null);
    if (!over || active.id === over.id || active.data.current?.type !== "bookmark") return;
    const overType = over.data.current?.type;
    if (overType === "bookmark") {
      const toGroupId = over.data.current?.groupId;
      const toGroup = findGroup(bookmarks, toGroupId);
      const toIndex = (toGroup?.content || []).findIndex((bookmark: any) => bookmark.id === over.id);
      actions.moveBookmark(String(active.id), toGroupId, toIndex < 0 ? undefined : toIndex);
    } else if (overType === "folder" && over.id !== active.data.current?.groupId) {
      actions.moveBookmark(String(active.id), String(over.id));
    }
  };

  const draggedBookmark = activeDrag ? (findGroup(bookmarks, activeDrag.groupId)?.content || []).find((item: any) => item.id === activeDrag.id) : null;

  const folderActions: FolderActions = {
    folders: flatFolders,
    onAddBookmark: (folderId) => openAddBookmark(folderId),
    onAddSubfolder: (folderId) => openAddFolder(folderId),
    onRename: (folder) => openEditFolder(folder),
    onDelete: (folderId) => {
      const folder = findGroup(bookmarks, folderId);
      const count = folder ? countBookmarksInGroup(folder) : 0;
      if (count && !window.confirm(`Delete "${folder.title}" and the ${count} bookmark${count === 1 ? "" : "s"} in it?`)) return;
      actions.deleteFolder(folderId);
    },
    onMove: (folderId, direction) => actions.moveFolderSibling(folderId, direction),
    onEditBookmark: (groupId, bookmark) => openEditBookmark(groupId, bookmark),
    onRemoveBookmark: (bookmarkId) => actions.removeBookmark(bookmarkId),
    onMoveBookmark: (bookmarkId, folderId) => actions.moveBookmark(bookmarkId, folderId),
    canDelete: (_folderId, depth) => depth > 0 || bookmarks.length > 1,
  };

  const searching = query.trim().length > 0;
  const matchCount = filteredBookmarks.reduce((sum: number, group: any) => sum + countBookmarksInGroup(group), 0);

  const rail = (
    <>
      <RailSearch value={query} onChange={setQuery} placeholder="Search bookmarks" />
      <RailGroup>
        <RailItem label="All bookmarks" icon={HiOutlineBookmark} count={totalBookmarks} active={!focusId} onClick={() => jumpTo(null)} />
      </RailGroup>
      <RailGroup
        title="Folders"
        action={
          <button type="button" className="rail-group-btn" onClick={() => openAddFolder(null)} title="New folder" aria-label="New folder">
            <HiPlus className="size-3.5" />
          </button>
        }
      >
        {flatFolders.map((folder) => (
          <RailItem
            key={folder.id}
            label={folder.title}
            icon={folder.depth ? undefined : HiOutlineFolder}
            depth={folder.depth}
            count={countBookmarksInGroup(findGroup(bookmarks, folder.id))}
            active={focusId === folder.id}
            onClick={() => {
              if (searching) setQuery("");
              window.requestAnimationFrame(() => jumpTo(folder.id));
            }}
          />
        ))}
      </RailGroup>
    </>
  );

  return (
    <CollectionShell label="Bookmarks" rail={rail} scrollRef={scrollRef}>
      <div className="collection-pane">
        <CollectionHeader eyebrow="Bookmarks" title={searching ? `“${query.trim()}”` : "All bookmarks"} count={searching ? matchCount : totalBookmarks}>
          <MoreMenu
            label="More bookmark actions"
            items={[
              { label: "Import from your browser…", icon: HiArrowUpTray, onSelect: openImportModal },
              { label: "Export as HTML", icon: HiArrowDownTray, onSelect: actions.exportBookmarks },
            ]}
          />
          <button type="button" className="collection-ghost-btn" onClick={() => openAddFolder(null)}>
            <HiOutlineFolderPlus className="size-4" />
            New folder
          </button>
          <button type="button" className="collection-primary-btn" onClick={() => openAddBookmark(flatFolders[0]?.id || null)}>
            <HiPlus className="size-4" />
            Add bookmark
          </button>
        </CollectionHeader>

        <input ref={fileInputRef} type="file" accept=".html,.htm,text/html" className="hidden" onChange={handleImportFile} />
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent className="max-w-xl gap-0 border-border/60 bg-background/98 p-6 pr-14 text-foreground sm:p-7 sm:pr-16">
            <DialogHeader className="pr-2">
              <DialogTitle className="font-serif text-xl">Import bookmarks</DialogTitle>
              <DialogDescription className="leading-6">
                Choose an HTML bookmarks export from {detectedBrowser}. Chrome, Firefox, Edge, Safari, Opera and other Netscape-format exports work.
              </DialogDescription>
            </DialogHeader>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDraggingImport(true);
              }}
              onDragLeave={() => setDraggingImport(false)}
              onDrop={handleImportDrop}
              className={`mt-5 flex min-h-48 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition focus:outline-none focus:ring-2 focus:ring-ring ${
                draggingImport ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-accent"
              }`}
            >
              <span className="text-base font-medium text-foreground">Drop the bookmarks file here</span>
              <span className="mt-2 text-sm text-muted-foreground">or click to choose it</span>
              <span className="mt-4 text-xs text-muted-foreground">Folders become folders here, subfolders stay nested.</span>
            </button>
            {importError ? (
              <div className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{importError}</div>
            ) : null}
          </DialogContent>
        </Dialog>
        {toast ? (
          <p className="collection-message" role="status">
            {toast}
          </p>
        ) : null}

        {filteredBookmarks.length ? (
          <DndContext sensors={sensors} collisionDetection={collision} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
            <div className="bm-cards">
              {filteredBookmarks.map((group: any) => (
                <FolderCard key={group.id} group={group} flash={focusId === group.id} {...folderActions} />
              ))}
            </div>
            <DragOverlay dropAnimation={{ duration: 160, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
              {draggedBookmark ? (
                <div className="bm-row bm-row-overlay">
                  <span className="bm-row-link">
                    <BookmarkIcon bookmark={draggedBookmark} />
                    <span className="bm-row-name">{draggedBookmark.name}</span>
                  </span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <div className="collection-empty">
            <HiOutlineMagnifyingGlassCircle className="collection-empty-icon" />
            <p className="collection-empty-title">{searching ? "No bookmarks match" : "No bookmarks yet"}</p>
            <p className="collection-empty-hint">{searching ? "Search looks at names, addresses and folder names." : "Add one, or import your browser's bookmarks from the ⋯ menu."}</p>
          </div>
        )}
      </div>
    </CollectionShell>
  );
}
