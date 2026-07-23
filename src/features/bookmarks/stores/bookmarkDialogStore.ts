import { create } from "zustand";

type DialogState =
  | { kind: null }
  | { kind: "bookmark"; mode: "add"; groupId: string | null }
  | { kind: "bookmark"; mode: "edit"; groupId: string; bookmarkId: string; name: string; url: string }
  | { kind: "folder"; mode: "add"; parentId: string | null }
  | { kind: "folder"; mode: "edit"; folderId: string; title: string };

interface BookmarkDialogStore {
  dialog: DialogState;
  openAddBookmark: (groupId?: string | null) => void;
  openEditBookmark: (groupId: string, bookmark: { id: string; name: string; url: string }) => void;
  openAddFolder: (parentId?: string | null) => void;
  openEditFolder: (folder: { id: string; title: string }) => void;
  close: () => void;
}

// Ephemeral (non-persisted) UI state for which bookmark/folder popup is open.
// Lives outside any single page so both the dashboard tiles' quick-add "+"
// and the Bookmark Vault page can open the same popup without prop drilling
// across routes — mirrors the pattern used by useLayoutEditStore.
export const useBookmarkDialogStore = create<BookmarkDialogStore>((set) => ({
  dialog: { kind: null },

  openAddBookmark: (groupId = null) => set({ dialog: { kind: "bookmark", mode: "add", groupId } }),

  openEditBookmark: (groupId, bookmark) =>
    set({
      dialog: {
        kind: "bookmark",
        mode: "edit",
        groupId,
        bookmarkId: bookmark.id,
        name: bookmark.name || "",
        url: bookmark.url || "",
      },
    }),

  openAddFolder: (parentId = null) => set({ dialog: { kind: "folder", mode: "add", parentId } }),

  openEditFolder: (folder) =>
    set({ dialog: { kind: "folder", mode: "edit", folderId: folder.id, title: folder.title || "" } }),

  close: () => set({ dialog: { kind: null } }),
}));
