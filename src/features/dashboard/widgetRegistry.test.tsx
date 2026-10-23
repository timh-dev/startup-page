import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { WIDGET_TYPES, getWidgetType } from "./widgetRegistry";

describe("widget registry", () => {
  it("has one definition per widget type", () => {
    const types = WIDGET_TYPES.map((def) => def.type);
    expect(new Set(types).size).toBe(types.length);
    for (const type of types) expect(getWidgetType(type).type).toBe(type);
  });

  it.each(WIDGET_TYPES.filter((def) => def.ConfigFields).map((def) => [def.type, def] as const))(
    "renders the %s config form with its default config",
    (_type, def) => {
      const ConfigFields = def.ConfigFields!;
      const onChange = vi.fn();
      const { container } = render(
        <MemoryRouter>
          <ConfigFields config={def.makeDefaultConfig()} onChange={onChange} />
        </MemoryRouter>,
      );
      expect(container.querySelector("input, select, textarea")).not.toBeNull();
    },
  );
});
