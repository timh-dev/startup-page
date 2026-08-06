import React from "react";
import {
  HiArrowDownTray,
  HiArrowUpTray,
  HiArrowsUpDown,
  HiCheck,
  HiChevronRight,
  HiChevronUpDown,
  HiEye,
  HiMagnifyingGlass,
  HiOutlineClipboardDocument,
  HiOutlineInboxStack,
  HiOutlineMagnifyingGlassCircle,
  HiOutlinePencilSquare,
  HiOutlineSparkles,
  HiPencil,
  HiTrash,
  HiPlus,
  HiXMark,
} from "react-icons/hi2";
import {
  CODE_LANGUAGES,
  CODE_LANGUAGE_COLORS,
  CODE_LANGUAGE_LABELS,
  TEMPLATE_SUBTYPES,
  TEMPLATE_SUBTYPE_LABELS,
  VAULT_KIND_DEFS,
} from "@/features/resourceVault/constants";
import { formatItemDate, groupItemsByDate, normalizeVaultItems, tidyCode } from "@/features/resourceVault/utils";
import { renderMarkdownToHtml } from "@/features/resourceVault/markdown";
import { highlightCode } from "@/features/resourceVault/highlight";
import type { TemplateSubtype, VaultItem, VaultItemKind } from "@/features/resourceVault/types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const UNDO_DELETE_DELAY_MS = 5000;
const COPY_CONFIRM_MS = 1500;

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
function VaultItemRow({ item, kindDef, onCopy, copied, onPreview, onEdit, onDelete }: VaultItemRowProps) {
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

interface VaultItemPreviewDialogProps {
  item: VaultItem | null;
  kindDef: (typeof VAULT_KIND_DEFS)[VaultItemKind];
  copied: boolean;
  onClose: () => void;
  onCopy: (item: VaultItem) => void;
  onEdit: (item: VaultItem) => void;
}

function VaultItemPreviewDialog({ item, kindDef, copied, onClose, onCopy, onEdit }: VaultItemPreviewDialogProps) {
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

interface VaultItemsSectionProps {
  kind: VaultItemKind;
  items: unknown;
  onAddItem: (item: Partial<VaultItem>) => void;
  onUpdateItem: (id: string, item: Partial<VaultItem>) => void;
  onDeleteItem: (id: string) => void;
  onExportItems: () => void;
  onImportItems: (items: unknown[]) => Promise<void>;
  onBack: () => void;
  quickAddPending?: boolean;
  onQuickAddConsumed?: () => void;
  autoFocusSearch?: boolean;
}

const EMPTY_DRAFT = { title: "", description: "", body: "", language: "", templateType: "prompt" as TemplateSubtype, subject: "", trigger: "" };

export default function VaultItemsSection({
  kind,
  items,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onExportItems,
  onImportItems,
  onBack,
  quickAddPending,
  onQuickAddConsumed,
  autoFocusSearch,
}: VaultItemsSectionProps) {
  const kindDef = VAULT_KIND_DEFS[kind];
  const importInputRef = React.useRef<HTMLInputElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState("");
  const [sortDirection, setSortDirection] = React.useState("desc");
  const [composerOpen, setComposerOpen] = React.useState(false);
  const [editingItemId, setEditingItemId] = React.useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewItem, setPreviewItem] = React.useState<VaultItem | null>(null);
  const [composerLangMenuOpen, setComposerLangMenuOpen] = React.useState(false);
  const composerLangMenuRef = React.useRef<HTMLDivElement>(null);
  // True once the language picker is in "type your own" mode — either the
  // user picked "Other..." this session, or (set in editItem) the item
  // being edited already has a language outside the fixed dropdown list, so
  // editing it doesn't silently clobber that value with the closest preset.
  const [customLangMode, setCustomLangMode] = React.useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = React.useState<Set<string>>(new Set());
  const [deleteToasts, setDeleteToasts] = React.useState<Array<{ id: string; title: string }>>([]);
  const deleteTimersRef = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [importMessage, setImportMessage] = React.useState("");
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const copyTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draft, setDraft] = React.useState(EMPTY_DRAFT);

  const activeSubtypeDef = TEMPLATE_SUBTYPES.find((def) => def.value === draft.templateType) ?? TEMPLATE_SUBTYPES[0];

  React.useEffect(() => {
    if (!quickAddPending) {
      return;
    }
    setComposerOpen(true);
    onQuickAddConsumed?.();
  }, [quickAddPending, onQuickAddConsumed]);

  React.useEffect(() => {
    if (autoFocusSearch) {
      searchInputRef.current?.focus();
    }
  }, [autoFocusSearch]);

  React.useEffect(() => {
    return () => {
      Object.values(deleteTimersRef.current).forEach(clearTimeout);
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (!composerLangMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (composerLangMenuRef.current && !composerLangMenuRef.current.contains(event.target as Node)) {
        setComposerLangMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setComposerLangMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [composerLangMenuOpen]);

  const pickDraftLanguage = (language: string) => {
    setDraft((current) => ({ ...current, language }));
    setCustomLangMode(false);
    setComposerLangMenuOpen(false);
  };

  const normalizedItems = React.useMemo(() => (
    normalizeVaultItems(items, kind).filter((item) => !pendingDeleteIds.has(item.id))
  ), [items, kind, pendingDeleteIds]);

  const visibleItems = React.useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();

    return normalizedItems
      .filter((item) => (
        !lowerQuery || [item.title, item.description, item.body, item.subject, item.trigger, item.language, item.templateType]
          .some((value) => String(value || "").toLowerCase().includes(lowerQuery))
      ))
      .sort((a, b) => {
        const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return sortDirection === "desc" ? bTime - aTime : aTime - bTime;
      });
  }, [normalizedItems, query, sortDirection]);

  const groups = React.useMemo(
    () => groupItemsByDate(visibleItems, (item) => item.updatedAt || item.createdAt),
    [visibleItems],
  );

  const openComposer = () => setComposerOpen(true);

  const closeComposer = () => {
    setComposerOpen(false);
    setEditingItemId(null);
    setPreviewOpen(false);
    setComposerLangMenuOpen(false);
    setCustomLangMode(false);
    setDraft(EMPTY_DRAFT);
  };

  const submitDraft = (event: React.FormEvent) => {
    event.preventDefault();
    const title = draft.title.trim();
    const body = draft.body.trim();

    if (!title && !body) {
      return;
    }

    const nextItem = {
      kind,
      title,
      description: draft.description.trim(),
      body,
      language: draft.language.trim(),
      templateType: draft.templateType,
      subject: activeSubtypeDef.showSubject ? draft.subject.trim() : "",
      trigger: activeSubtypeDef.showTrigger ? draft.trigger.trim() : "",
    };

    if (editingItemId) {
      onUpdateItem(editingItemId, nextItem);
    } else {
      onAddItem(nextItem);
    }

    closeComposer();
  };

  const editItem = (item: VaultItem) => {
    setPreviewItem(null);
    setEditingItemId(item.id);
    setPreviewOpen(false);
    setComposerLangMenuOpen(false);
    setCustomLangMode(Boolean(item.language) && !(CODE_LANGUAGES as readonly string[]).includes(item.language));
    setDraft({
      title: item.title || "",
      description: item.description || "",
      body: item.body || "",
      language: item.language || "",
      templateType: item.templateType || "prompt",
      subject: item.subject || "",
      trigger: item.trigger || "",
    });
    setComposerOpen(true);
  };

  const copyItem = async (item: VaultItem) => {
    const text = item.kind === "template" && item.templateType === "email" && item.subject
      ? `Subject: ${item.subject}\n\n${item.body}`
      : item.body;

    try {
      await navigator.clipboard.writeText(text);
    } catch (_error) {
      return;
    }

    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
    }
    setCopiedId(item.id);
    copyTimerRef.current = setTimeout(() => setCopiedId(null), COPY_CONFIRM_MS);
  };

  const deleteItemWithUndo = (item: VaultItem) => {
    setPendingDeleteIds((current) => new Set(current).add(item.id));
    setDeleteToasts((current) => [...current, { id: item.id, title: item.title || kindDef.bodyLabel }]);

    deleteTimersRef.current[item.id] = setTimeout(() => {
      delete deleteTimersRef.current[item.id];
      setDeleteToasts((current) => current.filter((toast) => toast.id !== item.id));
      setPendingDeleteIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
      onDeleteItem(item.id);
    }, UNDO_DELETE_DELAY_MS);
  };

  const undoDelete = (itemId: string) => {
    const timer = deleteTimersRef.current[itemId];
    if (timer) {
      clearTimeout(timer);
      delete deleteTimersRef.current[itemId];
    }
    setDeleteToasts((current) => current.filter((toast) => toast.id !== itemId));
    setPendingDeleteIds((current) => {
      const next = new Set(current);
      next.delete(itemId);
      return next;
    });
  };

  const importVaultItems = async (file: File) => {
    if (!file) {
      return;
    }

    try {
      const importedItems = normalizeVaultItems(JSON.parse(await file.text()), kind);

      if (!importedItems.length) {
        setImportMessage("No items found.");
        return;
      }

      await onImportItems(importedItems);
      setImportMessage(`Imported ${importedItems.length} ${kindDef.label.toLowerCase()}.`);
    } catch (_error) {
      setImportMessage("Could not import that JSON file.");
    }
  };

  return (
    <div className="vg-view">
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={async (event) => {
          const [file] = Array.from(event.target.files || []);
          event.target.value = "";
          await importVaultItems(file);
        }}
      />

      <header className="vg-header">
        <div>
          <p className="vg-eyebrow">Vault</p>
          <h1 className="vg-title">{visibleItems.length} {kindDef.label.toLowerCase()}</h1>
        </div>
        <button type="button" className="vg-back" onClick={onBack} title="Back to dashboard">
          <HiChevronRight className="size-4" />
        </button>
      </header>

      <div className="vg-toolbar">
        <label className="vg-search">
          <HiMagnifyingGlass className="size-4" />
          <input
            ref={searchInputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${kindDef.label.toLowerCase()}...`}
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} title="Clear search">
              <HiXMark className="size-3.5" />
            </button>
          )}
        </label>

        <button
          type="button"
          className="vg-tool-btn"
          onClick={() => setSortDirection((current) => (current === "desc" ? "asc" : "desc"))}
          title={sortDirection === "desc" ? "Newest first" : "Oldest first"}
        >
          <HiArrowsUpDown className="size-4" />
        </button>

        <div className="vg-tool-group">
          <button type="button" className="vg-tool-btn" onClick={() => importInputRef.current?.click()} title="Import JSON">
            <HiArrowUpTray className="size-4" />
          </button>
          <button type="button" className="vg-tool-btn" onClick={onExportItems} title="Export JSON">
            <HiArrowDownTray className="size-4" />
          </button>
        </div>
      </div>

      {importMessage && <p className="vg-import-message">{importMessage}</p>}

      {!composerOpen && (
        <button type="button" className="vg-add-trigger" onClick={openComposer}>
          <HiPlus className="size-4" />
          Add {kindDef.bodyLabel === "Body" ? "an item" : `a ${kindDef.bodyLabel.toLowerCase()}`}
        </button>
      )}

      {composerOpen && (
        <form className="vg-composer" onSubmit={submitDraft}>
          <div className="vg-composer-row">
            <input
              autoFocus
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              placeholder="Title"
              className="vg-composer-title"
            />
            {kindDef.showLanguage && (
              <div className="vg-tag-menu" ref={composerLangMenuRef}>
                <button
                  type="button"
                  className="vg-tag-trigger"
                  aria-expanded={composerLangMenuOpen}
                  aria-haspopup="listbox"
                  onClick={() => setComposerLangMenuOpen((current) => !current)}
                >
                  <span className={`read-tag-dot read-tag-dot-lg ${CODE_LANGUAGE_COLORS[draft.language] || "code-lang-other"}`} />
                  <span className="vg-tag-trigger-label">{draft.language || "Language"}</span>
                  <HiChevronUpDown className="size-4" />
                </button>
                {composerLangMenuOpen && (
                  <div className="vg-popover vg-tag-popover" role="listbox" aria-label="Choose language">
                    {CODE_LANGUAGES.map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        role="option"
                        aria-selected={draft.language === lang}
                        className={`vg-popover-option ${draft.language === lang ? "vg-popover-option-active" : ""}`}
                        onClick={() => pickDraftLanguage(lang)}
                      >
                        <span className={`read-tag-dot read-tag-dot-lg ${CODE_LANGUAGE_COLORS[lang]}`} />
                        <span>{CODE_LANGUAGE_LABELS[lang]}</span>
                        {draft.language === lang && <HiCheck className="size-4" />}
                      </button>
                    ))}
                    <button
                      type="button"
                      role="option"
                      aria-selected={customLangMode}
                      className={`vg-popover-option ${customLangMode ? "vg-popover-option-active" : ""}`}
                      onClick={() => {
                        setCustomLangMode(true);
                        setComposerLangMenuOpen(false);
                      }}
                    >
                      <span className="read-tag-dot read-tag-dot-lg code-lang-other" />
                      <span>Other...</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {kindDef.showLanguage && customLangMode && (
            <input
              autoFocus
              value={draft.language}
              onChange={(event) => setDraft((current) => ({ ...current, language: event.target.value }))}
              placeholder="Custom language (e.g. kotlin, dockerfile)"
            />
          )}

          {kind === "template" && (
            <div className="vg-subtype-picker" role="radiogroup" aria-label="Template type">
              {TEMPLATE_SUBTYPES.map((def) => (
                <button
                  type="button"
                  key={def.value}
                  role="radio"
                  aria-checked={draft.templateType === def.value}
                  className={`vg-subtype-option ${draft.templateType === def.value ? "vg-subtype-option-active" : ""}`}
                  onClick={() => setDraft((current) => ({ ...current, templateType: def.value }))}
                >
                  {def.label}
                </button>
              ))}
            </div>
          )}

          {activeSubtypeDef.showSubject && kind === "template" && (
            <input
              value={draft.subject}
              onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))}
              placeholder="Subject"
            />
          )}
          {activeSubtypeDef.showTrigger && kind === "template" && (
            <input
              value={draft.trigger}
              onChange={(event) => setDraft((current) => ({ ...current, trigger: event.target.value }))}
              placeholder="Shorthand trigger (optional)"
            />
          )}

          {(kindDef.markdown || kind === "code") && (
            <div className="vg-composer-body-toolbar">
              {kindDef.markdown && (
                <button
                  type="button"
                  className="vg-ghost-btn vg-ghost-btn-sm"
                  onClick={() => setPreviewOpen((current) => !current)}
                >
                  {previewOpen ? <HiOutlinePencilSquare className="size-3.5" /> : <HiEye className="size-3.5" />}
                  {previewOpen ? "Edit" : "Preview"}
                </button>
              )}
              {kind === "code" && (
                <button
                  type="button"
                  className="vg-ghost-btn vg-ghost-btn-sm"
                  onClick={() => setDraft((current) => ({ ...current, body: tidyCode(current.body) }))}
                  title="Trim trailing whitespace and tidy up blank lines (not a full syntax-aware formatter)"
                >
                  <HiOutlineSparkles className="size-3.5" />
                  Format
                </button>
              )}
            </div>
          )}

          {kindDef.markdown && previewOpen ? (
            <div
              className="vg-markdown-preview"
              dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(draft.body) || "<p><em>Nothing to preview yet.</em></p>" }}
            />
          ) : (
            <textarea
              value={draft.body}
              onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
              placeholder={kindDef.bodyPlaceholder}
              className={`vg-composer-textarea ${kind === "code" ? "vg-composer-textarea-mono" : ""}`}
            />
          )}

          <input
            value={draft.description}
            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
            placeholder="Add a short note (optional)"
            className="vg-composer-desc"
          />
          <div className="vg-composer-actions">
            <button type="submit" className="vg-primary-btn">
              <HiPlus className="size-4" />
              {editingItemId ? "Save changes" : "Add item"}
            </button>
            <button type="button" className="vg-ghost-btn" onClick={closeComposer}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="vg-groups">
        {groups.length ? groups.map((group) => (
          <section key={group.label} className="vg-group">
            <h2 className="vg-group-label">
              {group.label}
              <span>{group.items.length}</span>
            </h2>
            <ul className="vg-list">
              {group.items.map((item: VaultItem) => (
                <VaultItemRow
                  key={item.id}
                  item={item}
                  kindDef={kindDef}
                  onCopy={copyItem}
                  copied={copiedId === item.id}
                  onPreview={setPreviewItem}
                  onEdit={editItem}
                  onDelete={deleteItemWithUndo}
                />
              ))}
            </ul>
          </section>
        )) : (
          <div className="vg-empty">
            {query.trim() ? (
              <>
                <HiOutlineMagnifyingGlassCircle className="vg-empty-icon" />
                <p className="vg-empty-title">No matches</p>
                <p className="vg-empty-hint">Try a different search term.</p>
              </>
            ) : (
              <>
                <HiOutlineInboxStack className="vg-empty-icon" />
                <p className="vg-empty-title">{kindDef.emptyTitle}</p>
                <p className="vg-empty-hint">{kindDef.emptyHint}</p>
              </>
            )}
          </div>
        )}
      </div>

      {deleteToasts.length > 0 && (
        <div className="vg-toast-stack">
          {deleteToasts.map((toast) => (
            <div key={toast.id} className="vg-toast">
              <span className="vg-toast-text">Deleted "{toast.title}"</span>
              <button type="button" className="vg-toast-undo" onClick={() => undoDelete(toast.id)}>
                Undo
              </button>
            </div>
          ))}
        </div>
      )}

      <VaultItemPreviewDialog
        item={previewItem}
        kindDef={kindDef}
        copied={!!previewItem && copiedId === previewItem.id}
        onClose={() => setPreviewItem(null)}
        onCopy={copyItem}
        onEdit={editItem}
      />
    </div>
  );
}
