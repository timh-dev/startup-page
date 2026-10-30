import React from "react";
import { HiArrowDownTray, HiArrowUpTray, HiArrowsUpDown, HiOutlineInboxStack, HiOutlineMagnifyingGlassCircle, HiPlus } from "react-icons/hi2";
import { CollectionHeader, MoreMenu } from "@/components/layout/CollectionShell";
import { VAULT_KIND_DEFS } from "@/features/resourceVault/constants";
import { useUndoableDelete } from "@/features/resourceVault/hooks/useUndoableDelete";
import type { VaultItem, VaultItemKind } from "@/features/resourceVault/types";
import { normalizeVaultItems } from "@/features/resourceVault/utils";
import UndoToastStack from "./UndoToastStack";
import VaultItemComposer from "./items/VaultItemComposer";
import VaultItemPreviewDialog from "./items/VaultItemPreviewDialog";
import VaultItemRow from "./items/VaultItemRow";

const COPY_CONFIRM_MS = 1500;

const NEW_LABEL: Record<VaultItemKind, string> = { code: "New snippet", template: "New template" };

interface VaultItemsSectionProps {
  kind: VaultItemKind;
  items: unknown;
  /** Filters the cards; set from the sidebar's search. */
  query?: string;
  /** In search results: a section of the results, without adding or the toolbar. */
  embedded?: boolean;
  onAddItem: (item: Partial<VaultItem>) => void;
  onUpdateItem: (id: string, item: Partial<VaultItem>) => void;
  onDeleteItem: (id: string) => void;
  onExportItems?: () => void;
  onImportItems?: (items: unknown[]) => Promise<void>;
  quickAddPending?: boolean;
  onQuickAddConsumed?: () => void;
}

