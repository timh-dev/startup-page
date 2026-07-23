/*eslint-disable*/
// Id-based, immutable helpers for the bookmark folder tree. Every folder and
// bookmark carries a stable `id` (backfilled by `ensureBookmarkIds`), so all
// mutation here is done by searching for an id rather than threading array
// index paths through every caller.

export function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function countBookmarksInGroup(group: any): number {
  return (
    (Array.isArray(group?.content) ? group.content.length : 0) +
    (Array.isArray(group?.children)
      ? group.children.reduce((total: number, child: any) => total + countBookmarksInGroup(child), 0)
      : 0)
  );
}

// Backfills missing ids on every folder/bookmark. Returns the same reference
// when nothing changed so callers can skip persisting a no-op migration.
export function ensureBookmarkIds(groups: any): any[] {
  if (!Array.isArray(groups)) return [];
  let changed = false;

  const next = groups.map((group) => {
    if (!group || typeof group !== "object") {
      changed = true;
      return { id: generateId(), title: "Untitled", content: [], children: [] };
    }

    const content = Array.isArray(group.content) ? group.content : [];
    let contentChanged = !Array.isArray(group.content);
    const nextContent = content.map((bookmark: any) => {
      if (bookmark && typeof bookmark === "object" && bookmark.id) return bookmark;
      contentChanged = true;
      return { ...bookmark, id: generateId() };
    });

    const children = Array.isArray(group.children) ? group.children : [];
    const nextChildren = ensureBookmarkIds(children);
    const childrenChanged = nextChildren !== children;

    const needsId = !group.id;
    if (!needsId && !contentChanged && !childrenChanged) {
      return group;
    }

    changed = true;
    return {
      ...group,
      id: group.id || generateId(),
      content: nextContent,
      children: nextChildren,
    };
  });

  return changed ? next : groups;
}

export function findGroup(groups: any[], id: string): any {
  for (const group of groups || []) {
    if (group?.id === id) return group;
    const children = Array.isArray(group?.children) ? group.children : [];
    const found = findGroup(children, id);
    if (found) return found;
  }
  return null;
}

export function findGroupWithParent(
  groups: any[],
  id: string,
  parent: any = null,
): { group: any; parent: any; siblings: any[] } | null {
  const siblings = groups || [];
  for (const group of siblings) {
    if (group?.id === id) return { group, parent, siblings };
    const children = Array.isArray(group?.children) ? group.children : [];
    const found = findGroupWithParent(children, id, group);
    if (found) return found;
  }
  return null;
}

export function findBookmarkGroup(groups: any[], bookmarkId: string): any {
  for (const group of groups || []) {
    const content = Array.isArray(group?.content) ? group.content : [];
    if (content.some((bookmark: any) => bookmark?.id === bookmarkId)) return group;
    const children = Array.isArray(group?.children) ? group.children : [];
    const found = findBookmarkGroup(children, bookmarkId);
    if (found) return found;
  }
  return null;
}

// Recursively rebuilds the tree, replacing the folder matching `id` with
// `updater(group)`. Every ancestor on the path is shallow-cloned; unrelated
// branches keep their original reference.
export function updateGroup(groups: any[], id: string, updater: (group: any) => any): any[] {
  return (groups || []).map((group) => {
    if (group?.id === id) return updater(group);
    const children = Array.isArray(group?.children) ? group.children : [];
    const nextChildren = updateGroup(children, id, updater);
    return nextChildren === children ? group : { ...group, children: nextChildren };
  });
}

export function removeGroup(groups: any[], id: string): any[] {
  return (groups || [])
    .filter((group) => group?.id !== id)
    .map((group) => {
      const children = Array.isArray(group?.children) ? group.children : [];
      const nextChildren = removeGroup(children, id);
      return nextChildren === children ? group : { ...group, children: nextChildren };
    });
}

export function addGroup(groups: any[], newGroup: any, parentId: string | null): any[] {
  if (!parentId) return [...groups, newGroup];
  return updateGroup(groups, parentId, (group) => ({
    ...group,
    children: [...(Array.isArray(group.children) ? group.children : []), newGroup],
  }));
}

