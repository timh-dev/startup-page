import { HiCheck, HiOutlineClipboardDocument, HiPencil, HiTrash } from "react-icons/hi2";
import { CODE_LANGUAGE_COLORS, CODE_LANGUAGE_LABELS, TEMPLATE_SUBTYPE_LABELS, VAULT_KIND_DEFS } from "@/features/resourceVault/constants";
import { highlightCode } from "@/features/resourceVault/highlight";
import type { VaultItem, VaultItemKind } from "@/features/resourceVault/types";
import { relativeAge } from "@/features/resourceVault/utils";

interface VaultItemRowProps {
  item: VaultItem;
  kindDef: (typeof VAULT_KIND_DEFS)[VaultItemKind];
  onCopy: (item: VaultItem) => void;
  copied: boolean;
  onPreview: (item: VaultItem) => void;
  onEdit: (item: VaultItem) => void;
  onDelete: (item: VaultItem) => void;
}

// A card: title and its chips, the first lines of the code or text (click
// to open the full preview), and copy / edit / delete along the bottom.
export default function VaultItemRow({ item, kindDef, onCopy, copied, onPreview, onEdit, onDelete }: VaultItemRowProps) {
  const isCode = item.kind === "code";
  const title = item.title || "Untitled";

  return (
    <li className={`snippet-card ${kindDef.colorClass}`}>
      <button type="button" className="snippet-card-open" onClick={() => onPreview(item)} title="Open">
        <span className="snippet-card-head">
          <span className="snippet-card-title">{title}</span>
          {item.language && (
            <span className={`snippet-chip snippet-chip-lang ${CODE_LANGUAGE_COLORS[item.language] || "code-lang-other"}`}>
              <span className="read-tag-dot" aria-hidden="true" />
              {CODE_LANGUAGE_LABELS[item.language] ?? item.language}
            </span>
          )}
          {item.kind === "template" && <span className="snippet-chip">{TEMPLATE_SUBTYPE_LABELS[item.templateType]}</span>}
        </span>
        {(item.subject || item.trigger || item.description) && (
          <span className="snippet-card-sub">
            {item.trigger && <kbd>{item.trigger}</kbd>}
            {item.subject || item.description}
          </span>
        )}
        {item.body &&
          (isCode ? (
            <code
              className="snippet-card-preview snippet-card-code"
              data-clipped={item.body.split("\n").length > 6 || undefined}
              dangerouslySetInnerHTML={{ __html: highlightCode(item.body, item.language) }} />
          ) : (
            <span className="snippet-card-preview">{item.body}</span>
          ))}
      </button>
      <footer className="snippet-card-foot">
        <time dateTime={item.updatedAt || item.createdAt}>{relativeAge(item.updatedAt || item.createdAt)}</time>
        <span className="snippet-card-actions">
          <button type="button" onClick={() => onEdit(item)} title="Edit item" aria-label={`Edit "${title}"`}>
            <HiPencil className="size-3.5" />
          </button>
          <button type="button" onClick={() => onDelete(item)} title="Delete item" aria-label={`Delete "${title}"`}>
            <HiTrash className="size-3.5" />
          </button>
          <button type="button" className="snippet-copy" data-copied={copied || undefined} onClick={() => onCopy(item)} title="Copy to clipboard">
            {copied ? <HiCheck className="size-3.5" /> : <HiOutlineClipboardDocument className="size-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </span>
      </footer>
    </li>
  );
}
