import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import LinksPane from "./links/LinksPane";
import VaultItemsSection from "./VaultItemsSection";

// Signed out: no link previews, so quick-add keeps the title made from the URL.
vi.mock("@/lib/authToken", () => ({ getAuthToken: async () => null }));

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
    ...handlers,
  };
  render(<MemoryRouter><VaultItemsSection {...props} /></MemoryRouter>);
  return props;
}

describe("VaultItemsSection", () => {
  it("adds an item from the composer", async () => {
    const user = userEvent.setup();
    const props = renderItems([]);

    await user.click(screen.getByRole("button", { name: /new snippet/i }));
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

describe("LinksPane", () => {
  function renderLinks(items: unknown[], extra: Record<string, unknown> = {}) {
    const props = {
      items,
      status: "todo" as const,
      tag: null,
      onTag: vi.fn(),
      onAddItem: vi.fn(),
      onDeleteItem: vi.fn(),
      onExportItems: vi.fn(),
      onImportItems: vi.fn(async () => {}),
      onToggleItem: vi.fn(),
      onUpdateItem: vi.fn(),
      ...extra,
    };
    render(<MemoryRouter><LinksPane {...props} /></MemoryRouter>);
    return props;
  }

  it("saves a pasted link straight away, titled from its address", async () => {
    const user = userEvent.setup();
    const props = renderLinks([]);

    await user.type(screen.getByRole("textbox", { name: "Add a link" }), "example.com/how-clouds-work{Enter}");

    expect(props.onAddItem).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://example.com/how-clouds-work", title: "How clouds work · example.com", tag: "Read" }),
    );
  });

  it("saves plain text as a title, with the filtered tag", async () => {
    const user = userEvent.setup();
    const props = renderLinks([], { tag: "Watch" });

    await user.type(screen.getByRole("textbox", { name: "Add a link" }), "That talk on sky rendering{Enter}");

    expect(props.onAddItem).toHaveBeenCalledWith(expect.objectContaining({ title: "That talk on sky rendering", url: "", tag: "Watch" }));
  });

  it("adds a link with details and the picked tag, and keeps that tag for the next one", async () => {
    const user = userEvent.setup();
    const props = renderLinks([]);

    await user.click(screen.getByRole("button", { name: /details/i }));
    await user.type(screen.getByPlaceholderText("Title"), "Docs");
    await user.click(screen.getByRole("button", { expanded: false, name: "" }));
    const listbox = screen.getByRole("listbox", { name: "Choose tag" });
    const [, secondTag] = Array.from(listbox.querySelectorAll('[role="option"]'));
    const tagName = secondTag.textContent!.replace(/\d+$/, "");
    await user.click(secondTag);
    await user.click(screen.getByRole("button", { name: "Add resource" }));

    expect(props.onAddItem).toHaveBeenCalledWith(expect.objectContaining({ title: "Docs", tag: tagName }));

    await user.click(screen.getByRole("button", { name: /details/i }));
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

  it("checks a link off", async () => {
    const user = userEvent.setup();
    const props = renderLinks([{ id: "l1", title: "Read me", url: "https://example.com", tag: "Read", status: "todo", createdAt: "2026-10-01T00:00:00.000Z" }]);

    await user.click(screen.getByRole("checkbox", { name: /mark "read me" done/i }));
    expect(props.onToggleItem).toHaveBeenCalledWith("l1");
  });
});
