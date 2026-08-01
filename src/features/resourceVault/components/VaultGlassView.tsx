import React from "react";
import {
  HiArrowDownTray,
  HiArrowUpTray,
  HiArrowsUpDown,
  HiCheck,
  HiChevronDown,
  HiChevronLeft,
  HiChevronRight,
  HiChevronUpDown,
  HiMagnifyingGlass,
  HiOutlineInboxStack,
  HiOutlineMagnifyingGlassCircle,
  HiOutlineSparkles,
  HiPencil,
  HiTrash,
  HiPlus,
  HiXMark,
} from "react-icons/hi2";
import { DEFAULT_READ_TAGS, READ_TAG_COLORS } from "@/features/resourceVault/constants";
import { formatItemDate, groupItemsByDate, normalizeResourceVaultItems } from "@/features/resourceVault/utils";
import { useQuickAddStore } from "@/features/resourceVault/stores/quickAddStore";

const UNDO_DELETE_DELAY_MS = 5000;

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

interface VaultItemRowProps {
  item: any;
  onToggle: (id: string) => void;
  onEdit: (item: any) => void;
  onDelete: (item: any) => void;
}

// Its own component (not an inline render function) so the description's
// expanded/collapsed state is scoped per-row — toggling one item's
// description doesn't re-render the rest of the list.
function VaultItemRow({ item, onToggle, onEdit, onDelete }: VaultItemRowProps) {
  const [descriptionExpanded, setDescriptionExpanded] = React.useState(false);
  const manuallySetRef = React.useRef(false);
  const titleRef = React.useRef<HTMLSpanElement>(null);
  const descriptionRef = React.useRef<HTMLButtonElement>(null);

  // Auto-expand the description onto its own line when the collapsed single
  // line would truncate either the title or the description — but never
  // auto-collapse it back (that would fight a user's manual toggle and can
  // oscillate, since measuring while already expanded reads as "fits").
  React.useLayoutEffect(() => {
    if (descriptionExpanded || manuallySetRef.current || !item.description) {
      return undefined;
    }

    const checkOverflow = () => {
      const titleOverflows = titleRef.current ? titleRef.current.scrollWidth > titleRef.current.clientWidth + 1 : false;
      const descriptionOverflows = descriptionRef.current
        ? descriptionRef.current.scrollWidth > descriptionRef.current.clientWidth + 1
        : false;
      if (titleOverflows || descriptionOverflows) {
        setDescriptionExpanded(true);
      }
    };

    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, [descriptionExpanded, item.title, item.description]);

  const toggleDescription = () => {
    manuallySetRef.current = true;
    setDescriptionExpanded((current) => !current);
  };

  return (
    <li
      className={`vg-item ${READ_TAG_COLORS[item.tag] || ""} group/vg-item ${descriptionExpanded ? "vg-item-expanded" : ""}`}
    >
      <button
        type="button"
        className={`vg-item-check ${item.status === "done" ? "vg-item-check-done" : ""}`}
        onClick={() => onToggle(item.id)}
        title={item.status === "done" ? "Move to todo" : "Mark done"}
      >
        {item.status === "done" && <HiCheck className="size-2.5" />}
      </button>
      <a
        href={item.url || undefined}
        target={item.url ? "_blank" : undefined}
        rel={item.url ? "noreferrer" : undefined}
        className={`vg-item-main ${!item.url ? "pointer-events-none" : ""}`}
      >
        <span ref={titleRef} className={`vg-item-title ${item.status === "done" ? "line-through opacity-55" : ""}`}>
          {item.title}
        </span>
      </a>
      {item.description && (
        <button
          ref={descriptionRef}
          type="button"
          className={`vg-item-description ${descriptionExpanded ? "vg-item-description-expanded" : ""}`}
          onClick={toggleDescription}
          title={descriptionExpanded ? "Click to collapse" : "Click to show the full description"}
        >
          {item.description}
        </button>
      )}
      <span className="vg-item-rule" aria-hidden="true" />
      <span className="vg-item-tag">{item.tag}</span>
      <span className="vg-item-date">
        {formatItemDate(item.status === "done" ? (item.completedAt || item.createdAt) : item.createdAt)}
      </span>
      <span className="vg-item-actions">
        <button type="button" className="vg-item-action" onClick={() => onEdit(item)} title="Edit item">
          <HiPencil className="size-3.5" />
        </button>
        <button
          type="button"
          className="vg-item-action"
          onClick={() => onToggle(item.id)}
          title={item.status === "done" ? "Move back to todo" : "Archive to done"}
        >
          {item.status === "done" ? <HiChevronLeft className="size-3.5" /> : <HiCheck className="size-3.5" />}
        </button>
        <button type="button" className="vg-item-action" onClick={() => onDelete(item)} title="Delete item">
          <HiTrash className="size-3.5" />
        </button>
      </span>
    </li>
  );
}

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
  const [composerTagMenuOpen, setComposerTagMenuOpen] = React.useState(false);
  const composerTagMenuRef = React.useRef<HTMLDivElement>(null);
  const [editingItemId, setEditingItemId] = React.useState<string | null>(null);
  const [pendingDeleteIds, setPendingDeleteIds] = React.useState<Set<string>>(new Set());
  const [deleteToasts, setDeleteToasts] = React.useState<Array<{ id: string; title: string }>>([]);
  const deleteTimersRef = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [importMessage, setImportMessage] = React.useState("");
  const [fetchingPreview, setFetchingPreview] = React.useState(false);
  const [draft, setDraft] = React.useState({
    title: "",
    description: "",
    url: "",
    tag: "Read",
  });

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

  // Timers for pending (undoable) deletes must be cleared on unmount so a
  // stale setTimeout doesn't fire onDeleteItem after the view is gone.
  React.useEffect(() => {
    return () => {
      Object.values(deleteTimersRef.current).forEach(clearTimeout);
    };
  }, []);

  React.useEffect(() => {
    if (autoFocusSearch) {
      searchInputRef.current?.focus();
    }
  }, [autoFocusSearch]);

  const normalizedItems = React.useMemo(() => (
    (Array.isArray(items) ? items : []).filter((item: any) => !pendingDeleteIds.has(item.id))
  ), [items, pendingDeleteIds]);

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

  const pickDraftTag = React.useCallback((tag: string) => {
    setDraft((current) => ({ ...current, tag }));
    setComposerTagMenuOpen(false);
  }, []);

  const pickFilterTag = React.useCallback((tag: string) => {
    setActiveTag(tag);
    setFilterMenuOpen(false);
  }, []);

  React.useEffect(() => {
    if (!filterMenuOpen && !composerTagMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (filterMenuOpen && filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        setFilterMenuOpen(false);
      }
      if (composerTagMenuOpen && composerTagMenuRef.current && !composerTagMenuRef.current.contains(event.target as Node)) {
        setComposerTagMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFilterMenuOpen(false);
        setComposerTagMenuOpen(false);
        return;
      }

      if (composerTagMenuOpen) {
        const tagIndex = Number(event.key) - 1;
        if (tagIndex >= 0 && tagIndex < DEFAULT_READ_TAGS.length) {
          event.preventDefault();
          pickDraftTag(DEFAULT_READ_TAGS[tagIndex]);
        }
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [composerTagMenuOpen, filterMenuOpen, pickDraftTag]);

  const openComposer = () => {
    setComposerOpen(true);
  };

  const closeComposer = () => {
    setComposerOpen(false);
    setComposerTagMenuOpen(false);
    setEditingItemId(null);
    setDraft({ title: "", description: "", url: "", tag: draft.tag });
  };

  const submitDraft = (event: React.FormEvent) => {
    event.preventDefault();
    const title = draft.title.trim();

    if (!title) {
      return;
    }

    const nextItem = {
      title,
      description: draft.description.trim(),
      url: draft.url.trim(),
      tag: draft.tag,
    };

    if (editingItemId) {
      onUpdateItem(editingItemId, nextItem);
    } else {
      onAddItem(nextItem);
    }

    closeComposer();
  };

  const editItem = (item: any) => {
    setEditingItemId(item.id);
    setDraft({
      title: item.title || "",
      description: item.description || "",
      url: item.url || "",
      tag: item.tag || "Read",
    });
    setComposerOpen(true);
  };

  // Fetches the target page's <title>/description through the
  // /api/link-preview endpoint. Silently no-ops on any failure (network
  // error, 404 because this deployment has no /api at all, timeout, etc.) —
  // auto-fill is a convenience, never a requirement, so the user can always
  // just type the title themselves.
  const maybeFetchLinkPreview = React.useCallback(async (rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      return;
    }

    setFetchingPreview(true);
    try {
      const response = await fetch(`${API_URL}/api/link-preview?url=${encodeURIComponent(trimmed)}`);
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      setDraft((current) => (
        current.url.trim() === trimmed
          ? {
              ...current,
              title: current.title.trim() ? current.title : (data.title || current.title),
              description: current.description.trim() ? current.description : (data.description || current.description),
            }
          : current
      ));
    } catch (_error) {
      // No /api available (static/self-hosted deployment) or the fetch
      // failed — leave the composer exactly as the user left it.
    } finally {
      setFetchingPreview(false);
    }
  }, []);

  const handleUrlPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text");
    if (pasted) {
      void maybeFetchLinkPreview(pasted);
    }
  };

  const deleteItemWithUndo = (item: any) => {
    setPendingDeleteIds((current) => new Set(current).add(item.id));
    setDeleteToasts((current) => [...current, { id: item.id, title: item.title }]);

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
        <form className="vg-composer" onSubmit={submitDraft}>
          <div className="vg-composer-row">
            <input
              autoFocus
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              placeholder="Title"
              className="vg-composer-title"
            />
            <div className="vg-tag-menu" ref={composerTagMenuRef}>
              <button
                type="button"
                className="vg-tag-trigger"
                aria-expanded={composerTagMenuOpen}
                aria-haspopup="listbox"
                onClick={() => setComposerTagMenuOpen((current) => !current)}
              >
                <span className={`read-tag-dot read-tag-dot-lg ${READ_TAG_COLORS[draft.tag] || "bg-primary"}`} />
                <HiChevronUpDown className="size-4" />
              </button>
              {composerTagMenuOpen && (
                <div className="vg-popover vg-tag-popover" role="listbox" aria-label="Choose tag">
                  {DEFAULT_READ_TAGS.map((tag, index) => (
                    <button
                      key={tag}
                      type="button"
                      role="option"
                      aria-selected={draft.tag === tag}
                      className={`vg-popover-option ${draft.tag === tag ? "vg-popover-option-active" : ""}`}
                      onClick={() => pickDraftTag(tag)}
                    >
                      <span className={`read-tag-dot read-tag-dot-lg ${READ_TAG_COLORS[tag] || "bg-primary"}`} />
                      <span>{tag}</span>
                      {draft.tag === tag && <HiCheck className="size-4" />}
                      <span className="vg-tag-shortcut">{index + 1}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="vg-composer-url-row">
            <input
              value={draft.url}
              onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))}
              onPaste={handleUrlPaste}
              placeholder="https://... (paste a link to auto-fill the title)"
              className="vg-composer-url"
            />
            {fetchingPreview && <span className="vg-composer-url-spinner" aria-hidden="true" />}
          </div>
          <input
            value={draft.description}
            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
            placeholder="Add a short note (optional)"
            className="vg-composer-desc"
          />
          <div className="vg-composer-actions">
            <button type="submit" className="vg-primary-btn">
              <HiPlus className="size-4" />
              {editingItemId ? "Save changes" : "Add resource"}
            </button>
            <button type="button" className="vg-ghost-btn" onClick={closeComposer}>
              Cancel
            </button>
          </div>
        </form>
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
                <VaultItemRow
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
    </div>
  );
}
