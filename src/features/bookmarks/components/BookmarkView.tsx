/*eslint-disable*/
import React from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { HiChevronLeft } from "react-icons/hi2";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { faviconFallbackLabel, faviconUrl } from "@/features/bookmarks/components/Bookmark";
import BookmarkPill from "@/features/bookmarks/components/BookmarkPill";
import FolderPill from "@/features/bookmarks/components/FolderPill";
import useBookmarkActions from "@/features/bookmarks/hooks/useBookmarkActions";
import { useBookmarkDialogStore } from "@/features/bookmarks/stores/bookmarkDialogStore";
import { detectBookmarkBrowser, parseBrowserBookmarksHtml } from "@/features/bookmarks/lib/importExport";
import {
  countBookmarksInGroup,
  findGroup,
  findGroupWithParent,
  flattenGroups,
} from "@/features/bookmarks/lib/tree";

interface BookmarkViewProps {
  bookmarks: any[];
  activeCategoryId: string | null;
  onBack: () => void;
  pillSize?: number;
}

export default function BookmarkView({ bookmarks, activeCategoryId, onBack, pillSize = 3.25 }: BookmarkViewProps) {
  const actions = useBookmarkActions();
  const openAddBookmark = useBookmarkDialogStore((s) => s.openAddBookmark);
  const openEditBookmark = useBookmarkDialogStore((s) => s.openEditBookmark);
  const openAddFolder = useBookmarkDialogStore((s) => s.openAddFolder);
  const openEditFolder = useBookmarkDialogStore((s) => s.openEditFolder);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const detectedBrowser = React.useMemo(() => detectBookmarkBrowser(), []);
  const [collapsedCategories, setCollapsedCategories] = React.useState<Set<string>>(() => new Set());
  const [lastFolderId, setLastFolderId] = React.useState<string | null>(activeCategoryId);
  const [importOpen, setImportOpen] = React.useState(false);
  const [importError, setImportError] = React.useState("");
  const [draggingImport, setDraggingImport] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const [activeDrag, setActiveDrag] = React.useState<any>(null);

  React.useEffect(() => {
    if (!toast) return undefined;
    const timeoutId = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const flatFolders = React.useMemo(() => flattenGroups(bookmarks), [bookmarks]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const toggleCollapsed = (groupId: string) => {
    setCollapsedCategories((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

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
    if (!over || active.id === over.id) return;

    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;

    if (activeType === "bookmark") {
      if (overType === "bookmark") {
        const toGroupId = over.data.current?.groupId;
        const toGroup = findGroup(bookmarks, toGroupId);
        const toIndex = (toGroup?.content || []).findIndex((bookmark: any) => bookmark.id === over.id);
        actions.moveBookmark(String(active.id), toGroupId, toIndex < 0 ? undefined : toIndex);
      } else if (overType === "folder") {
        actions.moveBookmark(String(active.id), String(over.id));
      }
      return;
    }

    if (activeType === "folder" && overType === "folder") {
      const activeLocated = findGroupWithParent(bookmarks, String(active.id));
      const overLocated = findGroupWithParent(bookmarks, String(over.id));
      const activeParentId = activeLocated?.parent?.id ?? null;
      const overParentId = overLocated?.parent?.id ?? null;
      if (activeParentId !== overParentId || !overLocated) return;

      const toIndex = overLocated.siblings.findIndex((group: any) => group.id === over.id);
      actions.reorderFolderSibling(String(active.id), toIndex);
    }
  };

  const pillHeight = Math.max(2.5, Math.min(Number(pillSize) || 3.25, 5)) * 16;
  const iconWrapSize = Math.max(28, pillHeight - 14);
  const iconSize = Math.max(16, pillHeight * 0.38);
  const textSize = Math.max(14, pillHeight * 0.34);
  const gap = Math.max(8, pillHeight * 0.2);
  const pillStyle: React.CSSProperties = {
    height: `${pillHeight}px`,
    maxWidth: `${pillHeight * 5.4}px`,
    paddingLeft: `${pillHeight * 0.42}px`,
    paddingRight: `${pillHeight * 0.55}px`,
    fontSize: `${textSize}px`,
  };
  const bookmarkPillStyle: React.CSSProperties = {
    ...pillStyle,
    gap: `${gap}px`,
    paddingLeft: `${pillHeight * 0.11}px`,
  };
  const iconWrapStyle: React.CSSProperties = { width: `${iconWrapSize}px`, height: `${iconWrapSize}px` };
  const controlButtonStyle: React.CSSProperties = {
    width: `${Math.max(22, pillHeight * 0.42)}px`,
    height: `${Math.max(22, pillHeight * 0.42)}px`,
  };

  const handleMoveBookmark = (groupId: string, bookmarkId: string, direction: number) => {
    const group = findGroup(bookmarks, groupId);
    const content = group?.content || [];
    const fromIndex = content.findIndex((bookmark: any) => bookmark.id === bookmarkId);
    const toIndex = fromIndex + direction;
    if (fromIndex < 0 || toIndex < 0 || toIndex >= content.length) return;
    actions.reorderBookmark(groupId, fromIndex, toIndex);
  };

  function renderBranch(groups: any[], depth: number): React.ReactNode {
    const siblingIds = groups.map((group) => group.id);

    return (
      <SortableContext items={siblingIds} strategy={rectSortingStrategy}>
        {groups.map((group) => {
          const content = Array.isArray(group.content) ? group.content : [];
          const children = Array.isArray(group.children) ? group.children : [];
          const isCollapsed = collapsedCategories.has(group.id);
          const marginLeft = depth ? `${Math.min(depth * 18, 72)}px` : undefined;

          return (
            <React.Fragment key={group.id}>
              <FolderPill
                group={group}
                nested={depth > 0}
                isCollapsed={isCollapsed}
                count={countBookmarksInGroup(group)}
                canDelete={depth > 0 || bookmarks.length > 1}
                pillStyle={pillStyle}
                iconSize={iconSize}
                controlButtonStyle={controlButtonStyle}
                style={marginLeft ? { marginLeft } : undefined}
                onToggleCollapse={() => {
                  setLastFolderId(group.id);
                  toggleCollapsed(group.id);
                }}
                onRename={() => openEditFolder(group)}
                onAddSubfolder={() => openAddFolder(group.id)}
                onDelete={() => actions.deleteFolder(group.id)}
                onMoveUp={() => actions.moveFolderSibling(group.id, -1)}
                onMoveDown={() => actions.moveFolderSibling(group.id, 1)}
              />

              {!isCollapsed && content.length ? (
                <SortableContext items={content.map((bookmark: any) => bookmark.id)} strategy={rectSortingStrategy}>
                  {content.map((bookmark: any) => (
                    <BookmarkPill
                      key={bookmark.id}
                      bookmark={bookmark}
                      groupId={group.id}
                      flatFolders={flatFolders}
                      pillStyle={bookmarkPillStyle}
                      iconWrapStyle={iconWrapStyle}
                      iconSize={iconSize}
                      controlButtonStyle={controlButtonStyle}
                      style={marginLeft ? { marginLeft } : undefined}
                      onEdit={(groupId, b) => openEditBookmark(groupId, b)}
                      onRemove={(bookmarkId) => actions.removeBookmark(bookmarkId)}
                      onMoveToFolder={(bookmarkId, targetFolderId) => actions.moveBookmark(bookmarkId, targetFolderId)}
                      onMoveLeft={() => handleMoveBookmark(group.id, bookmark.id, -1)}
                      onMoveRight={() => handleMoveBookmark(group.id, bookmark.id, 1)}
                    />
                  ))}
                </SortableContext>
              ) : null}

              {!isCollapsed && children.length ? renderBranch(children, depth + 1) : null}
            </React.Fragment>
          );
        })}
      </SortableContext>
    );
  }

  const renderDragOverlay = () => {
    if (!activeDrag) return null;

    if (activeDrag.type === "bookmark") {
      const group = findGroup(bookmarks, activeDrag.groupId);
      const bookmark = (group?.content || []).find((item: any) => item.id === activeDrag.id);
      if (!bookmark) return null;
      const iconUrl = faviconUrl(bookmark.url);
      return (
        <span
          className="inline-flex cursor-grabbing items-center rounded-full bg-card text-card-foreground shadow-2xl"
          style={bookmarkPillStyle}
        >
          <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-background/65" style={iconWrapStyle}>
            {iconUrl ? (
              <img src={iconUrl} alt="" style={{ width: `${iconSize}px`, height: `${iconSize}px` }} className="rounded-sm object-contain" />
            ) : (
              <span className="bookmark-favicon-fallback" style={{ width: `${iconSize}px`, height: `${iconSize}px` }}>
                {faviconFallbackLabel(bookmark.name, bookmark.url)}
              </span>
            )}
          </span>
          <span className="truncate font-medium">{bookmark.name}</span>
        </span>
      );
    }

    if (activeDrag.type === "folder") {
      const group = findGroup(bookmarks, activeDrag.id);
      if (!group) return null;
      return (
        <span className="inline-flex cursor-grabbing items-center gap-2 rounded-full bg-primary font-medium text-primary-foreground shadow-2xl" style={pillStyle}>
          <span className="block truncate">{group.title}</span>
        </span>
      );
    }

    return null;
  };

  return (
    <div className="bookmark-vault h-screen w-full overflow-y-auto px-4 pb-16 pt-24 sm:px-6">
      <div className="bookmark-vault-header">
        <button type="button" onClick={onBack} className="bookmark-vault-back" title="Back to dashboard">
          <HiChevronLeft className="size-4" />
        </button>
        <h1>Bookmark Vault:</h1>
        <div className="bookmark-vault-actions">
          <button
            type="button"
            onClick={() => openAddFolder(null)}
            className="bookmark-vault-button"
            title="Create a new folder"
          >
            + New Folder
          </button>
          <button
            type="button"
            onClick={() => openAddBookmark(lastFolderId || activeCategoryId || flatFolders[0]?.id || null)}
            className="bookmark-vault-button"
            title="Add a bookmark"
          >
            + Add Bookmark
          </button>
          <button type="button" onClick={openImportModal} className="bookmark-vault-button" title="Import browser bookmarks export">
            Import
          </button>
          <button type="button" onClick={actions.exportBookmarks} className="bookmark-vault-button" title="Export bookmarks as browser HTML">
            Export
          </button>
        </div>
      </div>
      <input ref={fileInputRef} type="file" accept=".html,.htm,text/html" className="hidden" onChange={handleImportFile} />
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-xl gap-0 border-border/60 bg-background/98 p-6 pr-14 text-foreground sm:p-7 sm:pr-16">
          <DialogHeader className="pr-2">
            <DialogTitle className="font-serif text-xl">Import Bookmarks</DialogTitle>
            <DialogDescription className="leading-6">
              Select an HTML bookmarks export from {detectedBrowser}. Chrome, Firefox, Edge, Safari, Opera, and other
              Netscape-format exports are supported.
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
            <span className="text-base font-medium text-foreground">Drop bookmarks HTML here</span>
            <span className="mt-2 text-sm text-muted-foreground">or click to open your file explorer</span>
            <span className="mt-4 text-xs text-muted-foreground">
              Folders become categories. Subfolders become nested subcategories.
            </span>
          </button>
          {importError ? (
            <div className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {importError}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      {toast ? (
        <div className="fixed right-4 top-24 z-50 max-w-sm rounded-xl border border-border/60 bg-card px-4 py-3 text-sm text-card-foreground shadow-xl">
          {toast}
        </div>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="bookmark-vault-list">{renderBranch(bookmarks, 0)}</div>
        <DragOverlay>{renderDragOverlay()}</DragOverlay>
      </DndContext>
    </div>
  );
}
