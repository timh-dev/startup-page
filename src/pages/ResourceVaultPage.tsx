/*eslint-disable*/
import React from "react";
import { useLocation } from "react-router-dom";
import { HiOutlineCheckCircle, HiOutlineInboxStack, HiOutlineMagnifyingGlassCircle } from "react-icons/hi2";
import { useSettingsStore } from "@/features/settings/stores";
import LinksPane from "@/features/resourceVault/components/links/LinksPane";
import type { LinkItem } from "@/features/resourceVault/components/links/LinkRow";
import VaultItemsSection from "@/features/resourceVault/components/VaultItemsSection";
import { normalizeResourceVaultItems, normalizeVaultItems } from "@/features/resourceVault/utils";
import { DEFAULT_READ_TAGS, READ_TAG_COLORS, VAULT_KIND_DEFS, VAULT_KIND_ORDER } from "@/features/resourceVault/constants";
import { useQuickAddStore, type VaultSection } from "@/features/resourceVault/stores/quickAddStore";
import type { VaultItem, VaultItemKind } from "@/features/resourceVault/types";
import CollectionShell, { CollectionHeader, RailGroup, RailItem, RailSearch } from "@/components/layout/CollectionShell";

/** What the main pane shows: the reading list (to explore, done) or a library kind. */
type VaultView = "todo" | "done" | VaultItemKind;
const VIEW_KEY = "startup-page.vault-view";

function initialView(routed: unknown): VaultView {
  if (routed === "links") return "todo";
  if (VAULT_KIND_ORDER.includes(routed as VaultItemKind)) return routed as VaultItemKind;
  try {
    const stored = window.localStorage.getItem(VIEW_KEY);
    if (stored === "todo" || stored === "done" || VAULT_KIND_ORDER.includes(stored as VaultItemKind)) return stored as VaultView;
  } catch {
    // Storage blocked: start on the reading list.
  }
  return "todo";
}

