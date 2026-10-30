import React from "react";
import {
  HiArrowDownTray,
  HiArrowUpTray,
  HiArrowsUpDown,
  HiOutlineAdjustmentsHorizontal,
  HiOutlineInboxStack,
  HiOutlineMagnifyingGlassCircle,
  HiOutlineSparkles,
  HiPlus,
  HiXMark,
} from "react-icons/hi2";

import { CollectionHeader, MoreMenu } from "@/components/layout/CollectionShell";
import { READ_TAG_COLORS } from "@/features/resourceVault/constants";
import { useUndoableDelete } from "@/features/resourceVault/hooks/useUndoableDelete";
import { fetchLinkPreview, looksLikeUrl, normalizeUrl, titleFromUrl } from "@/features/resourceVault/linkPreview";
import { groupItemsByDate, normalizeResourceVaultItems } from "@/features/resourceVault/utils";
import UndoToastStack from "../UndoToastStack";
import LinkComposer, { type LinkDraft } from "./LinkComposer";
import LinkRow, { type LinkItem } from "./LinkRow";

export type LinkStatus = "todo" | "done" | "all";

export interface LinksPaneProps {
  items: unknown;
  status: LinkStatus;
  /** Only links with this tag (null: all). */
  tag: string | null;
  onTag: (tag: string | null) => void;
  /** Filters the list; set from the sidebar's search. */
  query?: string;
  /** In search results: a section of the results, without adding or the toolbar. */
  embedded?: boolean;
  onAddItem: (item: LinkDraft & { id?: string }) => void;
  onUpdateItem: (id: string, item: Partial<LinkItem>) => void;
  onToggleItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onExportItems?: () => void;
  onImportItems?: (items: any[]) => Promise<void>;
  /** The command palette asked to add a link: focus the add field. */
  quickAddPending?: boolean;
  onQuickAddConsumed?: () => void;
}

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const TITLES: Record<LinkStatus, string> = { todo: "To explore", done: "Completed", all: "Links" };

