import { describe, expect, it } from "vitest";
import {
  DEFAULT_WIDGETS,
  cloneWidgets,
  resolveBookmarkPlaceholders,
  updateWidgetConfig,
  type WidgetInstance,
} from "./dashboard-dimensions";

function widget(id: string, overrides: Partial<WidgetInstance> = {}): WidgetInstance {
  return { id, type: "clock", size: "small", config: {}, ...overrides };
}

describe("cloneWidgets", () => {
  it("produces a deep copy that doesn't alias the original", () => {
    const original = [widget("a", { config: { nested: { value: 1 } } })];
    const cloned = cloneWidgets(original);
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned[0]).not.toBe(original[0]);
    (cloned[0].config as any).nested.value = 2;
    expect((original[0].config as any).nested.value).toBe(1);
  });
});

describe("updateWidgetConfig", () => {
  it("patches a top-level widget's config by id", () => {
    const widgets = [widget("a", { config: { focusMinutes: 25 } }), widget("b")];
    const result = updateWidgetConfig(widgets, "a", { focusMinutes: 50 });
    expect(result[0].config).toEqual({ focusMinutes: 50 });
    expect(result[1]).toBe(widgets[1]); // untouched widget keeps its reference
  });

  it("reaches one level into a stack's items", () => {
    const nested = widget("nested-timer", { config: { focusMinutes: 25 } });
    const widgets = [widget("stack1", { type: "stack", items: [nested] })];
    const result = updateWidgetConfig(widgets, "nested-timer", { focusMinutes: 50 });
    expect(result[0].items?.[0].config).toEqual({ focusMinutes: 50 });
  });

  it("is a no-op (structurally) when the id isn't found anywhere", () => {
    const widgets = [widget("a")];
    const result = updateWidgetConfig(widgets, "missing", { x: 1 });
    expect(result).toEqual(widgets);
  });
});

describe("resolveBookmarkPlaceholders", () => {
  it("assigns bookmark groups in order to every bookmark widget with a null groupId", () => {
    const widgets = [
      widget("b1", { type: "bookmark", config: { groupId: null } }),
      widget("b2", { type: "bookmark", config: { groupId: null } }),
    ];
    const result = resolveBookmarkPlaceholders(widgets, [{ id: "g1" }, { id: "g2" }]);
    expect(result[0].config.groupId).toBe("g1");
    expect(result[1].config.groupId).toBe("g2");
  });

  it("leaves a bookmark widget with an existing groupId untouched", () => {
    const widgets = [widget("b1", { type: "bookmark", config: { groupId: "already-set" } })];
    const result = resolveBookmarkPlaceholders(widgets, [{ id: "g1" }]);
    expect(result[0].config.groupId).toBe("already-set");
  });

  it("falls back to the first group once it runs out of groups to assign", () => {
    const widgets = [
      widget("b1", { type: "bookmark", config: { groupId: null } }),
      widget("b2", { type: "bookmark", config: { groupId: null } }),
    ];
    const result = resolveBookmarkPlaceholders(widgets, [{ id: "only-group" }]);
    expect(result[0].config.groupId).toBe("only-group");
    expect(result[1].config.groupId).toBe("only-group");
  });

  it("resolves to null when there are no bookmark groups at all", () => {
    const widgets = [widget("b1", { type: "bookmark", config: { groupId: null } })];
    expect(resolveBookmarkPlaceholders(widgets, []).map((w) => w.config.groupId)).toEqual([null]);
  });

  it("reaches into a stack's items, continuing the same running index across top-level and nested bookmarks", () => {
    const widgets = [
      widget("b1", { type: "bookmark", config: { groupId: null } }),
      widget("stack1", {
        type: "stack",
        items: [widget("b2", { type: "bookmark", config: { groupId: null } })],
      }),
    ];
    const result = resolveBookmarkPlaceholders(widgets, [{ id: "g1" }, { id: "g2" }]);
    expect(result[0].config.groupId).toBe("g1");
    expect(result[1].items?.[0].config.groupId).toBe("g2");
  });
});

describe("DEFAULT_WIDGETS", () => {
  it("has stable, unique ids", () => {
    const ids = new Set<string>();
    const walk = (widgets: WidgetInstance[]) => {
      for (const w of widgets) {
        expect(ids.has(w.id)).toBe(false);
        ids.add(w.id);
        if (w.items) walk(w.items);
      }
    };
    walk(DEFAULT_WIDGETS);
  });

  it("only gives `items` to stack widgets", () => {
    for (const w of DEFAULT_WIDGETS) {
      if (w.type !== "stack") expect(w.items).toBeUndefined();
    }
  });
});
