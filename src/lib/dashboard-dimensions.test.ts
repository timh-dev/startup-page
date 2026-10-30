import { describe, expect, it } from "vitest";
import { updateWidgetConfig, type WidgetInstance } from "./dashboard-dimensions";

function widget(id: string, overrides: Partial<WidgetInstance> = {}): WidgetInstance {
  return { id, type: "clock", size: "small", config: {}, ...overrides };
}

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
