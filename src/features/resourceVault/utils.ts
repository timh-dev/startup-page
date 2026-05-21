import { DEFAULT_READ_TAGS } from "./constants";

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