// The Vault: a reading list (links to explore, and done) and a library of
// code snippets and templates. The sidebar switches between them and filters
// links by tag; its search looks through everything at once.
export default function ResourceVaultPage() {
  const location = useLocation();
  const settings = useSettingsStore((state) => state.settings);
  const persistSettingsToStore = useSettingsStore((state) => state.persistSettings);

  const routedSection = (location.state as { section?: unknown } | null)?.section;
  const routedFocusSearch = Boolean((location.state as { focusSearch?: unknown } | null)?.focusSearch);
  const [view, setViewState] = React.useState<VaultView>(() => initialView(routedSection));
  const [tag, setTag] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const searchRef = React.useRef<HTMLInputElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const setView = (next: VaultView) => {
    setViewState(next);
    setQuery("");
    scrollRef.current?.scrollTo({ top: 0 });
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Not remembered; that's fine.
    }
  };

  React.useEffect(() => {
    if (routedSection !== undefined) setViewState(initialView(routedSection));
  }, [routedSection]);

  React.useEffect(() => {
    if (routedFocusSearch) searchRef.current?.focus();
  }, [routedFocusSearch]);

  const persistSettings = async (nextSettings: any) => {
    await persistSettingsToStore(nextSettings);
  };

  // --- Links (readItems) ---------------------------------------------------

  const handleAddReadItem = async (item: any) => {
    const current = useSettingsStore.getState().settings;
    const items = Array.isArray(current.readItems) ? current.readItems : [];
    const nextItem = {
      id: item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: item.title,
      description: item.description,
      url: item.url,
      tag: item.tag,
      image: item.image ?? null,
      status: "todo",
      createdAt: new Date().toISOString(),
    };
    await persistSettings({ ...current, readItems: [nextItem, ...items] });
  };

  const handleToggleReadItem = async (itemId: string) => {
    const current = useSettingsStore.getState().settings;
    const items = Array.isArray(current.readItems) ? current.readItems : [];
    await persistSettings({
      ...current,
      readItems: items.map((item: any) =>
        item.id === itemId
          ? {
              ...item,
              status: item.status === "done" ? "todo" : "done",
              completedAt: item.status === "done" ? null : new Date().toISOString(),
            }
          : item,
      ),
    });
  };

  const handleUpdateReadItem = async (itemId: string, nextItem: any) => {
    const current = useSettingsStore.getState().settings;
    const items = Array.isArray(current.readItems) ? current.readItems : [];
    await persistSettings({
      ...current,
      readItems: items.map((item: any) =>
        item.id === itemId ? { ...item, ...nextItem, id: item.id, status: item.status } : item,
      ),
    });
  };

  const handleDeleteReadItem = async (itemId: string) => {
    const current = useSettingsStore.getState().settings;
    const items = Array.isArray(current.readItems) ? current.readItems : [];
    await persistSettings({
      ...current,
      readItems: items.filter((item: any) => item.id !== itemId),
    });
  };

  const handleImportReadItems = async (items: any) => {
    const current = useSettingsStore.getState().settings;
    await persistSettings({ ...current, readItems: normalizeResourceVaultItems(items) });
  };

  const handleExportReadItems = () => {
    const current = useSettingsStore.getState().settings;
    const items = normalizeResourceVaultItems(current.readItems);
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      items,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `startup-page-resource-vault-${date}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  // --- Vault items (snippets/commands/templates/expansions/prompts/docs) ---

  const handleAddVaultItem = async (item: Partial<VaultItem>) => {
    const current = useSettingsStore.getState().settings;
    const items = Array.isArray(current.vaultItems) ? current.vaultItems : [];
    const now = new Date().toISOString();
    const nextItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...item,
      createdAt: now,
      updatedAt: now,
    };
    await persistSettings({ ...current, vaultItems: [nextItem, ...items] });
  };

  const handleUpdateVaultItem = async (itemId: string, nextItem: Partial<VaultItem>) => {
    const current = useSettingsStore.getState().settings;
    const items = Array.isArray(current.vaultItems) ? current.vaultItems : [];
    await persistSettings({
      ...current,
      vaultItems: items.map((item: any) =>
        item.id === itemId
          ? { ...item, ...nextItem, updatedAt: new Date().toISOString() }
          : item,
      ),
    });
  };

  const handleDeleteVaultItem = async (itemId: string) => {
    const current = useSettingsStore.getState().settings;
    const items = Array.isArray(current.vaultItems) ? current.vaultItems : [];
    await persistSettings({
      ...current,
      vaultItems: items.filter((item: any) => item.id !== itemId),
    });
  };

  const handleImportVaultItems = async (items: any) => {
    const current = useSettingsStore.getState().settings;
    const existing = Array.isArray(current.vaultItems) ? current.vaultItems : [];
    const incoming = normalizeVaultItems(items);
    const existingIds = new Set(existing.map((item: any) => item.id));
    const deduped = incoming.filter((item) => !existingIds.has(item.id));
    await persistSettings({ ...current, vaultItems: [...deduped, ...existing] });
  };

  const handleExportVaultItems = (kind: VaultItem["kind"]) => {
    const current = useSettingsStore.getState().settings;
    const items = normalizeVaultItems(current.vaultItems, kind);
    const payload = {
      version: 1,
      kind,
      exportedAt: new Date().toISOString(),
      items,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `startup-page-vault-${kind}-${date}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const quickAddSection = useQuickAddStore((state) => (state.pending ? state.section : null));
  const consumeQuickAdd = useQuickAddStore((state) => state.consumeQuickAdd);
  // The command palette asked to add something: show where it goes.
  React.useEffect(() => {
    if (quickAddSection === "links" && view !== "todo") setView("todo");
    else if (quickAddSection && quickAddSection !== "links" && quickAddSection !== view) setView(quickAddSection as VaultItemKind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickAddSection]);

  const links = React.useMemo(() => normalizeResourceVaultItems(settings.readItems) as LinkItem[], [settings.readItems]);
  const library = React.useMemo(() => normalizeVaultItems(settings.vaultItems), [settings.vaultItems]);
  const todoCount = links.filter((item) => item.status !== "done").length;
  const doneCount = links.length - todoCount;
  const tagCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of links) counts[item.tag] = (counts[item.tag] || 0) + 1;
    return counts;
  }, [links]);

  const linkHandlers = {
    onAddItem: handleAddReadItem,
    onUpdateItem: handleUpdateReadItem,
    onToggleItem: handleToggleReadItem,
    onDeleteItem: handleDeleteReadItem,
  };
  const libraryHandlers = (kind: VaultItemKind) => ({
    onAddItem: handleAddVaultItem,
    onUpdateItem: handleUpdateVaultItem,
    onDeleteItem: handleDeleteVaultItem,
    onExportItems: () => handleExportVaultItems(kind),
    onImportItems: handleImportVaultItems,
  });

  const needle = query.trim().toLowerCase();
  const matches = (values: unknown[]) => values.some((value) => String(value || "").toLowerCase().includes(needle));
  const resultCount = needle
    ? links.filter((item) => matches([item.title, item.description, item.url, item.tag])).length +
      library.filter((item) => matches([item.title, item.description, item.body, item.subject, item.trigger, item.language, item.templateType])).length
    : 0;

  const rail = (
    <>
      <RailSearch inputRef={searchRef} value={query} onChange={setQuery} placeholder="Search the vault" />
      <RailGroup title="Reading list">
        <RailItem label="To explore" icon={HiOutlineInboxStack} count={todoCount} active={!needle && view === "todo"} onClick={() => setView("todo")} />
        <RailItem label="Completed" icon={HiOutlineCheckCircle} count={doneCount} active={!needle && view === "done"} onClick={() => setView("done")} />
      </RailGroup>
      <RailGroup title="Library">
        {VAULT_KIND_ORDER.map((kind) => (
          <RailItem
            key={kind}
            label={VAULT_KIND_DEFS[kind].label}
            icon={VAULT_KIND_DEFS[kind].icon}
            count={library.filter((item) => item.kind === kind).length}
            active={!needle && view === kind}
            onClick={() => setView(kind)}
          />
        ))}
      </RailGroup>
      {links.length > 0 && (
        <RailGroup title="Tags">
          {DEFAULT_READ_TAGS.filter((name) => tagCounts[name]).map((name) => (
            <RailItem
              key={name}
              label={name}
              dotClass={READ_TAG_COLORS[name]}
              count={tagCounts[name]}
              active={tag === name}
              onClick={() => {
                setTag(tag === name ? null : name);
                if (view !== "todo" && view !== "done") setView("todo");
              }}
            />
          ))}
        </RailGroup>
      )}
    </>
  );

  return (
    <CollectionShell label="Vault" rail={rail} scrollRef={scrollRef}>
      {needle ? (
        <div className="collection-pane">
          <CollectionHeader eyebrow="Search" title={`“${query.trim()}”`} count={resultCount} />
          <LinksPane embedded items={settings.readItems} status="all" tag={null} onTag={setTag} query={query} {...linkHandlers} />
          {VAULT_KIND_ORDER.map((kind) => (
            <VaultItemsSection key={kind} embedded kind={kind} items={settings.vaultItems} query={query} {...libraryHandlers(kind)} />
          ))}
          {!resultCount && (
            <div className="collection-empty">
              <HiOutlineMagnifyingGlassCircle className="collection-empty-icon" />
              <p className="collection-empty-title">Nothing matches</p>
              <p className="collection-empty-hint">Search looks through links, code and templates: titles, notes, addresses and contents.</p>
            </div>
          )}
        </div>
      ) : view === "todo" || view === "done" ? (
        <LinksPane
          items={settings.readItems}
          status={view}
          tag={tag}
          onTag={setTag}
          {...linkHandlers}
          onExportItems={handleExportReadItems}
          onImportItems={handleImportReadItems}
          quickAddPending={quickAddSection === "links"}
          onQuickAddConsumed={consumeQuickAdd}
        />
      ) : (
        <VaultItemsSection
          key={view}
          kind={view}
          items={settings.vaultItems}
          {...libraryHandlers(view)}
          quickAddPending={quickAddSection === view}
          onQuickAddConsumed={consumeQuickAdd}
        />
      )}
    </CollectionShell>
  );
}
