// Three-way merge of a settings value: `base` is the last copy both sides
// agreed on, `local` and `remote` are what each side has now. Changes made on
// only one side are kept; changes on both sides are merged as deep as the
// shapes allow, so two devices editing different fields, keys or list items
// both keep their edits.
//
// Objects merge key by key. Lists whose entries all have a string `id`
// (bookmarks, vault items, widgets, themes…) merge entry by entry, so adding,
// editing or deleting different entries on two devices all survive. Anything
// else that changed differently on both sides is a conflict: the newer entry
// wins when the enclosing list entries carry `updatedAt`, otherwise local
// wins. A value deleted on one side and edited on the other is kept, since
// dropping an edit loses data and keeping it doesn't.

export type MergePath = Array<string | number>;

export interface MergeResult<T = unknown> {
  value: T;
  /** Paths where both sides changed the same value differently. */
  conflicts: MergePath[];
}

type PlainObject = Record<string, unknown>;
type IdEntry = PlainObject & { id: string };

export function isPlainObject(value: unknown): value is PlainObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
  }
  const aKeys = Object.keys(a as PlainObject).filter((key) => (a as PlainObject)[key] !== undefined);
  const bKeys = Object.keys(b as PlainObject).filter((key) => (b as PlainObject)[key] !== undefined);
  return (
    aKeys.length === bKeys.length &&
    aKeys.every((key) => deepEqual((a as PlainObject)[key], (b as PlainObject)[key]))
  );
}

function isIdList(value: unknown): value is IdEntry[] {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  for (const entry of value) {
    if (!isPlainObject(entry) || typeof entry.id !== "string" || !entry.id || ids.has(entry.id)) return false;
    ids.add(entry.id);
  }
  return true;
}

function timestamp(entry: unknown): number {
  const value = isPlainObject(entry) ? entry.updatedAt : undefined;
  const time = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isNaN(time) ? NaN : time;
}

interface Context {
  conflicts: MergePath[];
  /** Set inside a list entry whose remote copy is newer than the local one. */
  preferRemote: boolean;
}

function mergeValue(base: unknown, local: unknown, remote: unknown, path: MergePath, ctx: Context): unknown {
  if (deepEqual(local, remote)) return local;
  if (deepEqual(base, local)) return remote;
  if (deepEqual(base, remote)) return local;

  // Deleted on one side, changed on the other: keep the change.
  if (local === undefined) return remote;
  if (remote === undefined) return local;

  if (isPlainObject(local) && isPlainObject(remote)) {
    return mergeObjects(isPlainObject(base) ? base : {}, local, remote, path, ctx);
  }

  if (isIdList(local) && isIdList(remote)) {
    return mergeIdLists(isIdList(base) ? base : [], local, remote, path, ctx);
  }

  // The entry's own edit time is bookkeeping, not a conflict: keep the later one.
  if (path[path.length - 1] === "updatedAt" && typeof local === "string" && typeof remote === "string") {
    return Date.parse(remote) > Date.parse(local) ? remote : local;
  }

  ctx.conflicts.push(path);
  return ctx.preferRemote ? remote : local;
}

function mergeObjects(base: PlainObject, local: PlainObject, remote: PlainObject, path: MergePath, ctx: Context) {
  const result: PlainObject = {};
  const keys = new Set([...Object.keys(local), ...Object.keys(remote), ...Object.keys(base)]);
  for (const key of keys) {
    const value = mergeValue(base[key], local[key], remote[key], [...path, key], ctx);
    if (value !== undefined) result[key] = value;
  }
  return result;
}

function mergeIdLists(base: IdEntry[], local: IdEntry[], remote: IdEntry[], path: MergePath, ctx: Context) {
  const byId = (list: IdEntry[]) => new Map(list.map((entry) => [entry.id, entry]));
  const baseById = byId(base);
  const localById = byId(local);
  const remoteById = byId(remote);

  const merged = new Map<string, unknown>();
  for (const id of new Set([...localById.keys(), ...remoteById.keys()])) {
    const b = baseById.get(id);
    const l = localById.get(id);
    const r = remoteById.get(id);
    let value: unknown;
    if (l && r) {
      const remoteNewer = timestamp(r) > timestamp(l);
      const entryCtx: Context = { conflicts: ctx.conflicts, preferRemote: Number.isNaN(timestamp(r)) ? ctx.preferRemote : remoteNewer };
      value = mergeValue(b, l, r, [...path, id], entryCtx);
    } else if (l) {
      // Missing remotely: a remote delete unless local changed it since base.
      value = b && deepEqual(b, l) ? undefined : l;
    } else {
      value = b && deepEqual(b, r) ? undefined : r;
    }
    if (value !== undefined) merged.set(id, value);
  }

  // Order: if the remote list's order is unchanged from base, the local
  // order wins (it may have been rearranged); otherwise the remote order.
  // Entries missing from the chosen order slot in after their neighbour in
  // the list they came from.
  const sameOrder = (a: IdEntry[], b: IdEntry[]) => a.length === b.length && a.every((entry, i) => entry.id === b[i].id);
  const primary = sameOrder(base, remote) ? local : remote;
  const secondary = primary === local ? remote : local;
  const order = primary.map((entry) => entry.id).filter((id) => merged.has(id));
  for (let i = 0; i < secondary.length; i++) {
    const id = secondary[i].id;
    if (!merged.has(id) || order.includes(id)) continue;
    let insertAt = 0;
    for (let j = i - 1; j >= 0; j--) {
      const at = order.indexOf(secondary[j].id);
      if (at !== -1) {
        insertAt = at + 1;
        break;
      }
    }
    order.splice(insertAt, 0, id);
  }
  return order.map((id) => merged.get(id));
}

export function merge3<T>(base: unknown, local: T, remote: unknown): MergeResult<T> {
  const ctx: Context = { conflicts: [], preferRemote: false };
  const value = mergeValue(base, local, remote, [], ctx) as T;
  return { value, conflicts: ctx.conflicts };
}