export default function VaultItemsSection({
  kind,
  items,
  query = "",
  embedded,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onExportItems,
  onImportItems,
  quickAddPending,
  onQuickAddConsumed,
}: VaultItemsSectionProps) {
  const kindDef = VAULT_KIND_DEFS[kind];
  const importInputRef = React.useRef<HTMLInputElement>(null);
  const [sortDirection, setSortDirection] = React.useState<"desc" | "asc">("desc");
  const [composerOpen, setComposerOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<VaultItem | null>(null);
  const [previewItem, setPreviewItem] = React.useState<VaultItem | null>(null);
  const [message, setMessage] = React.useState("");
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const copyTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const { pendingIds, toasts, deleteWithUndo, undo } = useUndoableDelete(onDeleteItem);

  React.useEffect(() => {
    if (!quickAddPending) return;
    setComposerOpen(true);
    onQuickAddConsumed?.();
  }, [quickAddPending, onQuickAddConsumed]);

  React.useEffect(
    () => () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    },
    [],
  );

  React.useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(""), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const visibleItems = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return normalizeVaultItems(items, kind)
      .filter((item) => !pendingIds.has(item.id))
      .filter(
        (item) =>
          !needle ||
          [item.title, item.description, item.body, item.subject, item.trigger, item.language, item.templateType].some((value) =>
            String(value || "").toLowerCase().includes(needle),
          ),
      )
      .sort((a, b) => {
        const at = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bt = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return sortDirection === "desc" ? bt - at : at - bt;
      });
  }, [items, kind, pendingIds, query, sortDirection]);

  const closeComposer = () => {
    setComposerOpen(false);
    setEditingItem(null);
  };

  const submitDraft = (nextItem: Partial<VaultItem>) => {
    if (editingItem) onUpdateItem(editingItem.id, nextItem);
    else onAddItem(nextItem);
    closeComposer();
  };

  const editItem = (item: VaultItem) => {
    setPreviewItem(null);
    setEditingItem(item);
    setComposerOpen(true);
  };

  const copyItem = async (item: VaultItem) => {
    const text = item.kind === "template" && item.templateType === "email" && item.subject ? `Subject: ${item.subject}\n\n${item.body}` : item.body;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    setCopiedId(item.id);
    copyTimerRef.current = setTimeout(() => setCopiedId(null), COPY_CONFIRM_MS);
  };

  const importFile = async (file: File | undefined) => {
    if (!file || !onImportItems) return;
    try {
      const imported = normalizeVaultItems(JSON.parse(await file.text()), kind);
      if (!imported.length) {
        setMessage("Nothing to import in that file.");
        return;
      }
      await onImportItems(imported);
      setMessage(`Imported ${imported.length} ${kindDef.label.toLowerCase()}.`);
    } catch {
      setMessage("Couldn't read that JSON file.");
    }
  };

  const cards = visibleItems.length ? (
    <ul className="snippet-grid">
      {visibleItems.map((item) => (
        <VaultItemRow
          key={item.id}
          item={item}
          kindDef={kindDef}
          onCopy={copyItem}
          copied={copiedId === item.id}
          onPreview={setPreviewItem}
          onEdit={editItem}
          onDelete={(target) => deleteWithUndo(target.id, target.title || kindDef.bodyLabel)}
        />
      ))}
    </ul>
  ) : null;

  const dialogs = (
    <>
      <UndoToastStack toasts={toasts} onUndo={undo} />
      <VaultItemPreviewDialog
        item={previewItem}
        kindDef={kindDef}
        copied={!!previewItem && copiedId === previewItem.id}
        onClose={() => setPreviewItem(null)}
        onCopy={copyItem}
        onEdit={editItem}
      />
    </>
  );

  if (embedded) {
    if (!visibleItems.length) return null;
    return (
      <div className="collection-results-section">
        <h2 className="collection-results-title">
          {kindDef.label} <span className="numeric">{visibleItems.length}</span>
        </h2>
        {composerOpen && (
          <VaultItemComposer key={editingItem?.id ?? "new"} kind={kind} editingItem={editingItem} onSubmit={submitDraft} onCancel={closeComposer} />
        )}
        {cards}
        {dialogs}
      </div>
    );
  }

  return (
    <div className="collection-pane">
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const [file] = Array.from(event.target.files || []);
          event.target.value = "";
          void importFile(file);
        }}
      />

      <CollectionHeader eyebrow="Library" title={kindDef.label} count={visibleItems.length}>
        <button
          type="button"
          className="collection-icon-btn"
          onClick={() => setSortDirection((current) => (current === "desc" ? "asc" : "desc"))}
          title={sortDirection === "desc" ? "Recently changed first (click for oldest)" : "Oldest first (click for newest)"}
          aria-label={sortDirection === "desc" ? "Sorted recently changed first" : "Sorted oldest first"}
        >
          <HiArrowsUpDown className="size-4" />
        </button>
        <MoreMenu
          label={`More ${kindDef.label.toLowerCase()} actions`}
          items={[
            { label: `Import ${kindDef.label.toLowerCase()} (JSON)…`, icon: HiArrowUpTray, onSelect: () => importInputRef.current?.click() },
            ...(onExportItems ? [{ label: `Export ${kindDef.label.toLowerCase()} (JSON)`, icon: HiArrowDownTray, onSelect: onExportItems }] : []),
          ]}
        />
        <button
          type="button"
          className="collection-primary-btn"
          onClick={() => {
            setEditingItem(null);
            setComposerOpen(true);
          }}
        >
          <HiPlus className="size-4" />
          {NEW_LABEL[kind]}
        </button>
      </CollectionHeader>

      {composerOpen && (
        <div className="snippet-composer">
          <VaultItemComposer key={editingItem?.id ?? "new"} kind={kind} editingItem={editingItem} onSubmit={submitDraft} onCancel={closeComposer} />
        </div>
      )}

      {message && (
        <p className="collection-message" role="status">
          {message}
        </p>
      )}

      {cards ?? (
        <div className="collection-empty">
          {query.trim() ? (
            <>
              <HiOutlineMagnifyingGlassCircle className="collection-empty-icon" />
              <p className="collection-empty-title">No matches</p>
              <p className="collection-empty-hint">Try a different search.</p>
            </>
          ) : (
            <>
              <HiOutlineInboxStack className="collection-empty-icon" />
              <p className="collection-empty-title">{kindDef.emptyTitle}</p>
              <p className="collection-empty-hint">{kindDef.emptyHint}</p>
            </>
          )}
        </div>
      )}

      {dialogs}
    </div>
  );
}
