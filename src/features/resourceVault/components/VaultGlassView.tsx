import React from "react";
import {
  HiArrowDownTray,
  HiArrowUpTray,
  HiArrowsUpDown,
  HiChevronDown,
  HiChevronRight,
  HiMagnifyingGlass,
  HiOutlineInboxStack,
  HiOutlineMagnifyingGlassCircle,
  HiOutlineSparkles,
  HiPlus,
  HiXMark,
} from "react-icons/hi2";
import { DEFAULT_READ_TAGS, READ_TAG_COLORS } from "@/features/resourceVault/constants";
import { usePopoverDismiss } from "@/features/resourceVault/hooks/usePopoverDismiss";
import { useUndoableDelete } from "@/features/resourceVault/hooks/useUndoableDelete";
import { useQuickAddStore } from "@/features/resourceVault/stores/quickAddStore";
import { groupItemsByDate, normalizeResourceVaultItems } from "@/features/resourceVault/utils";
import UndoToastStack from "./UndoToastStack";
import LinkComposer, { type LinkDraft } from "./links/LinkComposer";
import LinkItemRow from "./links/LinkItemRow";

interface VaultGlassViewProps {
  items: unknown;
  onAddItem: (item: any) => void;
  onBack: () => void;
  onDeleteItem: (id: string) => void;
  onExportItems: () => void;
  onImportItems: (items: any[]) => Promise<void>;
  onToggleItem: (id: string) => void;
  onUpdateItem: (id: string, item: any) => void;
  autoFocusSearch?: boolean;
}

