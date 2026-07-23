/*eslint-disable*/
import React from "react";
import { useSettingsStore } from "@/features/settings/stores";
import { normalizeBookmarkUrl } from "@/features/bookmarks/lib/url";
import { createBookmarksExportHtml } from "@/features/bookmarks/lib/importExport";
import {
  addBookmarkToGroup,
  addGroup,
  findGroupWithParent,
  generateId,
  moveBookmark as moveBookmarkInTree,
  moveSibling,
  removeBookmark as removeBookmarkFromTree,
  removeGroup,
  reorderFolder as reorderFolderInTree,
  reorderSibling,
  updateBookmark as updateBookmarkInTree,
  updateGroup,
} from "@/features/bookmarks/lib/tree";

// Single place all bookmark CRUD/reorder logic lives. Every operation reads
// the freshest settings from the store (via the updater-function form of
// persistSettings) and writes back an id-addressed bookmark tree, so callers
// never juggle array index paths.
export default function useBookmarkActions() {
  const persistSettingsToStore = useSettingsStore((state) => state.persistSettings);

  const withBookmarks = React.useCallback(
    (updater: (groups: any[]) => any[]) =>
      persistSettingsToStore((current: any) => {
        const groups = Array.isArray(current.bookmark) ? current.bookmark : [];
        return { ...current, bookmark: updater(groups) };
      }),
    [persistSettingsToStore],
  );

  const addBookmark = React.useCallback(
    (groupId: string, bookmark: { name: string; url: string }) =>
      withBookmarks((groups) =>
        addBookmarkToGroup(groups, groupId, {
          id: generateId(),
          name: bookmark.name,
          url: normalizeBookmarkUrl(bookmark.url),
        }),
      ),
    [withBookmarks],
  );

  const updateBookmark = React.useCallback(
    (bookmarkId: string, bookmark: { name: string; url: string }) =>
      withBookmarks((groups) =>
        updateBookmarkInTree(groups, bookmarkId, {
          name: bookmark.name,
          url: normalizeBookmarkUrl(bookmark.url),
        }),
      ),
    [withBookmarks],
  );

  const removeBookmark = React.useCallback(
    (bookmarkId: string) => withBookmarks((groups) => removeBookmarkFromTree(groups, bookmarkId)),
    [withBookmarks],
  );

  const moveBookmark = React.useCallback(
    (bookmarkId: string, toGroupId: string, toIndex?: number) =>
      withBookmarks((groups) => moveBookmarkInTree(groups, bookmarkId, toGroupId, toIndex)),
    [withBookmarks],
  );

  const reorderBookmark = React.useCallback(
    (groupId: string, fromIndex: number, toIndex: number) =>
      withBookmarks((groups) =>
        updateGroup(groups, groupId, (group) => {
          const content = [...(Array.isArray(group.content) ? group.content : [])];
          if (fromIndex < 0 || fromIndex >= content.length) return group;
          const [moved] = content.splice(fromIndex, 1);
          content.splice(Math.max(0, Math.min(toIndex, content.length)), 0, moved);
          return { ...group, content };
        }),
      ),
    [withBookmarks],
  );

  // Returns the new folder's id so callers (e.g. the "+ New folder" inline
  // shortcut inside the add-bookmark dialog) can immediately target it.
  const addFolder = React.useCallback(
    (title: string, parentId: string | null = null) => {
      const id = generateId();
      return withBookmarks((groups) =>
        addGroup(groups, { id, title, content: [], children: [] }, parentId),
      ).then(() => id);
    },
    [withBookmarks],
  );

  const renameFolder = React.useCallback(
    (folderId: string, title: string) =>
      withBookmarks((groups) => updateGroup(groups, folderId, (group) => ({ ...group, title }))),
    [withBookmarks],
  );

  const deleteFolder = React.useCallback(
    (folderId: string) =>
      withBookmarks((groups) => {
        // Guard against deleting the last remaining top-level folder — the
        // dashboard tiles and the vault both assume at least one exists.
        const located = findGroupWithParent(groups, folderId);
        if (!located) return groups;
        if (!located.parent && groups.length <= 1) return groups;
        return removeGroup(groups, folderId);
      }),
    [withBookmarks],
  );

  const moveFolderSibling = React.useCallback(
    (folderId: string, direction: number) => withBookmarks((groups) => moveSibling(groups, folderId, direction)),
    [withBookmarks],
  );

  const reorderFolder = React.useCallback(
    (fromIndex: number, toIndex: number) =>
      withBookmarks((groups) => reorderFolderInTree(groups, fromIndex, toIndex)),
    [withBookmarks],
  );

  // Reorders a folder among whichever sibling list it currently belongs to
  // (top level or nested) — used by folder drag-and-drop.
  const reorderFolderSibling = React.useCallback(
    (folderId: string, toIndex: number) => withBookmarks((groups) => reorderSibling(groups, folderId, toIndex)),
    [withBookmarks],
  );

  const importBookmarks = React.useCallback(
    (importedGroups: any[]) => withBookmarks((groups) => [...groups, ...importedGroups]),
    [withBookmarks],
  );

  const exportBookmarks = React.useCallback(() => {
    const current = useSettingsStore.getState().settings;
    const groups = Array.isArray(current.bookmark) ? current.bookmark : [];
    const html = createBookmarksExportHtml(groups);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `startup-page-bookmarks-${date}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, []);

  return {
    addBookmark,
    updateBookmark,
    removeBookmark,
    moveBookmark,
    reorderBookmark,
    addFolder,
    renameFolder,
    deleteFolder,
    moveFolderSibling,
    reorderFolder,
    reorderFolderSibling,
    importBookmarks,
    exportBookmarks,
  };
}
