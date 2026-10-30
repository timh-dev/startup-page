import React from "react";
import { HiOutlinePlus, HiOutlineTrash } from "react-icons/hi2";

import { PanelFrame } from "@/components/layout/SidePanel";
import { useSidePanelStore } from "@/components/layout/sidePanelStore";
import { Label } from "@/components/ui/label";
import { generateId } from "@/features/bookmarks/lib/tree";
import { SegmentedControl } from "@/features/settings/components/controls";
import { WIDGET_TYPES, getWidgetType } from "@/features/dashboard/widgetRegistry";
import { WIDGET_CATALOG } from "@/features/dashboard/widgetCatalog";
import { useLayoutEditStore } from "@/features/dashboard/stores/layoutEditStore";
import { DEFAULT_COLUMNS, MAX_ROWS, MIN_ROWS, PAGE_ROWS, SIZE_CELLS, applyLayout, cellsFor, placeTile, resolveLayout } from "@/features/dashboard/layout/grid";
import { persistDashboard, useActiveDashboard } from "@/features/dashboard/useDashboard";
import { TILE_SIZE_OPTIONS, type TileSize, type WidgetInstance, type WidgetType } from "@/lib/dashboard-dimensions";

const SAVE_DELAY_MS = 350;

/**
 * A card's settings, beside the dashboard. Changes apply as you make them
 * (text fields save a moment after you stop typing); Undo in the edit bar
 * steps back through them.
 */
export default function WidgetInspector({ id }: { id: string }) {
  const dashboard = useActiveDashboard();
  const dashboardId = dashboard.id;
  const widgets = dashboard.widgets;
  const columns = Number(dashboard.columns) || DEFAULT_COLUMNS;
  const pageRows = Math.max(MIN_ROWS, Math.min(MAX_ROWS, Number(dashboard.rows) || PAGE_ROWS));
  const pushHistory = useLayoutEditStore((state) => state.pushHistory);
  const select = useLayoutEditStore((state) => state.select);
  const close = useSidePanelStore((state) => state.close);
  const saved = widgets.find((widget) => widget.id === id) ?? null;

  // A local copy, so typing stays instant while saves are batched.
  const [draft, setDraft] = React.useState<WidgetInstance | null>(saved);
  const timer = React.useRef<number>(0);
  const recorded = React.useRef(false);
  React.useEffect(() => {
    setDraft(saved);
    recorded.current = false;
    // Only when switching cards: later saves come from this panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const save = React.useCallback(
    (next: WidgetInstance, immediate = false) => {
      setDraft(next);
      window.clearTimeout(timer.current);
      const write = () => {
        void persistDashboard(dashboardId, ({ widgets: list }) => {
          // One undo step per inspector visit, not per keystroke.
          if (!recorded.current) {
            pushHistory(list);
            recorded.current = true;
          }
          return { widgets: list.map((widget) => (widget.id === next.id ? { ...next, pos: widget.pos } : widget)) };
        });
      };
      if (immediate) write();
      else timer.current = window.setTimeout(write, SAVE_DELAY_MS);
    },
    [dashboardId, pushHistory],
  );
  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  if (!saved || !draft) {
    return (
      <PanelFrame title="Widget removed">
        <p className="side-panel-note">This card is no longer on the dashboard.</p>
      </PanelFrame>
    );
  }

  const def = getWidgetType(draft.type);
  const ConfigFields = def.ConfigFields;
  const allowed = def.allowedSizes ?? TILE_SIZE_OPTIONS.map((option) => option.key);

  const resize = (size: TileSize) => {
    const base = resolveLayout(widgets, columns, pageRows);
    const from = base.get(id)!;
    const layout = placeTile(base, id, from, cellsFor(size), columns, pageRows);
    pushHistory(widgets);
    setDraft({ ...draft, size });
    void persistDashboard(dashboardId, ({ widgets: list }) => ({ widgets: applyLayout(list.map((w) => (w.id === id ? { ...w, size } : w)), layout) }));
  };

  const remove = () => {
    pushHistory(widgets);
    void persistDashboard(dashboardId, ({ widgets: list }) => ({ widgets: list.filter((w) => w.id !== id) }));
    select(null);
    close();
  };

  return (
    <PanelFrame
      title={def.label}
      subtitle={WIDGET_CATALOG[draft.type]?.description}
      icon={<def.icon className="size-4" />}
      footer={
        <>
          <button type="button" className="side-panel-danger" onClick={remove}>
            <HiOutlineTrash className="size-4" /> Remove
          </button>
          <button type="button" className="side-panel-done" onClick={close}>
            Done
          </button>
        </>
      }
    >
      {allowed.length > 1 && (
        <div className="inspector-field">
          <Label>Size</Label>
          <SegmentedControl
            label="Size"
            value={draft.size}
            onChange={resize}
            options={TILE_SIZE_OPTIONS.filter((option) => allowed.includes(option.key)).map((option) => ({
              value: option.key,
              label: `${SIZE_CELLS[option.key].w}×${SIZE_CELLS[option.key].h}`,
            }))}
          />
        </div>
      )}

      {ConfigFields ? (
        <div className="inspector-fields">
          <ConfigFields config={draft.config} onChange={(config) => save({ ...draft, config })} />
        </div>
      ) : draft.type !== "stack" ? (
        <p className="side-panel-note">Nothing to set up for this widget.</p>
      ) : null}

      {draft.type === "stack" && <StackItems draft={draft} onChange={(next) => save(next)} />}
    </PanelFrame>
  );
}

function makeInstance(type: WidgetType): WidgetInstance {
  const def = getWidgetType(type);
  return { id: generateId(), type, size: "small", config: def.makeDefaultConfig() };
}

/** The widgets inside a stack: pick each one's type and set it up. */
function StackItems({ draft, onChange }: { draft: WidgetInstance; onChange: (next: WidgetInstance) => void }) {
  const items = draft.items || [];
  const update = (itemId: string, next: WidgetInstance) => onChange({ ...draft, items: items.map((item) => (item.id === itemId ? next : item)) });
  return (
    <div className="inspector-stack">
      <div className="inspector-stack-head">
        <Label>In this stack</Label>
        <button type="button" className="side-panel-chip" onClick={() => onChange({ ...draft, items: [...items, makeInstance("headlines")] })}>
          <HiOutlinePlus className="size-3.5" /> Add
        </button>
      </div>
      {!items.length && <p className="side-panel-note">Add at least one widget to swipe between.</p>}
      {items.map((item) => {
        const itemDef = getWidgetType(item.type);
        const Fields = itemDef.ConfigFields;
        return (
          <div key={item.id} className="inspector-stack-item">
            <div className="flex items-center gap-2">
              <select
                className="inspector-select"
                value={item.type}
                onChange={(event) => update(item.id, { ...makeInstance(event.target.value as WidgetType), id: item.id })}
                aria-label="Widget type"
              >
                {WIDGET_TYPES.filter((d) => d.type !== "stack").map((d) => (
                  <option key={d.type} value={d.type}>
                    {d.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="side-panel-icon-button"
                onClick={() => onChange({ ...draft, items: items.filter((i) => i.id !== item.id) })}
                aria-label={`Remove ${itemDef.label} from the stack`}
              >
                <HiOutlineTrash className="size-4" />
              </button>
            </div>
            {Fields && (
              <div className="mt-3">
                <Fields config={item.config} onChange={(config) => update(item.id, { ...item, config })} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
