import { HiCheck, HiOutlineClipboardDocument, HiPencil } from "react-icons/hi2";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CODE_LANGUAGE_COLORS, TEMPLATE_SUBTYPE_LABELS, VAULT_KIND_DEFS } from "@/features/resourceVault/constants";
import { highlightCode } from "@/features/resourceVault/highlight";
import { renderMarkdownToHtml } from "@/features/resourceVault/markdown";
import type { VaultItem, VaultItemKind } from "@/features/resourceVault/types";
import { formatItemDate } from "@/features/resourceVault/utils";

interface VaultItemPreviewDialogProps {
  item: VaultItem | null;
  kindDef: (typeof VAULT_KIND_DEFS)[VaultItemKind];
  copied: boolean;
  onClose: () => void;
  onCopy: (item: VaultItem) => void;
  onEdit: (item: VaultItem) => void;
}

export default function VaultItemPreviewDialog({ item, kindDef, copied, onClose, onCopy, onEdit }: VaultItemPreviewDialogProps) {
  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        {item && (
          <>
            <DialogHeader className="gap-2 p-6 pb-0">
              {(item.kind === "template" || item.subject || item.trigger || item.language) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {item.kind === "template" && (
                    <span className="vg-item-meta-chip">{TEMPLATE_SUBTYPE_LABELS[item.templateType]}</span>
                  )}
                  {item.subject && <span className="vg-item-meta-chip">{item.subject}</span>}
                  {item.trigger && <span className="vg-item-meta-chip">{item.trigger}</span>}
                  {item.language && (
                    <span className={`vg-item-meta-chip vg-item-meta-chip-lang ${CODE_LANGUAGE_COLORS[item.language] || "code-lang-other"}`}>
                      {item.language}
                    </span>
                  )}
                </div>
              )}
              <DialogTitle className="break-words">{item.title || "Untitled"}</DialogTitle>
              {item.description && <DialogDescription>{item.description}</DialogDescription>}
            </DialogHeader>

            <div className="max-h-[60vh] overflow-y-auto px-6 pb-2">
              {kindDef.markdown ? (
                <div
                  className="vg-markdown-preview"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdownToHtml(item.body) || "<p><em>Nothing here yet.</em></p>",
                  }}
                />
              ) : item.body ? (
                <pre className="vg-preview-code">
                  <code dangerouslySetInnerHTML={{ __html: highlightCode(item.body, item.language) }} />
                </pre>
              ) : (
                <pre className="vg-preview-code">Nothing here yet.</pre>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border/60 p-4">
              <span className="text-xs text-muted-foreground">
                Updated {formatItemDate(item.updatedAt || item.createdAt)}
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onCopy(item)}>
                  {copied ? <HiCheck className="size-3.5" /> : <HiOutlineClipboardDocument className="size-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button type="button" onClick={() => onEdit(item)}>
                  <HiPencil className="size-3.5" />
                  Edit
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