export default function VaultGlassView({
  items,
  onAddItem,
  onBack,
  onDeleteItem,
  onExportItems,
  onImportItems,
  onToggleItem,
  onUpdateItem,
  autoFocusSearch,
}: VaultGlassViewProps) {
  const importInputRef = React.useRef<HTMLInputElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState("");
  const [activeTag, setActiveTag] = React.useState("All");
  const [activeStatus, setActiveStatus] = React.useState("todo");
  const [sortDirection, setSortDirection] = React.useState("desc");
  const [filterMenuOpen, setFilterMenuOpen] = React.useState(false);
  const filterMenuRef = React.useRef<HTMLDivElement>(null);
  const [composerOpen, setComposerOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<any | null>(null);
  const [lastTag, setLastTag] = React.useState("Read");
  const [importMessage, setImportMessage] = React.useState("");
  const { pendingIds, toasts, deleteWithUndo, undo } = useUndoableDelete(onDeleteItem);

  const quickAddPending = useQuickAddStore((state) => state.pending && state.section === "links");
  const consumeQuickAdd = useQuickAddStore((state) => state.consumeQuickAdd);

  React.useEffect(() => {
    if (!quickAddPending) {
      return;
    }
    setActiveStatus("todo");
    setComposerOpen(true);
    consumeQuickAdd();
  }, [quickAddPending, consumeQuickAdd]);

  React.useEffect(() => {
    if (autoFocusSearch) {
      searchInputRef.current?.focus();
    }
  }, [autoFocusSearch]);

  const normalizedItems = React.useMemo(() => (
    (Array.isArray(items) ? items : []).filter((item: any) => !pendingIds.has(item.id))
  ), [items, pendingIds]);

  const tagCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of normalizedItems as any[]) {
      counts[item.tag] = (counts[item.tag] || 0) + 1;
    }
    return counts;
  }, [normalizedItems]);

  const visibleItems = React.useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();

    return (normalizedItems as any[])
      .filter((item: any) => {
        const matchesQuery = !lowerQuery || [
          item.title,
          item.description,
          item.url,
          item.tag,
        ].some((value) => String(value || "").toLowerCase().includes(lowerQuery));
        const matchesTag = activeTag === "All" || item.tag === activeTag;
        return matchesQuery && matchesTag;
      })
      .sort((a: any, b: any) => {
        const aSortDate = a.status === "done" ? (a.completedAt || a.createdAt) : a.createdAt;
        const bSortDate = b.status === "done" ? (b.completedAt || b.createdAt) : b.createdAt;
        const aTime = new Date(aSortDate || 0).getTime();
        const bTime = new Date(bSortDate || 0).getTime();
        return sortDirection === "desc" ? bTime - aTime : aTime - bTime;
      });
  }, [activeTag, normalizedItems, query, sortDirection]);

  const todoItems = visibleItems.filter((item: any) => item.status !== "done");
  const doneItems = visibleItems.filter((item: any) => item.status === "done");
  const activeItems = activeStatus === "todo" ? todoItems : doneItems;
  const groups = React.useMemo(
    () => groupItemsByDate(activeItems, (item: any) => (
      activeStatus === "done" ? item.completedAt || item.createdAt : item.createdAt
    )),
    [activeItems, activeStatus],
  );

  const pickFilterTag = React.useCallback((tag: string) => {
    setActiveTag(tag);
    setFilterMenuOpen(false);
  }, []);

  const closeFilterMenu = React.useCallback(() => setFilterMenuOpen(false), []);
  usePopoverDismiss(filterMenuOpen, filterMenuRef, closeFilterMenu);

  const openComposer = () => setComposerOpen(true);

  const closeComposer = () => {
    setComposerOpen(false);
    setEditingItem(null);
  };

  const submitDraft = (nextItem: LinkDraft) => {
    if (editingItem) {
      onUpdateItem(editingItem.id, nextItem);
    } else {
      onAddItem(nextItem);
    }
    setLastTag(nextItem.tag);
    closeComposer();
  };

  const editItem = (item: any) => {
    setEditingItem(item);
    setComposerOpen(true);
  };

  const deleteItemWithUndo = (item: any) => deleteWithUndo(item.id, item.title);

  const importResourceVault = async (file: File) => {
    if (!file) {
      return;
    }

    try {
      const importedItems = normalizeResourceVaultItems(JSON.parse(await file.text()));

      if (!importedItems.length) {
        setImportMessage("No resource items found.");
        return;
      }

      await onImportItems(importedItems);
      setImportMessage(`Imported ${importedItems.length} resources.`);
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
          await importResourceVault(file);
        }}
      />

      <header className="vg-header">
        <div>
          <p className="vg-eyebrow">Resource Vault</p>
          <h1 className="vg-title">
            {activeItems.length} {activeStatus === "todo" ? "to explore" : "completed"}
          </h1>
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
            placeholder="Search resources..."
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} title="Clear search">
              <HiXMark className="size-3.5" />
            </button>
          )}
        </label>

        <div className="vg-tag-filter" ref={filterMenuRef}>
          <button
            type="button"
            className="vg-tool-btn"
            aria-expanded={filterMenuOpen}
            aria-haspopup="listbox"
            onClick={() => setFilterMenuOpen((current) => !current)}
          >
            {activeTag !== "All" && <span className={`read-tag-dot ${READ_TAG_COLORS[activeTag] || "bg-primary"}`} />}
            <span>{activeTag}</span>
            <HiChevronDown className="size-3.5" />
          </button>
          {filterMenuOpen && (
            <div className="vg-popover" role="listbox" aria-label="Filter by tag">
              <button
                type="button"
                role="option"
                aria-selected={activeTag === "All"}
                className={`vg-popover-option ${activeTag === "All" ? "vg-popover-option-active" : ""}`}
                onClick={() => pickFilterTag("All")}
              >
                <span>All</span>
                <span className="vg-count">{normalizedItems.length}</span>
              </button>
              {DEFAULT_READ_TAGS.filter((tag) => tagCounts[tag]).map((tag) => (
                <button
                  type="button"
                  key={tag}
                  role="option"
                  aria-selected={activeTag === tag}
                  className={`vg-popover-option ${activeTag === tag ? "vg-popover-option-active" : ""}`}
                  onClick={() => pickFilterTag(tag)}
                >
                  <span className={`read-tag-dot ${READ_TAG_COLORS[tag] || "bg-primary"}`} />
                  <span>{tag}</span>
                  <span className="vg-count">{tagCounts[tag]}</span>
                </button>
              ))}
            </div>
          )}
        </div>

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
          Add a resource
        </button>
      )}

      {composerOpen && (
        <LinkComposer
          key={editingItem?.id ?? "new"}
          editingItem={editingItem}
          defaultTag={lastTag}
          onSubmit={submitDraft}
          onCancel={(tag) => {
            setLastTag(tag);
            closeComposer();
          }}
        />
      )}

      <div className="vg-tabs" role="tablist" aria-label="Read item status">
        <button
          type="button"
          role="tab"
          aria-selected={activeStatus === "todo"}
          className={`vg-tab ${activeStatus === "todo" ? "vg-tab-active" : ""}`}
          onClick={() => setActiveStatus("todo")}
        >
          To explore <span>{todoItems.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeStatus === "done"}
          className={`vg-tab ${activeStatus === "done" ? "vg-tab-active" : ""}`}
          onClick={() => setActiveStatus("done")}
        >
          Completed <span>{doneItems.length}</span>
        </button>
      </div>

      <div className="vg-groups" role="tabpanel">
        {groups.length ? groups.map((group) => (
          <section key={group.label} className="vg-group">
            <h2 className="vg-group-label">
              {group.label}
              <span>{group.items.length}</span>
            </h2>
            <ul className="vg-list">
              {group.items.map((item: any) => (
                <LinkItemRow
                  key={item.id}
                  item={item}
                  onToggle={onToggleItem}
                  onEdit={editItem}
                  onDelete={deleteItemWithUndo}
                />
              ))}
            </ul>
          </section>
        )) : (
          <div className="vg-empty">
            {query.trim() || activeTag !== "All" ? (
              <>
                <HiOutlineMagnifyingGlassCircle className="vg-empty-icon" />
                <p className="vg-empty-title">No matches</p>
                <p className="vg-empty-hint">Try a different search term or tag.</p>
              </>
            ) : activeStatus === "todo" ? (
              <>
                <HiOutlineInboxStack className="vg-empty-icon" />
                <p className="vg-empty-title">Nothing saved yet</p>
                <p className="vg-empty-hint">Add a link above to start your vault.</p>
              </>
            ) : (
              <>
                <HiOutlineSparkles className="vg-empty-icon" />
                <p className="vg-empty-title">Nothing completed yet</p>
                <p className="vg-empty-hint">Items you mark done will collect here.</p>
              </>
            )}
          </div>
        )}
      </div>

      <UndoToastStack toasts={toasts} onUndo={undo} />
    </div>
  );
}
