import { HiArrowUturnLeft, HiOutlinePlus } from "react-icons/hi2";

import { useSidePanelStore } from "@/components/layout/sidePanelStore";
import { useLayoutEditStore } from "@/features/dashboard/stores/layoutEditStore";
import { DEFAULT_SCENE, getScene, sceneLayout, sceneWidgets } from "@/features/scenes/scenes";
import { MAIN_DASHBOARD, copyDashboard } from "@/features/dashboard/dashboards";
import { DashboardMenu } from "@/features/dashboard/components/DashboardMenu";
import { persistDashboard, useActiveDashboardId } from "@/features/dashboard/useDashboard";

/** The bar across the top in edit mode: add, undo, reset, done. */
export default function EditBar({ flow, onUndo }: { flow: boolean; onUndo: () => void }) {
  const setEditing = useLayoutEditStore((state) => state.setEditing);
  const canUndo = useLayoutEditStore((state) => state.history.length > 0);
  const pushHistory = useLayoutEditStore((state) => state.pushHistory);
  const openPanel = useSidePanelStore((state) => state.open);
  const dashboardId = useActiveDashboardId();

  // Back to the theme's own layout (the default one for Desert).
  const reset = () => {
    void persistDashboard(dashboardId, ({ widgets }, settings) => {
      pushHistory(widgets);
      const scene = getScene(settings.ui?.scene) ?? getScene(DEFAULT_SCENE)!;
      const folderIds = (Array.isArray(settings.bookmark) ? settings.bookmark : []).map((group: { id?: string }) => group?.id).filter(Boolean) as string[];
      const cards = sceneWidgets(scene, folderIds);
      const data = { widgets: cards, ...sceneLayout(scene, cards) };
      // Other dashboards get their own card ids.
      return dashboardId === MAIN_DASHBOARD ? data : copyDashboard(data);
    });
  };

  return (
    <div className="edit-bar surface-glass" role="toolbar" aria-label="Edit dashboard">
      <span className="edit-bar-title">Editing</span>
      <DashboardMenu variant="edit" />
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
