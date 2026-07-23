/*eslint-disable*/
import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettingsStore } from "@/features/settings/stores";
import { useBookmarkDialogStore } from "@/features/bookmarks/stores/bookmarkDialogStore";
import useBookmarkActions from "@/features/bookmarks/hooks/useBookmarkActions";
import { flattenGroups } from "@/features/bookmarks/lib/tree";

const NEW_FOLDER_VALUE = "__new_folder__";

function BookmarkForm({
  dialog,
  flatFolders,
  actions,
  close,
}: {
  dialog: any;
  flatFolders: { id: string; title: string; depth: number }[];
  actions: ReturnType<typeof useBookmarkActions>;
  close: () => void;
}) {
  const [name, setName] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [folderId, setFolderId] = React.useState("");
  const [newFolderName, setNewFolderName] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (dialog.kind !== "bookmark") return;
    if (dialog.mode === "edit") {
      setName(dialog.name);
      setUrl(dialog.url);
      setFolderId(dialog.groupId);
    } else {
      setName("");
      setUrl("");
      setFolderId(dialog.groupId || flatFolders[0]?.id || "");
    }
    setNewFolderName("");
  }, [dialog]);

  const isEditing = dialog.kind === "bookmark" && dialog.mode === "edit";
  const creatingNewFolder = folderId === NEW_FOLDER_VALUE;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    if (!trimmedName || !trimmedUrl) return;
    if (creatingNewFolder && !newFolderName.trim()) return;

    setSubmitting(true);
    try {
      let targetGroupId = folderId;
      if (creatingNewFolder) {
        targetGroupId = await actions.addFolder(newFolderName.trim(), null);
      }
      if (!targetGroupId) return;

      if (isEditing && dialog.kind === "bookmark" && dialog.mode === "edit") {
        await actions.updateBookmark(dialog.bookmarkId, { name: trimmedName, url: trimmedUrl });
        if (targetGroupId !== dialog.groupId) {
          await actions.moveBookmark(dialog.bookmarkId, targetGroupId);
        }
      } else {
        await actions.addBookmark(targetGroupId, { name: trimmedName, url: trimmedUrl });
      }
      close();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 p-6 pt-2">
      <div className="grid gap-1.5">
        <Label htmlFor="bookmark-name">Name</Label>
        <Input
          id="bookmark-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Github"
          autoFocus
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="bookmark-url">URL</Label>
        <Input
          id="bookmark-url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://github.com"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="bookmark-folder">Folder</Label>
        <select
          id="bookmark-folder"
          value={folderId}
          onChange={(event) => setFolderId(event.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {flatFolders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {"  ".repeat(folder.depth)}
              {folder.title}
            </option>
          ))}
          <option value={NEW_FOLDER_VALUE}>+ Create new folder…</option>
        </select>
      </div>
      {creatingNewFolder ? (
        <div className="grid gap-1.5">
          <Label htmlFor="bookmark-new-folder">New folder name</Label>
          <Input
            id="bookmark-new-folder"
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            placeholder="Work"
          />
        </div>
      ) : null}
      <Button type="submit" disabled={submitting} className="mt-1 rounded-full">
        {isEditing ? "Save changes" : "Add bookmark"}
      </Button>
    </form>
  );
}

function FolderForm({
  dialog,
  flatFolders,
  actions,
  close,
}: {
  dialog: any;
  flatFolders: { id: string; title: string; depth: number }[];
  actions: ReturnType<typeof useBookmarkActions>;
  close: () => void;
}) {
  const [title, setTitle] = React.useState("");
  const [parentId, setParentId] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (dialog.kind !== "folder") return;
    if (dialog.mode === "edit") {
      setTitle(dialog.title);
    } else {
      setTitle("");
      setParentId(dialog.parentId || "");
    }
  }, [dialog]);

  const isEditing = dialog.kind === "folder" && dialog.mode === "edit";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    setSubmitting(true);
    try {
      if (isEditing && dialog.kind === "folder" && dialog.mode === "edit") {
        await actions.renameFolder(dialog.folderId, trimmed);
      } else {
        await actions.addFolder(trimmed, parentId || null);
      }
      close();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 p-6 pt-2">
      <div className="grid gap-1.5">
        <Label htmlFor="folder-title">Folder name</Label>
        <Input
          id="folder-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Work"
          autoFocus
        />
      </div>
      {!isEditing ? (
        <div className="grid gap-1.5">
          <Label htmlFor="folder-parent">Parent folder</Label>
          <select
            id="folder-parent"
            value={parentId}
            onChange={(event) => setParentId(event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <option value="">Top level</option>
            {flatFolders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {"  ".repeat(folder.depth)}
                {folder.title}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <Button type="submit" disabled={submitting} className="mt-1 rounded-full">
        {isEditing ? "Save changes" : "Add folder"}
      </Button>
    </form>
  );
}

export default function BookmarkDialogs() {
  const dialog = useBookmarkDialogStore((state) => state.dialog);
  const close = useBookmarkDialogStore((state) => state.close);
  const bookmarkGroups = useSettingsStore((state) =>
    Array.isArray(state.settings.bookmark) ? state.settings.bookmark : [],
  );
  const actions = useBookmarkActions();
  const flatFolders = React.useMemo(() => flattenGroups(bookmarkGroups), [bookmarkGroups]);

  // Cast rather than rely on control-flow narrowing here — kept loosely typed
  // like the rest of the bookmarks feature (see BookmarkView.tsx).
  const bookmarkDialog: any = dialog.kind === "bookmark" ? dialog : null;
  const folderDialog: any = dialog.kind === "folder" ? dialog : null;
  const isBookmarkOpen = bookmarkDialog !== null;
  const isFolderOpen = folderDialog !== null;

  return (
    <>
      <Dialog open={isBookmarkOpen} onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-w-md gap-0 border-border/60 bg-background/98 text-foreground">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="font-serif text-xl">
              {bookmarkDialog?.mode === "edit" ? "Edit Bookmark" : "Add Bookmark"}
            </DialogTitle>
            <DialogDescription>Save a link into one of your bookmark folders.</DialogDescription>
          </DialogHeader>
          <BookmarkForm dialog={dialog} flatFolders={flatFolders} actions={actions} close={close} />
        </DialogContent>
      </Dialog>

      <Dialog open={isFolderOpen} onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-w-md gap-0 border-border/60 bg-background/98 text-foreground">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="font-serif text-xl">
              {folderDialog?.mode === "edit" ? "Rename Folder" : "New Folder"}
            </DialogTitle>
            <DialogDescription>Folders organize your bookmarks and can be nested.</DialogDescription>
          </DialogHeader>
          <FolderForm dialog={dialog} flatFolders={flatFolders} actions={actions} close={close} />
        </DialogContent>
      </Dialog>
    </>
  );
}
