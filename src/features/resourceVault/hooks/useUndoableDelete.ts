import React from "react";

const UNDO_DELETE_DELAY_MS = 5000;

export interface UndoToast {
  id: string;
  title: string;
}

/**
 * Deletes after a delay, during which the item is hidden and an "Undo" toast
 * is shown. Pending timers are cleared on unmount so a delete can't fire
 * after the view is gone.
 */
export function useUndoableDelete(onDelete: (id: string) => void) {
  const [pendingIds, setPendingIds] = React.useState<Set<string>>(new Set());
  const [toasts, setToasts] = React.useState<UndoToast[]>([]);
  const timersRef = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const onDeleteRef = React.useRef(onDelete);
  onDeleteRef.current = onDelete;

  React.useEffect(() => {
    const timers = timersRef.current;
    return () => Object.values(timers).forEach(clearTimeout);
  }, []);

  const settle = (id: string) => {
    delete timersRef.current[id];
    setToasts((current) => current.filter((toast) => toast.id !== id));
    setPendingIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  const deleteWithUndo = (id: string, title: string) => {
    setPendingIds((current) => new Set(current).add(id));
    setToasts((current) => [...current, { id, title }]);
    timersRef.current[id] = setTimeout(() => {
      settle(id);
      onDeleteRef.current(id);
    }, UNDO_DELETE_DELAY_MS);
  };

  const undo = (id: string) => {
    clearTimeout(timersRef.current[id]);
    settle(id);
  };

  return { pendingIds, toasts, deleteWithUndo, undo };
}
