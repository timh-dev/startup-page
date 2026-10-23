import React from "react";
import {
  HiArrowDownTray,
  HiArrowUpTray,
  HiArrowsUpDown,
  HiChevronRight,
  HiMagnifyingGlass,
  HiOutlineInboxStack,
  HiOutlineMagnifyingGlassCircle,
  HiPlus,
  HiXMark,
} from "react-icons/hi2";
import { VAULT_KIND_DEFS } from "@/features/resourceVault/constants";
import { useUndoableDelete } from "@/features/resourceVault/hooks/useUndoableDelete";
import type { VaultItem, VaultItemKind } from "@/features/resourceVault/types";
import { groupItemsByDate, normalizeVaultItems } from "@/features/resourceVault/utils";
import UndoToastStack from "./UndoToastStack";
import VaultItemComposer from "./items/VaultItemComposer";
import VaultItemPreviewDialog from "./items/VaultItemPreviewDialog";
import VaultItemRow from "./items/VaultItemRow";

const COPY_CONFIRM_MS = 1500;

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
  const [editingItem, setEditingItem] = React.useState<VaultItem | null>(null);
  const [previewItem, setPreviewItem] = React.useState<VaultItem | null>(null);
  const [importMessage, setImportMessage] = React.useState("");
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const copyTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const { pendingIds, toasts, deleteWithUndo, undo } = useUndoableDelete(onDeleteItem);

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

  React.useEffect(() => () => {
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
    }
  }, []);

  const normalizedItems = React.useMemo(() => (
    normalizeVaultItems(items, kind).filter((item) => !pendingIds.has(item.id))
  ), [items, kind, pendingIds]);

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
    setEditingItem(null);
  };

  const submitDraft = (nextItem: Partial<VaultItem>) => {
    if (editingItem) {
      onUpdateItem(editingItem.id, nextItem);
    } else {
      onAddItem(nextItem);
    }
    closeComposer();
  };

  const editItem = (item: VaultItem) => {
    setPreviewItem(null);
    setEditingItem(item);
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

  const deleteItemWithUndo = (item: VaultItem) => deleteWithUndo(item.id, item.title || kindDef.bodyLabel);

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
        <VaultItemComposer
          key={editingItem?.id ?? "new"}
          kind={kind}
          editingItem={editingItem}
          onSubmit={submitDraft}
          onCancel={closeComposer}
        />
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

      <UndoToastStack toasts={toasts} onUndo={undo} />

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
