import { describe, expect, it } from "vitest";
import {
  addBookmarkToGroup,
  addGroup,
  countBookmarksInGroup,
  ensureBookmarkIds,
  findBookmarkGroup,
  findGroup,
  findGroupWithParent,
  flattenGroups,
  generateId,
  moveBookmark,
  moveSibling,
  removeBookmark,
  removeGroup,
  reorderFolder,
  reorderSibling,
  updateBookmark,
  updateGroup,
} from "./tree";

function folder(id: string, overrides: Record<string, unknown> = {}) {
  return { id, title: id, content: [], children: [], ...overrides };
}

describe("generateId", () => {
  it("produces unique, non-empty ids", () => {
    const a = generateId();
    const b = generateId();
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
  });
});

describe("countBookmarksInGroup", () => {
  it("counts direct content and recurses into children", () => {
    const group = folder("root", {
      content: [{ id: "b1" }, { id: "b2" }],
      children: [folder("child", { content: [{ id: "b3" }] })],
    });
    expect(countBookmarksInGroup(group)).toBe(3);
  });

  it("handles a group with no content/children gracefully", () => {
    expect(countBookmarksInGroup({})).toBe(0);
    expect(countBookmarksInGroup(null)).toBe(0);
  });
});

describe("ensureBookmarkIds", () => {
  it("returns the same array reference when every group/bookmark already has an id", () => {
    const groups = [folder("g1", { content: [{ id: "b1", name: "x", url: "https://x" }] })];
    expect(ensureBookmarkIds(groups)).toBe(groups);
  });

  it("backfills a missing group id without touching an already-id'd sibling", () => {
    const withId = folder("g1");
    const groups = [withId, { title: "no id", content: [], children: [] }];
    const result = ensureBookmarkIds(groups);
    expect(result[0]).toBe(withId);
    expect(result[1].id).toBeTruthy();
  });

  it("backfills missing bookmark ids inside a group's content", () => {
    const groups = [folder("g1", { content: [{ name: "x", url: "https://x" }] })];
    const result = ensureBookmarkIds(groups);
    expect(result[0].content[0].id).toBeTruthy();
  });

  it("recurses into nested children", () => {
    const groups = [folder("g1", { children: [{ title: "nested", content: [], children: [] }] })];
    const result = ensureBookmarkIds(groups);
    expect(result[0].children[0].id).toBeTruthy();
  });

  it("replaces a non-object entry with a placeholder folder", () => {
    const result = ensureBookmarkIds([null]);
    expect(result[0].id).toBeTruthy();
    expect(result[0].title).toBe("Untitled");
  });

  it("returns an empty array for non-array input", () => {
    expect(ensureBookmarkIds(null)).toEqual([]);
    expect(ensureBookmarkIds("nope")).toEqual([]);
  });
});

describe("findGroup / findGroupWithParent", () => {
  const tree = [folder("a", { children: [folder("a1"), folder("a2")] }), folder("b")];

  it("finds a top-level group", () => {
    expect(findGroup(tree, "b")?.id).toBe("b");
  });

  it("finds a nested group", () => {
    expect(findGroup(tree, "a1")?.id).toBe("a1");
  });

  it("returns null for an unknown id", () => {
    expect(findGroup(tree, "missing")).toBeNull();
  });

  it("reports the correct parent and sibling list for a nested group", () => {
    const located = findGroupWithParent(tree, "a2");
    expect(located?.parent?.id).toBe("a");
    expect(located?.siblings.map((g: any) => g.id)).toEqual(["a1", "a2"]);
  });

  it("reports a null parent for a top-level group", () => {
    const located = findGroupWithParent(tree, "b");
    expect(located?.parent).toBeNull();
  });
});

describe("findBookmarkGroup", () => {
  it("finds the group owning a bookmark, including nested groups", () => {
    const tree = [
      folder("a", { children: [folder("a1", { content: [{ id: "bm1" }] })] }),
    ];
    expect(findBookmarkGroup(tree, "bm1")?.id).toBe("a1");
  });

  it("returns null when no group has the bookmark", () => {
    expect(findBookmarkGroup([folder("a")], "missing")).toBeNull();
  });
});

describe("updateGroup / removeGroup / addGroup", () => {
  it("updateGroup rewrites only the matched group and its ancestors", () => {
    const untouched = folder("b");
    const tree = [folder("a", { children: [folder("a1")] }), untouched];
    const result = updateGroup(tree, "a1", (g) => ({ ...g, title: "renamed" }));
    expect(result[0].children[0].title).toBe("renamed");
    // Sibling branch keeps its original reference (no unnecessary clone).
    expect(result[1]).toBe(untouched);
  });

  it("removeGroup drops a top-level group", () => {
    const result = removeGroup([folder("a"), folder("b")], "a");
    expect(result.map((g: any) => g.id)).toEqual(["b"]);
  });

  it("removeGroup drops a nested group without touching its parent's identity unnecessarily", () => {
    const result = removeGroup([folder("a", { children: [folder("a1"), folder("a2")] })], "a1");
    expect(result[0].children.map((g: any) => g.id)).toEqual(["a2"]);
  });

  it("addGroup appends to the top level when parentId is null", () => {
    const result = addGroup([folder("a")], folder("b"), null);
    expect(result.map((g: any) => g.id)).toEqual(["a", "b"]);
  });

  it("addGroup nests under the given parent", () => {
    const result = addGroup([folder("a")], folder("child"), "a");
    expect(result[0].children.map((g: any) => g.id)).toEqual(["child"]);
  });
});

