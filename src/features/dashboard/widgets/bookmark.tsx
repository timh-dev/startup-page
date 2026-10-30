import { useNavigate } from "react-router-dom";
import { HiOutlineBookmark } from "react-icons/hi2";
import { Label } from "@/components/ui/label";
import Bookmark from "@/features/bookmarks/components/Bookmark";
import { useBookmarkDialogStore } from "@/features/bookmarks/stores/bookmarkDialogStore";
import { useSettingsStore } from "@/features/settings/stores";
import { readSettings } from "@/lib/settings";
import { defineWidget, type WidgetRenderProps } from "./types";

interface BookmarkConfig {
  groupId?: string | null;
}

function BookmarkRender({ instance, cardClass }: WidgetRenderProps) {
  const bookmarkGroups = useSettingsStore((state) => (Array.isArray(state.settings.bookmark) ? state.settings.bookmark : []));
  const navigate = useNavigate();
  const openAddBookmarkDialog = useBookmarkDialogStore((state) => state.openAddBookmark);
  const groupId = (instance.config as BookmarkConfig).groupId;
  const group = bookmarkGroups.find((candidate: any) => candidate.id === groupId) || { id: null, title: "", content: [] };

  return (
    <Bookmark
      title={group.title}
      content={group.content}
      cardClass={cardClass}
      onTitleClick={group.id ? () => {
        window.localStorage?.setItem("startup-page.active-bookmark-category", group.id);
        navigate("/bookmarks");
      } : undefined}
      onQuickAdd={group.id ? () => openAddBookmarkDialog(group.id) : undefined}
    />
  );
}

function BookmarkConfigFields({ config, onChange }: { config: BookmarkConfig; onChange: (next: BookmarkConfig) => void }) {
  const bookmarkGroups = useSettingsStore((state) => (Array.isArray(state.settings.bookmark) ? state.settings.bookmark : []));
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="bookmark-group">Folder</Label>
      <select
        id="bookmark-group"
        value={config.groupId || ""}
        onChange={(event) => onChange({ ...config, groupId: event.target.value || null })}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <option value="">Select a folder…</option>
        {bookmarkGroups.map((group: any) => (
          <option key={group.id} value={group.id}>{group.title}</option>
        ))}
      </select>
    </div>
  );
}

export const bookmarkWidget = defineWidget<BookmarkConfig>({
  type: "bookmark",
  label: "Bookmark folder",
  icon: HiOutlineBookmark,
  defaultSize: "small",
  makeDefaultConfig: () => ({ groupId: readSettings().bookmark?.[0]?.id ?? null }),
  Render: BookmarkRender,
  ConfigFields: BookmarkConfigFields,
});
