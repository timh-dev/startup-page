import React from "react";
import { HiCheck, HiChevronLeft, HiChevronRight, HiChevronUpDown, HiPencil, HiPlus, HiTrash } from "react-icons/hi2";
import { DEFAULT_READ_TAGS, READ_TAG_COLORS } from "@/features/resourceVault/constants";
import { normalizeResourceVaultItems } from "@/features/resourceVault/utils";

const SKIP_DELETE_CONFIRM_KEY = "startup-page.resource-vault.skip-delete-confirm";

function formatReadDate(value: string | null | undefined) {
  const date = value ? new Date(value) : new Date();
  const month = date.toLocaleString(undefined, { month: "short" }).toUpperCase();
  const day = String(date.getDate()).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${month} ${day}, ${year}`;
}

interface ReadViewProps {
  items: unknown;
  onAddItem: (item: any) => void;
  onBack: () => void;
  onDeleteItem: (id: string) => void;
  onExportItems: () => void;
  onImportItems: (items: any[]) => Promise<void>;
  onToggleItem: (id: string) => void;
  onUpdateItem: (id: string, item: any) => void;
}

export default function ReadView({
  items,
  onAddItem,
  onBack,
  onDeleteItem,
  onExportItems,
  onImportItems,
  onToggleItem,
  onUpdateItem,
}: ReadViewProps) {
  const importInputRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState("");
  const [activeTag, setActiveTag] = React.useState("All");
  const [activeStatus, setActiveStatus] = React.useState("todo");
  const [sortDirection, setSortDirection] = React.useState("desc");
  const [tagMenuOpen, setTagMenuOpen] = React.useState(false);
  const tagMenuRef = React.useRef<HTMLDivElement>(null);
  const [editingItemId, setEditingItemId] = React.useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = React.useState<string | null>(null);
  const [rememberDeleteConfirm, setRememberDeleteConfirm] = React.useState(false);
  const [skipDeleteConfirm, setSkipDeleteConfirm] = React.useState(() => (
    typeof window !== "undefined" && window.localStorage?.getItem(SKIP_DELETE_CONFIRM_KEY) === "true"
  ));
  const [importMessage, setImportMessage] = React.useState("");
  const [draft, setDraft] = React.useState({
    title: "",
    description: "",
    url: "",
    tag: "Read",
  });

  const normalizedItems = React.useMemo(() => (
    Array.isArray(items) ? items : []
  ), [items]);

  const visibleItems = React.useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();

    return normalizedItems
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

  const pickDraftTag = React.useCallback((tag: string) => {
    setDraft((current) => ({ ...current, tag }));
    setTagMenuOpen(false);
  }, []);

  React.useEffect(() => {
    if (!tagMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (tagMenuRef.current && !tagMenuRef.current.contains(event.target as Node)) {
        setTagMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setTagMenuOpen(false);
        return;
      }

      const tagIndex = Number(event.key) - 1;
      if (tagIndex >= 0 && tagIndex < DEFAULT_READ_TAGS.length) {
        event.preventDefault();
        pickDraftTag(DEFAULT_READ_TAGS[tagIndex]);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [pickDraftTag, tagMenuOpen]);

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
      setEditingItemId(null);
    } else {
      onAddItem(nextItem);
    }

    setDraft({ title: "", description: "", url: "", tag: draft.tag });
  };

  const editItem = (item: any) => {
    setEditingItemId(item.id);
    setDraft({
      title: item.title || "",
      description: item.description || "",
      url: item.url || "",
      tag: item.tag || "Read",
    });
  };

  const cancelEdit = () => {
    setEditingItemId(null);
    setDraft({ title: "", description: "", url: "", tag: draft.tag });
  };

  const requestDeleteItem = (itemId: string) => {
    if (skipDeleteConfirm) {
      onDeleteItem(itemId);
      return;
    }

    setConfirmingDeleteId((current) => (current === itemId ? null : itemId));
  };

  const confirmDeleteItem = (itemId: string) => {
    if (rememberDeleteConfirm && typeof window !== "undefined") {
      window.localStorage?.setItem(SKIP_DELETE_CONFIRM_KEY, "true");
      setSkipDeleteConfirm(true);
    }

    setConfirmingDeleteId(null);
    onDeleteItem(itemId);
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

  const renderItem = (item: any) => (
    <li key={item.id} className="read-item group/read-item">
      <button
        type="button"
        className="read-status-dot"
        onClick={() => onToggleItem(item.id)}
        title={item.status === "done" ? "Move to todo" : "Mark done"}
      >
        <span className={`read-tag-dot ${READ_TAG_COLORS[item.tag] || "bg-primary"}`} />
      </button>
      <a
        href={item.url || undefined}
        target={item.url ? "_blank" : undefined}
        rel={item.url ? "noreferrer" : undefined}
        className={`read-item-main ${!item.url ? "pointer-events-none" : ""}`}
      >
        <span className={`read-item-title ${item.status === "done" ? "line-through opacity-55" : ""}`}>
          {item.title}
        </span>
        {item.description && (
          <>
            <span className="read-item-separator">•</span>
            <span className="read-item-description">{item.description}</span>
          </>
        )}
      </a>
      <span className="read-item-rule" aria-hidden="true" />
      <span className="read-item-date">
        {formatReadDate(item.status === "done" ? (item.completedAt || item.createdAt) : item.createdAt)}
      </span>
      <span className={`read-item-actions ${confirmingDeleteId === item.id ? "read-item-actions-confirming" : ""}`}>
        <button
          type="button"
          className="read-item-action"
          onClick={() => editItem(item)}
          title="Edit item"
        >
          <HiPencil className="size-3.5" />
        </button>
        <button
          type="button"
          className="read-item-action"
          onClick={() => onToggleItem(item.id)}
          title={item.status === "done" ? "Move back to todo" : "Archive to done"}
        >
          {item.status === "done" ? <HiChevronLeft className="size-3.5" /> : <HiCheck className="size-3.5" />}
        </button>
        <button
          type="button"
          className="read-item-action"
          onClick={() => requestDeleteItem(item.id)}
          title="Delete item"
        >
          <HiTrash className="size-3.5" />
        </button>
        {confirmingDeleteId === item.id && (
          <span className="read-delete-confirm">
            <button
              type="button"
              className="read-item-action read-delete-confirm-button"
              onClick={() => confirmDeleteItem(item.id)}
              title="Confirm delete"
            >
              <HiCheck className="size-3.5" />
            </button>
            <label className="read-remember-delete">
              <input
                type="checkbox"
                checked={rememberDeleteConfirm}
                onChange={(event) => setRememberDeleteConfirm(event.target.checked)}
              />
              <span>Remember</span>
            </label>
          </span>
        )}
      </span>
    </li>
  );

  return (
    <div className="read-view h-screen w-full overflow-y-auto px-4 pb-16 pt-24 sm:px-6">
      <div className="read-panel">
        <div className="read-panel-header">
          <h1>Resource Vault:</h1>
          <button type="button" className="read-back" onClick={onBack} title="Back to dashboard">
            <HiChevronRight className="size-4" />
          </button>
        </div>

        <div className="read-toolbar">
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
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search here..."
            className="read-search"
          />
          <button
            type="button"
            className="read-chip"
            onClick={() => setSortDirection((current) => (current === "desc" ? "asc" : "desc"))}
          >
            Date {sortDirection === "desc" ? "↓" : "↑"}
          </button>
          <button type="button" className="read-chip" onClick={() => importInputRef.current?.click()}>
            Import
          </button>
          <button type="button" className="read-chip" onClick={onExportItems}>
            Export
          </button>
          {["All", ...DEFAULT_READ_TAGS].map((tag) => (
            <button
              key={tag}
              type="button"
              className={`read-chip ${activeTag === tag ? "read-chip-active" : ""}`}
              onClick={() => setActiveTag(tag)}
            >
              {tag !== "All" && <span className={`read-tag-dot ${READ_TAG_COLORS[tag] || "bg-primary"}`} />}
              {tag}
            </button>
          ))}
          <button type="button" className="read-chip read-chip-muted" onClick={() => { setQuery(""); setActiveTag("All"); }}>
            Clear All
          </button>
          {importMessage && <span className="read-import-message">{importMessage}</span>}
        </div>

        <form className="read-form" onSubmit={submitDraft}>
          <input
            value={draft.title}
            onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
            placeholder="Title"
          />
          <input
            value={draft.description}
            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
            placeholder="Description"
          />
          <input
            value={draft.url}
            onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))}
            placeholder="URL"
          />
          <div className="read-tag-menu" ref={tagMenuRef}>
            <button
              type="button"
              className="read-tag-trigger"
              aria-expanded={tagMenuOpen}
              aria-haspopup="listbox"
              onClick={() => setTagMenuOpen((current) => !current)}
            >
              <span className={`read-tag-dot read-tag-dot-lg ${READ_TAG_COLORS[draft.tag] || "bg-primary"}`} />
              <span className="read-tag-trigger-label">{draft.tag}</span>
              <HiChevronUpDown className="size-4" />
            </button>
            {tagMenuOpen && (
              <div className="read-tag-popover" role="listbox" aria-label="Choose tag">
                {DEFAULT_READ_TAGS.map((tag, index) => (
                  <button
                    key={tag}
                    type="button"
                    role="option"
                    aria-selected={draft.tag === tag}
                    className={`read-tag-option ${draft.tag === tag ? "read-tag-option-active" : ""}`}
                    onClick={() => pickDraftTag(tag)}
                  >
                    <span className={`read-tag-dot read-tag-dot-lg ${READ_TAG_COLORS[tag] || "bg-primary"}`} />
                    <span className="read-tag-option-label">{tag}</span>
                    {draft.tag === tag && <HiCheck className="size-4" />}
                    <span className="read-tag-shortcut">{index + 1}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="submit">
            <HiPlus className="size-4" />
            {editingItemId ? "Save" : "Add"}
          </button>
          {editingItemId && (
            <button type="button" className="read-form-secondary" onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </form>

        <div className="read-tabs" role="tablist" aria-label="Read item status">
          <button
            type="button"
            role="tab"
            aria-selected={activeStatus === "todo"}
            className={`read-tab ${activeStatus === "todo" ? "read-tab-active" : ""}`}
            onClick={() => setActiveStatus("todo")}
          >
            Todo <span>{todoItems.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeStatus === "done"}
            className={`read-tab ${activeStatus === "done" ? "read-tab-active" : ""}`}
            onClick={() => setActiveStatus("done")}
          >
            Done <span>{doneItems.length}</span>
          </button>
        </div>

        <div className="read-sections">
          <ul className="read-list" role="tabpanel">
            {activeItems.length
              ? activeItems.map(renderItem)
              : <li className="read-empty">No {activeStatus} items.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
