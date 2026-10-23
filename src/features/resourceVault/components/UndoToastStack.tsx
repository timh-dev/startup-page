import type { UndoToast } from "@/features/resourceVault/hooks/useUndoableDelete";

export default function UndoToastStack({ toasts, onUndo }: { toasts: UndoToast[]; onUndo: (id: string) => void }) {
  if (!toasts.length) {
    return null;
  }

  return (
    <div className="vg-toast-stack">
      {toasts.map((toast) => (
        <div key={toast.id} className="vg-toast">
          <span className="vg-toast-text">Deleted "{toast.title}"</span>
          <button type="button" className="vg-toast-undo" onClick={() => onUndo(toast.id)}>
            Undo
          </button>
        </div>
      ))}
    </div>
  );
}