// Moves a folder up (-1) or down (1) among its siblings, wherever it sits in
// the tree (top level or nested).
export function moveSibling(groups: any[], id: string, direction: number): any[] {
  const located = findGroupWithParent(groups, id);
  if (!located) return groups;

  const { siblings } = located;
  const index = siblings.findIndex((group: any) => group?.id === id);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= siblings.length) return groups;

  const reordered = [...siblings];
  [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];

  if (!located.parent) return reordered;
  return updateGroup(groups, located.parent.id, (group) => ({ ...group, children: reordered }));
}

// Reorders siblings within whichever list `id` currently belongs to (top
// level or nested), placing it at `toIndex` within that same sibling list.
export function reorderSibling(groups: any[], id: string, toIndex: number): any[] {
  const located = findGroupWithParent(groups, id);
  if (!located) return groups;

  const { siblings, parent } = located;
  const fromIndex = siblings.findIndex((group: any) => group?.id === id);
  if (fromIndex < 0) return groups;

  const reordered = [...siblings];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(Math.max(0, Math.min(toIndex, reordered.length)), 0, moved);

  if (!parent) return reordered;
  return updateGroup(groups, parent.id, (group) => ({ ...group, children: reordered }));
}

export function addBookmarkToGroup(groups: any[], groupId: string, bookmark: any): any[] {
  return updateGroup(groups, groupId, (group) => ({
    ...group,
    content: [...(Array.isArray(group.content) ? group.content : []), { ...bookmark, id: bookmark.id || generateId() }],
  }));
}

export function updateBookmark(groups: any[], bookmarkId: string, patch: any): any[] {
  const groupId = findBookmarkGroup(groups, bookmarkId)?.id;
  if (!groupId) return groups;
  return updateGroup(groups, groupId, (group) => ({
    ...group,
    content: (Array.isArray(group.content) ? group.content : []).map((bookmark: any) =>
      bookmark.id === bookmarkId ? { ...bookmark, ...patch, id: bookmarkId } : bookmark,
    ),
  }));
}

export function removeBookmark(groups: any[], bookmarkId: string): any[] {
  const groupId = findBookmarkGroup(groups, bookmarkId)?.id;
  if (!groupId) return groups;
  return updateGroup(groups, groupId, (group) => ({
    ...group,
    content: (Array.isArray(group.content) ? group.content : []).filter(
      (bookmark: any) => bookmark.id !== bookmarkId,
    ),
  }));
}

// Moves a bookmark to `toGroupId`'s content array at `toIndex` (or the end
// when omitted), removing it from wherever it currently lives. Works for
// same-folder reorders and cross-folder moves alike.
export function moveBookmark(
  groups: any[],
  bookmarkId: string,
  toGroupId: string,
  toIndex?: number,
): any[] {
  const fromGroup = findBookmarkGroup(groups, bookmarkId);
  if (!fromGroup) return groups;

  const bookmark = (fromGroup.content || []).find((item: any) => item.id === bookmarkId);
  if (!bookmark) return groups;

  const sameGroup = fromGroup.id === toGroupId;
  let next = removeBookmark(groups, bookmarkId);

  next = updateGroup(next, toGroupId, (group) => {
    const content = [...(Array.isArray(group.content) ? group.content : [])];
    const boundedIndex =
      toIndex === undefined ? content.length : Math.max(0, Math.min(toIndex, content.length));
    content.splice(boundedIndex, 0, bookmark);
    return { ...group, content };
  });

  return next;
}

export function reorderFolder(groups: any[], fromIndex: number, toIndex: number): any[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= groups.length ||
    toIndex >= groups.length
  ) {
    return groups;
  }

  const reordered = [...groups];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);
  return reordered;
}

// Flattened, depth-indented list of every folder — used to populate folder
// pickers (add/edit bookmark dialog, "move to folder" menus).
export function flattenGroups(
  groups: any[],
  depth = 0,
): { id: string; title: string; depth: number }[] {
  return (groups || []).flatMap((group) => [
    { id: group.id, title: group.title, depth },
    ...flattenGroups(Array.isArray(group.children) ? group.children : [], depth + 1),
  ]);
}