describe("moveSibling / reorderSibling / reorderFolder", () => {
  it("moveSibling swaps a group with its previous sibling", () => {
    const result = moveSibling([folder("a"), folder("b"), folder("c")], "b", -1);
    expect(result.map((g: any) => g.id)).toEqual(["b", "a", "c"]);
  });

  it("moveSibling is a no-op past either edge", () => {
    const tree = [folder("a"), folder("b")];
    expect(moveSibling(tree, "a", -1)).toBe(tree);
    expect(moveSibling(tree, "b", 1)).toBe(tree);
  });

  it("moveSibling works on a nested sibling list", () => {
    const tree = [folder("a", { children: [folder("a1"), folder("a2")] })];
    const result = moveSibling(tree, "a2", -1);
    expect(result[0].children.map((g: any) => g.id)).toEqual(["a2", "a1"]);
  });

  it("reorderSibling places a group at an arbitrary index within its own sibling list", () => {
    const result = reorderSibling([folder("a"), folder("b"), folder("c")], "c", 0);
    expect(result.map((g: any) => g.id)).toEqual(["c", "a", "b"]);
  });

  it("reorderFolder reorders top-level folders and no-ops on an invalid range", () => {
    const tree = [folder("a"), folder("b"), folder("c")];
    expect(reorderFolder(tree, 0, 2).map((g: any) => g.id)).toEqual(["b", "c", "a"]);
    expect(reorderFolder(tree, 0, 0)).toBe(tree);
    expect(reorderFolder(tree, -1, 1)).toBe(tree);
  });
});

describe("addBookmarkToGroup / updateBookmark / removeBookmark / moveBookmark", () => {
  it("addBookmarkToGroup appends and backfills an id when missing", () => {
    const result = addBookmarkToGroup([folder("a")], "a", { name: "x", url: "https://x" });
    expect(result[0].content).toHaveLength(1);
    expect(result[0].content[0].id).toBeTruthy();
  });

  it("updateBookmark patches a bookmark in place without changing its id", () => {
    const tree = [folder("a", { content: [{ id: "bm1", name: "old", url: "https://x" }] })];
    const result = updateBookmark(tree, "bm1", { name: "new" });
    expect(result[0].content[0]).toEqual({ id: "bm1", name: "new", url: "https://x" });
  });

  it("removeBookmark drops the bookmark from its owning group", () => {
    const tree = [folder("a", { content: [{ id: "bm1" }, { id: "bm2" }] })];
    const result = removeBookmark(tree, "bm1");
    expect(result[0].content.map((b: any) => b.id)).toEqual(["bm2"]);
  });

  it("moveBookmark relocates a bookmark to a different folder", () => {
    const tree = [
      folder("a", { content: [{ id: "bm1", name: "x", url: "https://x" }] }),
      folder("b"),
    ];
    const result = moveBookmark(tree, "bm1", "b");
    expect(result[0].content).toEqual([]);
    expect(result[1].content.map((b: any) => b.id)).toEqual(["bm1"]);
  });

  it("moveBookmark reorders within the same folder when toGroupId is unchanged", () => {
    const tree = [folder("a", { content: [{ id: "bm1" }, { id: "bm2" }] })];
    const result = moveBookmark(tree, "bm2", "a", 0);
    expect(result[0].content.map((b: any) => b.id)).toEqual(["bm2", "bm1"]);
  });

  it("is a no-op when the bookmark doesn't exist", () => {
    const tree = [folder("a")];
    expect(moveBookmark(tree, "missing", "a")).toBe(tree);
    expect(updateBookmark(tree, "missing", { name: "x" })).toBe(tree);
    expect(removeBookmark(tree, "missing")).toBe(tree);
  });
});

describe("flattenGroups", () => {
  it("flattens nested folders with depth-first order and depth tracking", () => {
    const tree = [
      folder("a", { title: "A", children: [folder("a1", { title: "A1" })] }),
      folder("b", { title: "B" }),
    ];
    expect(flattenGroups(tree)).toEqual([
      { id: "a", title: "A", depth: 0 },
      { id: "a1", title: "A1", depth: 1 },
      { id: "b", title: "B", depth: 0 },
    ]);
  });

  it("returns an empty array for an empty tree", () => {
    expect(flattenGroups([])).toEqual([]);
  });
});
