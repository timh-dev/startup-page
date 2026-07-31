import React from "react";
import { HiOutlineTrash } from "react-icons/hi2";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { generateId } from "@/features/bookmarks/lib/tree";
import { useSettingsStore } from "@/features/settings/stores";
import { useWidgetConfigDialogStore } from "@/features/dashboard/stores/widgetConfigDialogStore";
import { WIDGET_TYPES, getWidgetType } from "@/features/dashboard/widgetRegistry";
import { TILE_SIZE_OPTIONS, type WidgetInstance, type WidgetType, type TileSize } from "@/lib/dashboard-dimensions";

function TypeSelect({
  value,
  onChange,
  id,
}: {
  value: WidgetType;
  onChange: (type: WidgetType) => void;
  id: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value as WidgetType)}
      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      {WIDGET_TYPES.map((def) => (
        <option key={def.type} value={def.type}>{def.label}</option>
      ))}
    </select>
  );
}

function StackItemRow({
  item,
  onChange,
  onRemove,
}: {
  item: WidgetInstance;
  onChange: (next: WidgetInstance) => void;
  onRemove: () => void;
}) {
  const def = getWidgetType(item.type);
  const ConfigFields = def.ConfigFields;

  const changeType = (type: WidgetType) => {
    const nextDef = getWidgetType(type);
    onChange({ ...item, type, config: nextDef.makeDefaultConfig() });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <TypeSelect id={`stack-item-type-${item.id}`} value={item.type} onChange={changeType} />
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive/15 hover:text-destructive"
          aria-label="Remove from stack"
          title="Remove from stack"
        >
          <HiOutlineTrash className="size-4" />
        </button>
      </div>
      {ConfigFields ? (
        <div className="mt-3">
          <ConfigFields config={item.config} onChange={(config) => onChange({ ...item, config })} />
        </div>
      ) : null}
    </div>
  );
}

function makeNewInstance(type: WidgetType, size: TileSize): WidgetInstance {
  const def = getWidgetType(type);
  const instance: WidgetInstance = { id: generateId(), type, size, config: def.makeDefaultConfig() };
  if (type === "stack") instance.items = [];
  return instance;
}

export default function WidgetConfigDialog(): React.ReactElement {
  const dialog = useWidgetConfigDialogStore((state) => state.dialog);
  const close = useWidgetConfigDialogStore((state) => state.close);
  const settings = useSettingsStore((state) => state.settings);
  const persistSettings = useSettingsStore((state) => state.persistSettings);

  const widgets: WidgetInstance[] = Array.isArray(settings.widgets) ? settings.widgets : [];
  let editingWidgetId: string | null = null;
  if (dialog.kind === "edit") {
    editingWidgetId = (dialog as { kind: "edit"; widgetId: string }).widgetId;
  }
  const editingWidget = editingWidgetId ? widgets.find((widget) => widget.id === editingWidgetId) ?? null : null;

  const [draft, setDraft] = React.useState<WidgetInstance | null>(null);

  React.useEffect(() => {
    if (editingWidgetId && editingWidget) {
      setDraft(editingWidget);
    } else if (dialog.kind === "new") {
      setDraft(makeNewInstance("clock", "small"));
    } else {
      setDraft(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingWidgetId, dialog.kind]);

  if (!draft) {
    return <Dialog open={false} onOpenChange={() => close()} />;
  }

  const def = getWidgetType(draft.type);
  const ConfigFields = def.ConfigFields;
  const isNew = dialog.kind === "new";

  const changeType = (type: WidgetType) => {
    const nextDef = getWidgetType(type);
    setDraft((prev) => {
      if (!prev) return prev;
      const next: WidgetInstance = { ...prev, type, config: nextDef.makeDefaultConfig() };
      if (type === "stack") next.items = prev.items || [];
      else delete next.items;
      return next;
    });
  };

  const changeSize = (size: TileSize) => setDraft((prev) => (prev ? { ...prev, size } : prev));
  const changeConfig = (config: Record<string, unknown>) => setDraft((prev) => (prev ? { ...prev, config } : prev));

  const addStackItem = () => {
    setDraft((prev) => {
      if (!prev) return prev;
      const items = [...(prev.items || []), makeNewInstance("headlines", "small")];
      return { ...prev, items };
    });
  };

  const updateStackItem = (itemId: string, next: WidgetInstance) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, items: (prev.items || []).map((item) => (item.id === itemId ? next : item)) };
    });
  };

  const removeStackItem = (itemId: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, items: (prev.items || []).filter((item) => item.id !== itemId) };
    });
  };

  const save = async () => {
    if (!draft) return;
    await persistSettings((prev) => {
      const prevWidgets: WidgetInstance[] = Array.isArray(prev.widgets) ? prev.widgets : [];
      const nextWidgets = isNew
        ? [...prevWidgets, draft]
        : prevWidgets.map((widget) => (widget.id === draft.id ? draft : widget));
      return { ...prev, widgets: nextWidgets };
    });
    close();
  };

  const remove = async () => {
    await persistSettings((prev) => {
      const prevWidgets: WidgetInstance[] = Array.isArray(prev.widgets) ? prev.widgets : [];
      return { ...prev, widgets: prevWidgets.filter((widget) => widget.id !== draft.id) };
    });
    close();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>{isNew ? "Add widget" : "Configure widget"}</DialogTitle>
        </DialogHeader>

        <div className="grid max-h-[70vh] gap-4 overflow-y-auto p-6 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="widget-type">Type</Label>
              <TypeSelect id="widget-type" value={draft.type} onChange={changeType} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="widget-size">Size</Label>
              <select
                id="widget-size"
                value={draft.size}
                onChange={(event) => changeSize(event.target.value as TileSize)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {TILE_SIZE_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>{option.title} ({option.label})</option>
                ))}
              </select>
            </div>
          </div>

          {ConfigFields ? <ConfigFields config={draft.config} onChange={changeConfig} /> : null}

          {draft.type === "stack" ? (
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <Label>Widgets in this stack</Label>
                <Button type="button" size="sm" variant="outline" onClick={addStackItem}>Add item</Button>
              </div>
              {(draft.items || []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No items yet — add at least one to see something here.</p>
              ) : null}
              <div className="grid gap-2">
                {(draft.items || []).map((item) => (
                  <StackItemRow
                    key={item.id}
                    item={item}
                    onChange={(next) => updateStackItem(item.id, next)}
                    onRemove={() => removeStackItem(item.id)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-border/60 p-4">
          {!isNew ? (
            <Button type="button" variant="outline" onClick={remove} className="text-destructive hover:text-destructive">
              <HiOutlineTrash className="mr-1.5 size-4" /> Remove
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="button" onClick={save}>{isNew ? "Add" : "Done"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
