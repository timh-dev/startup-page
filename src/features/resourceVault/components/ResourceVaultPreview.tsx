import React from "react";
import { HiArchiveBox } from "react-icons/hi2";
import { READ_TAG_COLORS } from "@/features/resourceVault/constants";
import { normalizeResourceVaultItems } from "@/features/resourceVault/utils";

export default function ResourceVaultPreview({ items, onOpen }: { items: unknown; onOpen: () => void }) {
  const recentItems = React.useMemo(() => (
    normalizeResourceVaultItems(items)
      .sort((a: any, b: any) => {
        const aTime = new Date(a.completedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.completedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 10)
  ), [items]);

  return (
    <button type="button" className="vault-preview" onClick={onOpen} title="Open Resource Vault">
      <div className="vault-preview-header">
        <span>Vault</span>
        <HiArchiveBox className="size-4" />
      </div>
      <ul className="vault-preview-list">
        {recentItems.length ? recentItems.map((item: any) => (
          <li key={item.id} className="vault-preview-item">
            <span className={`read-tag-dot ${READ_TAG_COLORS[item.tag] || "bg-primary"}`} />
            <span className={`vault-preview-title ${item.status === "done" ? "line-through opacity-55" : ""}`}>
              {item.title}
            </span>
          </li>
        )) : (
          <li className="vault-preview-empty">No resources yet.</li>
        )}
      </ul>
    </button>
  );
}
