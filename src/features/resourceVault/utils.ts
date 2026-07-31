import { DEFAULT_READ_TAGS, TEMPLATE_SUBTYPES, VAULT_KIND_ORDER } from "./constants";
import type { VaultItem, VaultItemKind } from "./types";

export function formatItemDate(value: string | null | undefined) {
  const date = value ? new Date(value) : new Date();
  const month = date.toLocaleString(undefined, { month: "short" }).toUpperCase();
  const day = String(date.getDate()).padStart(2, "0");
  return `${month} ${day}`;
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function groupLabelFor(iso: string | null | undefined, now: Date) {
  const target = new Date(iso || now.toISOString());
  const diffDays = Math.round((startOfDay(now) - startOfDay(target)) / 86400000);

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return target.toLocaleDateString(undefined, { weekday: "long" });

  const sameYear = target.getFullYear() === now.getFullYear();
  return target.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
}

export function groupItemsByDate(items: any[], dateKey: (item: any) => string | null | undefined) {
  const now = new Date();
  const groups: Array<{ label: string; items: any[] }> = [];
  const indexByLabel = new Map<string, number>();

  for (const item of items) {
    const label = groupLabelFor(dateKey(item), now);

    if (!indexByLabel.has(label)) {
      indexByLabel.set(label, groups.length);
      groups.push({ label, items: [] });
    }

    groups[indexByLabel.get(label) as number].items.push(item);
  }

  return groups;
}

export function normalizeVaultItems(value: unknown, kind?: VaultItemKind): VaultItem[] {
  const sourceItems: unknown[] = Array.isArray(value)
    ? value
    : Array.isArray((value as any)?.vaultItems)
      ? (value as any).vaultItems
      : Array.isArray((value as any)?.items)
        ? (value as any).items
        : [];

  return sourceItems
    .map((item: any, index): VaultItem | null => {
      const title = String(item?.title || "").trim();
      const itemKind: VaultItemKind = VAULT_KIND_ORDER.includes(item?.kind) ? item.kind : (kind ?? "code");
      const body = String(item?.body || "").trim();

      if (!title && !body) {
        return null;
      }

      const createdAt = item?.createdAt && !Number.isNaN(new Date(item.createdAt).getTime())
        ? new Date(item.createdAt).toISOString()
        : new Date().toISOString();
      const updatedAt = item?.updatedAt && !Number.isNaN(new Date(item.updatedAt).getTime())
        ? new Date(item.updatedAt).toISOString()
        : createdAt;

      return {
        id: String(item?.id || `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`),
        kind: itemKind,
        title,
        description: String(item?.description || "").trim(),
        body,
        language: String(item?.language || "").trim(),
        templateType: TEMPLATE_SUBTYPES.some((def) => def.value === item?.templateType) ? item.templateType : "prompt",
        subject: String(item?.subject || "").trim(),
        trigger: String(item?.trigger || "").trim(),
        createdAt,
        updatedAt,
      };
    })
    .filter((item): item is VaultItem => Boolean(item))
    .filter((item) => (kind ? item.kind === kind : true));
}

export function normalizeResourceVaultItems(value: unknown) {
  const sourceItems: unknown[] = Array.isArray(value)
    ? value
    : Array.isArray((value as any)?.readItems)
      ? (value as any).readItems
      : Array.isArray((value as any)?.items)
        ? (value as any).items
        : [];

  return sourceItems
    .map((item: any, index) => {
      const title = String(item?.title || "").trim();

      if (!title) {
        return null;
      }

      const createdAt = item?.createdAt && !Number.isNaN(new Date(item.createdAt).getTime())
        ? new Date(item.createdAt).toISOString()
        : new Date().toISOString();
      const status = item?.status === "done" ? "done" : "todo";
      const completedAt = status === "done" && item?.completedAt && !Number.isNaN(new Date(item.completedAt).getTime())
        ? new Date(item.completedAt).toISOString()
        : status === "done"
          ? createdAt
          : null;

      return {
        id: String(item?.id || `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`),
        title,
        description: String(item?.description || "").trim(),
        url: String(item?.url || "").trim(),
        tag: DEFAULT_READ_TAGS.includes(item?.tag) ? item.tag : "Read",
        status,
        createdAt,
        completedAt,
      };
    })
    .filter(Boolean);
}
