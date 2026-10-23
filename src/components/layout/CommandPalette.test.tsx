import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KBarProvider, useRegisterActions } from "kbar";
import { describe, expect, it, vi } from "vitest";
import CommandPalette from "./CommandPalette";

function Actions({ perform }: { perform: () => void }) {
  useRegisterActions(
    [
      { id: "bookmarks", name: "Open bookmarks", section: "Navigation", perform },
      { id: "vault", name: "Open vault", section: "Navigation", perform: () => {} },
    ],
    [],
  );
  return null;
}

// KBarResults virtualizes its list, which needs real layout; give jsdom one.
Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, get: () => 40 });
Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get: () => 400 });
Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 400 });
Element.prototype.getBoundingClientRect = function () {
  return { x: 0, y: 0, top: 0, left: 0, bottom: 40, right: 400, width: 400, height: 40, toJSON() {} } as DOMRect;
};
// KBarAnimator uses the Web Animations API and ResizeObserver, which jsdom lacks.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
HTMLElement.prototype.animate ??= function () {
  return { finished: Promise.resolve(), cancel() {}, finish() {}, onfinish: null } as unknown as Animation;
};

describe("CommandPalette", () => {
  it("opens with Ctrl/Cmd+K, filters by search and runs the chosen action", async () => {
    const user = userEvent.setup();
    const perform = vi.fn();
    render(
      <KBarProvider>
        <Actions perform={perform} />
        <CommandPalette />
      </KBarProvider>,
    );

    act(() => {
      // kbar binds $mod+K: Meta on macOS, Control elsewhere (jsdom).
      fireEvent.keyDown(window, { key: "k", code: "KeyK", ctrlKey: true });
    });
    const search = await screen.findByRole("combobox");
    await user.type(search, "bookm");

    expect(await screen.findByText("Open bookmarks")).toBeInTheDocument();
    // Search is throttled, so the filtered list settles a moment later.
    await waitFor(() => expect(screen.queryByText("Open vault")).not.toBeInTheDocument());

    await user.keyboard("{Enter}");
    expect(perform).toHaveBeenCalled();
  });
});
