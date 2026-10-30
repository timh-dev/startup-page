import { useSettingsStore } from "@/features/settings/stores";
import BookmarkView from "@/features/bookmarks/components/BookmarkView";

export default function BookmarksPage() {
  const bookmark = useSettingsStore((state) => state.settings.bookmark);
  return <BookmarkView bookmarks={Array.isArray(bookmark) ? bookmark : []} />;
}
