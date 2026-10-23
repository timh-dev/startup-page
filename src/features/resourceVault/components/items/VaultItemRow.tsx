import { HiCheck, HiEye, HiOutlineClipboardDocument, HiPencil, HiTrash } from "react-icons/hi2";
import { CODE_LANGUAGE_COLORS, TEMPLATE_SUBTYPE_LABELS, VAULT_KIND_DEFS } from "@/features/resourceVault/constants";
import { highlightCode } from "@/features/resourceVault/highlight";
import type { VaultItem, VaultItemKind } from "@/features/resourceVault/types";
import { formatItemDate } from "@/features/resourceVault/utils";

interface VaultItemRowProps {
  item: VaultItem;
  kindDef: (typeof VAULT_KIND_DEFS)[VaultItemKind];
  onCopy: (item: VaultItem) => void;
  copied: boolean;
  onPreview: (item: VaultItem) => void;
  onEdit: (item: VaultItem) => void;
  onDelete: (item: VaultItem) => void;
}

// A two-line card, not the single-line row Links use: body content here is
// prose/code, not a short caption, so it gets its own line (.vg-item-card)
// instead of fighting the title for space on one row — that fight is what
// used to squeeze the title down to almost nothing. Clicking the title or
// body opens the full preview dialog rather than inline-expanding in place.
export default function VaultItemRow({ item, kindDef, onCopy, copied, onPreview, onEdit, onDelete }: VaultItemRowProps) {
  const isCode = item.kind === "code";

  return (
    <li className={`vg-item vg-item-card ${kindDef.colorClass} group/vg-item`}>
      <div className="vg-item-top">
        <button type="button" className="vg-item-main vg-item-title-btn" onClick={() => onPreview(item)} title="Click to preview">
          <span className="vg-item-title">{item.title || "Untitled"}</span>
        </button>
        {item.kind === "template" && <span className="vg-item-meta-chip">{TEMPLATE_SUBTYPE_LABELS[item.templateType]}</span>}
        {item.subject && <span className="vg-item-meta-chip">{item.subject}</span>}
        {item.trigger && <span className="vg-item-meta-chip">{item.trigger}</span>}
        {item.language && (
          <span className={`vg-item-meta-chip vg-item-meta-chip-lang ${CODE_LANGUAGE_COLORS[item.language] || "code-lang-other"}`}>
            {item.language}
          </span>
        )}
        <span className="vg-item-rule" aria-hidden="true" />
        <span className="vg-item-date">{formatItemDate(item.updatedAt || item.createdAt)}</span>
        <span className="vg-item-actions">
          <button type="button" className="vg-item-action" onClick={() => onPreview(item)} title="Preview">
            <HiEye className="size-3.5" />
          </button>
          <button type="button" className="vg-item-action" onClick={() => onCopy(item)} title="Copy to clipboard">
            {copied ? <HiCheck className="size-3.5" /> : <HiOutlineClipboardDocument className="size-3.5" />}
          </button>
          <button type="button" className="vg-item-action" onClick={() => onEdit(item)} title="Edit item">
            <HiPencil className="size-3.5" />
          </button>
          <button type="button" className="vg-item-action" onClick={() => onDelete(item)} title="Delete item">
            <HiTrash className="size-3.5" />
          </button>
        </span>
      </div>
      {item.body && (
        isCode ? (
          <button
            type="button"
            className="vg-item-description vg-item-body-mono"
            onClick={() => onPreview(item)}
            title="Click to preview"
            dangerouslySetInnerHTML={{ __html: highlightCode(item.body, item.language) }}
          />
        ) : (
          <button type="button" className="vg-item-description" onClick={() => onPreview(item)} title="Click to preview">
            {item.body}
          </button>
        )
      )}
    </li>
  );
}