export default function LinksPane({
  items,
  status,
  tag,
  onTag,
  query = "",
  embedded,
  onAddItem,
  onUpdateItem,
  onToggleItem,
  onDeleteItem,
  onExportItems,
  onImportItems,
  quickAddPending,
  onQuickAddConsumed,
}: LinksPaneProps) {
  const importInputRef = React.useRef<HTMLInputElement>(null);
  const quickRef = React.useRef<HTMLInputElement>(null);
  const [quick, setQuick] = React.useState("");
  const [sortDirection, setSortDirection] = React.useState<"desc" | "asc">("desc");
  // A new link with every field ("Details"), or the link being edited (in place).
  const [composer, setComposer] = React.useState<{ editing: LinkItem | null; initial?: Partial<LinkDraft> } | null>(null);
  const [lastTag, setLastTag] = React.useState("Read");
  const [message, setMessage] = React.useState("");
  const [fetching, setFetching] = React.useState<Set<string>>(() => new Set());
  const { pendingIds, toasts, deleteWithUndo, undo } = useUndoableDelete(onDeleteItem);

  const all = React.useMemo(
    () => (Array.isArray(items) ? (items as LinkItem[]) : []).filter((item) => !pendingIds.has(item.id)),
    [items, pendingIds],
  );
  const latest = React.useRef(all);
  latest.current = all;

  React.useEffect(() => {
    if (!quickAddPending) return;
    quickRef.current?.focus();
    onQuickAddConsumed?.();
  }, [quickAddPending, onQuickAddConsumed]);

  React.useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(""), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const visible = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return all
      .filter((item) => status === "all" || (status === "done") === (item.status === "done"))
      .filter((item) => !tag || item.tag === tag)
      .filter((item) => !needle || [item.title, item.description, item.url, item.tag].some((value) => String(value || "").toLowerCase().includes(needle)))
      .sort((a, b) => {
        const at = new Date((a.status === "done" ? a.completedAt : null) || a.createdAt || 0).getTime();
        const bt = new Date((b.status === "done" ? b.completedAt : null) || b.createdAt || 0).getTime();
        return sortDirection === "desc" ? bt - at : at - bt;
      });
  }, [all, status, tag, query, sortDirection]);

  // By day; in search results, one plain list.
  const groups = React.useMemo(
    () =>
      embedded
        ? visible.length
          ? [{ label: "", items: visible }]
          : []
        : groupItemsByDate(visible, (item: LinkItem) => (item.status === "done" ? item.completedAt || item.createdAt : item.createdAt)),
    [visible, embedded],
  );

  // Paste a link and it's saved straight away, titled from its address; the
  // real title, note, tag and image fill in once the preview arrives (unless
  // the link was edited in the meantime). Plain text saves a title-only item.
  const quickAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = quick.trim();
    if (!text) return;
    setQuick("");
    const itemTag = tag ?? lastTag;
    if (!looksLikeUrl(text)) {
      onAddItem({ title: text, url: "", description: "", tag: itemTag });
      return;
    }
    const url = normalizeUrl(text);
    const id = newId();
    const placeholder = titleFromUrl(url);
    onAddItem({ id, title: placeholder, url, description: "", tag: itemTag });
    setFetching((current) => new Set(current).add(id));
    const preview = await fetchLinkPreview(url);
    setFetching((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    const saved = latest.current.find((item) => item.id === id);
    if (!preview || !saved || saved.title !== placeholder) return;
    onUpdateItem(id, {
      title: preview.title || placeholder,
      description: preview.description || "",
      // A tag the user filtered by is deliberate; otherwise take the suggestion.
      tag: tag ?? preview.tag ?? itemTag,
      image: preview.image,
    });
  };

  const submitComposer = (draft: LinkDraft) => {
    if (composer?.editing) onUpdateItem(composer.editing.id, draft);
    else onAddItem(draft);
    setLastTag(draft.tag);
    setComposer(null);
  };

  const importFile = async (file: File | undefined) => {
    if (!file || !onImportItems) return;
    try {
      const imported = normalizeResourceVaultItems(JSON.parse(await file.text()));
      if (!imported.length) {
        setMessage("No links found in that file.");
        return;
      }
      await onImportItems(imported);
      setMessage(`Imported ${imported.length} links.`);
    } catch {
      setMessage("Couldn't read that JSON file.");
    }
  };

  const composerFor = (editing: LinkItem | null, initial?: Partial<LinkDraft>) => (
    <LinkComposer
      key={editing?.id ?? "new"}
      editingItem={editing}
      initial={initial}
      defaultTag={tag ?? lastTag}
      onSubmit={submitComposer}
      onCancel={(picked) => {
        setLastTag(picked);
        setComposer(null);
      }}
    />
  );

  const list = groups.length ? (
    groups.map((group) => (
      <section key={group.label} className="collection-group">
        {group.label && (
          <h2 className="collection-group-label">
            {group.label}
            <span className="numeric">{group.items.length}</span>
          </h2>
        )}
        <ul className="link-list">
          {group.items.map((item: LinkItem) =>
            composer?.editing?.id === item.id ? (
              <li key={item.id} className="link-row-editing">
                {composerFor(item)}
              </li>
            ) : (
              <LinkRow
                key={item.id}
                item={item}
                fetching={fetching.has(item.id)}
                onToggle={onToggleItem}
                onEdit={(editing) => setComposer({ editing })}
                onDelete={(target) => deleteWithUndo(target.id, target.title)}
                onTag={(picked) => onTag(picked)}
              />
            ),
          )}
        </ul>
      </section>
    ))
  ) : embedded ? null : (
    <div className="collection-empty">
      {query.trim() || tag ? (
        <>
          <HiOutlineMagnifyingGlassCircle className="collection-empty-icon" />
          <p className="collection-empty-title">No matches</p>
          <p className="collection-empty-hint">Try another search or tag.</p>
        </>
      ) : status === "done" ? (
        <>
          <HiOutlineSparkles className="collection-empty-icon" />
          <p className="collection-empty-title">Nothing completed yet</p>
          <p className="collection-empty-hint">Links you check off collect here.</p>
        </>
      ) : (
        <>
          <HiOutlineInboxStack className="collection-empty-icon" />
          <p className="collection-empty-title">Your reading list is empty</p>
          <p className="collection-empty-hint">Paste a link above: articles, videos, tools, anything to come back to.</p>
        </>
      )}
    </div>
  );

  if (embedded) {
    if (!visible.length) return null;
    return (
      <div className="collection-results-section">
        <h2 className="collection-results-title">
          Links <span className="numeric">{visible.length}</span>
        </h2>
        {list}
        <UndoToastStack toasts={toasts} onUndo={undo} />
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

      <CollectionHeader eyebrow="Reading list" title={TITLES[status]} count={visible.length}>
        {tag && (
          <button type="button" className={`collection-filter-chip ${READ_TAG_COLORS[tag] || ""}`} onClick={() => onTag(null)} title="Show every tag">
            <span className="read-tag-dot" aria-hidden="true" />
            {tag}
            <HiXMark className="size-3" />
          </button>
        )}
        <button
          type="button"
          className="collection-icon-btn"
          onClick={() => setSortDirection((current) => (current === "desc" ? "asc" : "desc"))}
          title={sortDirection === "desc" ? "Newest first (click for oldest)" : "Oldest first (click for newest)"}
          aria-label={sortDirection === "desc" ? "Sorted newest first" : "Sorted oldest first"}
        >
          <HiArrowsUpDown className="size-4" />
        </button>
        <MoreMenu
          label="More link actions"
          items={[
            { label: "Import links (JSON)…", icon: HiArrowUpTray, onSelect: () => importInputRef.current?.click() },
            ...(onExportItems ? [{ label: "Export links (JSON)", icon: HiArrowDownTray, onSelect: onExportItems }] : []),
          ]}
        />
      </CollectionHeader>

      {status !== "done" && (
        <form className="quick-add" onSubmit={quickAdd}>
          <HiPlus className="quick-add-icon" aria-hidden="true" />
          <input
            ref={quickRef}
            value={quick}
            onChange={(event) => setQuick(event.target.value)}
            placeholder="Paste a link, or type a title, and press Enter"
            aria-label="Add a link"
          />
          <button
            type="button"
            className="quick-add-details"
            onClick={() => {
              const text = quick.trim();
              setComposer({ editing: null, initial: looksLikeUrl(text) ? { url: normalizeUrl(text) } : { title: text } });
              setQuick("");
            }}
            title="Add with a title, note and tag"
          >
            <HiOutlineAdjustmentsHorizontal className="size-4" />
            <span>Details</span>
          </button>
        </form>
      )}

      {composer && !composer.editing && <div className="link-composer-new">{composerFor(null, composer.initial)}</div>}

      {message && (
        <p className="collection-message" role="status">
          {message}
        </p>
      )}

      {list}

      <UndoToastStack toasts={toasts} onUndo={undo} />
    </div>
  );
}
