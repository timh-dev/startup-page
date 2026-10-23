import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import VaultGlassView from "./VaultGlassView";
import VaultItemsSection from "./VaultItemsSection";

afterEach(() => {
  vi.useRealTimers();
});

function renderItems(items: unknown[], handlers: Partial<Parameters<typeof VaultItemsSection>[0]> = {}) {
  const props = {
    kind: "code" as const,
    items,
    onAddItem: vi.fn(),
    onUpdateItem: vi.fn(),
    onDeleteItem: vi.fn(),
    onExportItems: vi.fn(),
    onImportItems: vi.fn(async () => {}),
    onBack: vi.fn(),
    ...handlers,
  };
  render(<MemoryRouter><VaultItemsSection {...props} /></MemoryRouter>);
  return props;
}

describe("VaultItemsSection", () => {
  it("adds an item from the composer", async () => {
    const user = userEvent.setup();
    const props = renderItems([]);

    await user.click(screen.getByRole("button", { name: /add a code/i }));
    await user.type(screen.getByPlaceholderText("Title"), "List files");
    await user.type(screen.getByPlaceholderText(/paste a snippet/i), "ls -la");
    await user.click(screen.getByRole("button", { name: "Add item" }));

    expect(props.onAddItem).toHaveBeenCalledWith(expect.objectContaining({ kind: "code", title: "List files", body: "ls -la" }));
    expect(screen.queryByPlaceholderText("Title")).not.toBeInTheDocument();
  });

  it("opens the composer pre-filled when editing", async () => {
    const user = userEvent.setup();
    const props = renderItems([{ id: "a", kind: "code", title: "Old title", body: "echo hi", language: "bash" }]);

    await user.click(screen.getByTitle("Edit item"));
    const title = screen.getByPlaceholderText("Title");
    expect(title).toHaveValue("Old title");

    await user.clear(title);
    await user.type(title, "New title");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(props.onUpdateItem).toHaveBeenCalledWith("a", expect.objectContaining({ title: "New title", language: "bash" }));
  });

  it("hides a deleted item, and Undo restores it without deleting", () => {
    vi.useFakeTimers();
    const props = renderItems([{ id: "a", kind: "code", title: "Keep me", body: "x" }]);

    fireEvent.click(screen.getByTitle("Delete item"));
    expect(screen.queryByText("Keep me")).not.toBeInTheDocument();
    expect(screen.getByText('Deleted "Keep me"')).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByText("Keep me")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(10_000));
    expect(props.onDeleteItem).not.toHaveBeenCalled();
  });

  it("deletes for real once the undo window passes", () => {
    vi.useFakeTimers();
    const props = renderItems([{ id: "a", kind: "code", title: "Remove me", body: "x" }]);

    fireEvent.click(screen.getByTitle("Delete item"));
    act(() => vi.advanceTimersByTime(5_000));

    expect(props.onDeleteItem).toHaveBeenCalledWith("a");
    expect(screen.queryByText('Deleted "Remove me"')).not.toBeInTheDocument();
  });
});

describe("VaultGlassView (links)", () => {
  function renderLinks(items: unknown[]) {
    const props = {
      items,
      onAddItem: vi.fn(),
      onBack: vi.fn(),
      onDeleteItem: vi.fn(),
      onExportItems: vi.fn(),
      onImportItems: vi.fn(async () => {}),
      onToggleItem: vi.fn(),
      onUpdateItem: vi.fn(),
    };
    render(<MemoryRouter><VaultGlassView {...props} /></MemoryRouter>);
    return props;
  }

  it("adds a link with the picked tag, and keeps that tag for the next one", async () => {
    const user = userEvent.setup();
    const props = renderLinks([]);

    await user.click(screen.getByRole("button", { name: /add a resource/i }));
    await user.type(screen.getByPlaceholderText("Title"), "Docs");
    await user.click(screen.getByRole("button", { expanded: false, name: "" }));
    const listbox = screen.getByRole("listbox", { name: "Choose tag" });
    const [, secondTag] = Array.from(listbox.querySelectorAll('[role="option"]'));
    const tagName = secondTag.textContent!.replace(/\d+$/, "");
    await user.click(secondTag);
    await user.click(screen.getByRole("button", { name: "Add resource" }));

    expect(props.onAddItem).toHaveBeenCalledWith(expect.objectContaining({ title: "Docs", tag: tagName }));

    await user.click(screen.getByRole("button", { name: /add a resource/i }));
    await user.type(screen.getByPlaceholderText("Title"), "More docs");
    await user.click(screen.getByRole("button", { name: "Add resource" }));
    expect(props.onAddItem).toHaveBeenLastCalledWith(expect.objectContaining({ title: "More docs", tag: tagName }));
  });

  it("edits a link in place", async () => {
    const user = userEvent.setup();
    const props = renderLinks([{ id: "l1", title: "Old", url: "https://example.com", tag: "Read", status: "todo", createdAt: "2026-10-01T00:00:00.000Z" }]);

    await user.click(screen.getByTitle("Edit item"));
    expect(screen.getByPlaceholderText("Title")).toHaveValue("Old");
    await user.clear(screen.getByPlaceholderText("Title"));
    await user.type(screen.getByPlaceholderText("Title"), "New");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(props.onUpdateItem).toHaveBeenCalledWith("l1", expect.objectContaining({ title: "New", tag: "Read", url: "https://example.com" }));
  });
});
