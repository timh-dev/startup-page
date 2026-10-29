import { HiArrowUturnLeft, HiOutlinePlus } from "react-icons/hi2";

import { useSidePanelStore } from "@/components/layout/sidePanelStore";
import { useLayoutEditStore } from "@/features/dashboard/stores/layoutEditStore";
import { useSettingsStore } from "@/features/settings/stores";
import { cloneWidgets, DEFAULT_WIDGETS, resolveBookmarkPlaceholders } from "@/lib/dashboard-dimensions";

/** The bar across the top in edit mode: add, undo, reset, done. */
export default function EditBar({ flow, onUndo }: { flow: boolean; onUndo: () => void }) {
  const setEditing = useLayoutEditStore((state) => state.setEditing);
  const canUndo = useLayoutEditStore((state) => state.history.length > 0);
  const pushHistory = useLayoutEditStore((state) => state.pushHistory);
  const openPanel = useSidePanelStore((state) => state.open);
  const persistSettings = useSettingsStore((state) => state.persistSettings);

  const reset = () => {
    void persistSettings((prev) => {
      pushHistory(Array.isArray(prev.widgets) ? prev.widgets : []);
      const bookmarkGroups = Array.isArray(prev.bookmark) ? prev.bookmark : [];
      return { ...prev, widgets: resolveBookmarkPlaceholders(cloneWidgets(DEFAULT_WIDGETS), bookmarkGroups) };
    });
  };

  return (
    <div className="edit-bar surface-glass" role="toolbar" aria-label="Edit dashboard">
      <span className="edit-bar-title">Editing</span>
      <span className="edit-bar-hint">
        {flow ? "Widen the window to move and resize cards" : "Drag to move · drag a corner to resize · click to edit"}
      </span>
      <button type="button" className="edit-bar-button" data-primary onClick={() => openPanel({ kind: "gallery" })}>
        <HiOutlinePlus className="size-3.5" /> Add
      </button>
      <button type="button" className="edit-bar-button" onClick={onUndo} disabled={!canUndo} title="Undo (⌘Z)" aria-label="Undo">
        <HiArrowUturnLeft className="size-3.5" />
      </button>
      <button type="button" className="edit-bar-button" onClick={reset}>
        Reset
      </button>
      <button type="button" className="edit-bar-button" data-strong onClick={() => setEditing(false)}>
        Done
      </button>
    </div>
  );
}
