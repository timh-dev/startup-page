/*eslint-disable*/
import React from "react";
import { KBarProvider, useRegisterActions } from "kbar";
import { HiArchiveBox, HiArrowLeft, HiArrowTopRightOnSquare, HiBookmark, HiCheck, HiChevronLeft, HiChevronRight, HiChevronUpDown, HiHome, HiMinus, HiPencil, HiPlus, HiTrash } from "react-icons/hi2";

import { readSettings, writeSettings } from '../lib/settings';
import { isBuiltInPalette } from '../lib/theme-palettes';
import {
  DASHBOARD_LARGE_TILE,
  DASHBOARD_TALL_TILE,
  DASHBOARD_TILE,
  DASHBOARD_WIDE_TILE,
  GRID_FEATURE,
  GRID_SINGLE,
  GRID_SOLAR,
  GRID_TALL,
  GRID_WIDE,
} from "../lib/dashboard-dimensions";

// components
import Clock from "../components/Clock";
import FeaturePanel from "../components/FeaturePanel";
import Unsplash from "../components/Unsplash";
import SearchBox from "../components/Search";
import SolarGraph from "../components/SolarGraph/index";
import { WeatherBox } from "../components/weather/WeatherBox";
import Toggle from "../components/ThemeToggle";
import ThemeProvider from "../components/ThemeContext";
import Bookmark, { faviconFallbackLabel, faviconSrcSet, faviconUrl, isSelfHostedUrl, LocalServiceStatus } from "../components/Bookmark";
import SettingsButton from "../components/SettingsButton";
import CommandPalette from "../components/CommandPalette";
import useKBarActions from "../hooks/useKBarActions";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";

// assets
import desert from "../assets/media/desert.mp4"

const STARTUP_PAGE_VIEW_KEY = "startup-page.active-view";
const STARTUP_PAGE_BOOKMARK_CATEGORY_KEY = "startup-page.active-bookmark-category";
const RESOURCE_VAULT_SKIP_DELETE_CONFIRM_KEY = "startup-page.resource-vault.skip-delete-confirm";
const VALID_PAGE_VIEWS = new Set(["dashboard", "bookmarks", "read"]);

const DEFAULT_READ_TAGS = ["Read", "Watch", "Listen", "Browse", "Use", "Build", "Learn", "Join", "Follow"];

const READ_TAG_COLORS = {
  Read: "read-tag-read",
  Watch: "read-tag-watch",
  Listen: "read-tag-listen",
  Browse: "read-tag-browse",
  Use: "read-tag-use",
  Build: "read-tag-build",
  Learn: "read-tag-learn",
  Join: "read-tag-join",
  Follow: "read-tag-follow",
};

const detectBookmarkBrowser = () => {
  if (typeof navigator === "undefined") {
    return "your browser";
  }

  const userAgent = navigator.userAgent || "";

  if (/firefox/i.test(userAgent)) {
    return "Firefox";
  }

  if (/chrome|crios/i.test(userAgent) && !/edg|opr|opera/i.test(userAgent)) {
    return "Chrome";
  }

  if (/edg/i.test(userAgent)) {
    return "Edge";
  }

  if (/opr|opera/i.test(userAgent)) {
    return "Opera";
  }

  if (/safari/i.test(userAgent) && !/chrome|crios/i.test(userAgent)) {
    return "Safari";
  }

  return "your browser";
};

function countBookmarksInGroup(group) {
  return (
    (Array.isArray(group?.content) ? group.content.length : 0) +
    (Array.isArray(group?.children) ? group.children.reduce((total, child) => total + countBookmarksInGroup(child), 0) : 0)
  );
}

const getGroupCollapseKey = (path) => path.join(" / ");

function escapeBookmarkHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createBookmarksExportHtml(groups) {
  function renderGroup(group, depth = 1) {
    const indent = "    ".repeat(depth);
    const childIndent = "    ".repeat(depth + 1);
    const content = Array.isArray(group.content) ? group.content : [];
    const children = Array.isArray(group.children) ? group.children : [];

    return [
      `${indent}<DT><H3>${escapeBookmarkHtml(group.title || "Bookmarks")}</H3>`,
      `${indent}<DL><p>`,
      ...content.map((bookmark) =>
        `${childIndent}<DT><A HREF="${escapeBookmarkHtml(bookmark.url)}">${escapeBookmarkHtml(bookmark.name || bookmark.url)}</A>`
      ),
      ...children.map((child) => renderGroup(child, depth + 1)),
      `${indent}</DL><p>`,
    ].join("\n");
  }

  return [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    "<TITLE>Bookmarks</TITLE>",
    "<H1>Bookmarks</H1>",
    "<DL><p>",
    ...groups.map((group) => renderGroup(group)),
    "</DL><p>",
    "",
  ].join("\n");
}

function parseBrowserBookmarksHtml(html) {
  const parser = new DOMParser();
  const document = parser.parseFromString(html, "text/html");
  const roots = [];
  const uncategorized = { title: "Uncategorized", content: [], children: [] };

  function getDirectBookmarkLinks(node) {
    return Array.from(node.children)
      .filter((child) => child.tagName === "DT")
      .map((child) => Array.from(child.children).find((grandchild) => grandchild.tagName === "A"))
      .filter(Boolean)
      .map((anchor) => ({
        name: (anchor.textContent || anchor.href || "Bookmark").trim(),
        url: anchor.getAttribute("href") || anchor.href,
      }))
      .filter((bookmark) => bookmark.url);
  }

  function parseFolder(heading) {
    const folder = {
      title: (heading.textContent || "Imported Folder").trim(),
      content: [],
      children: [],
    };
    const dl = heading.parentElement?.nextElementSibling?.tagName === "DL"
      ? heading.parentElement.nextElementSibling
      : heading.nextElementSibling?.tagName === "DL"
        ? heading.nextElementSibling
        : null;

    if (!dl) {
      return folder;
    }

    folder.content = getDirectBookmarkLinks(dl);
    Array.from(dl.children)
      .filter((child) => child.tagName === "DT")
      .forEach((child) => {
        const childHeading = Array.from(child.children).find((grandchild) => grandchild.tagName === "H3");

        if (childHeading) {
          folder.children.push(parseFolder(childHeading));
        }
      });

    return folder;
  }

  const rootDl = document.querySelector("dl");

  if (!rootDl) {
    return [];
  }

  uncategorized.content = getDirectBookmarkLinks(rootDl);
  Array.from(rootDl.children)
    .filter((child) => child.tagName === "DT")
    .forEach((child) => {
      const heading = Array.from(child.children).find((grandchild) => grandchild.tagName === "H3");

      if (heading) {
        roots.push(parseFolder(heading));
      }
    });

  if (uncategorized.content.length) {
    roots.unshift(uncategorized);
  }

  return roots.filter((group) => countBookmarksInGroup(group) > 0);
}

function DecorativeVideoTile({
  className,
  src,
  fallbackSrc,
  width,
  height,
  left,
  top,
}) {
  const [activeSrc, setActiveSrc] = React.useState(src || fallbackSrc);

  React.useEffect(() => {
    setActiveSrc(src || fallbackSrc);
  }, [src, fallbackSrc]);

  return (
    <div className={`${className} relative overflow-hidden`}>
      <video
        key={activeSrc}
        className="absolute max-w-none object-cover"
        style={{
          width,
          height,
          left,
          top,
        }}
        src={activeSrc}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        referrerPolicy="no-referrer"
        onError={() => {
          if (activeSrc !== fallbackSrc) {
            setActiveSrc(fallbackSrc);
          }
        }}
      />
    </div>
  );
}

function KBarWrapper({ children }) {
  useKBarActions();
  return (
    <>
      <CommandPalette />
      {children}
    </>
  );
}

function VaultNavigationActions({ onDashboard, onOpenBookmarks, onOpenResources }) {
  const actions = React.useMemo(() => [
    {
      id: "open-bookmark-vault",
      name: "Open Bookmark Vault",
      shortcut: ["3"],
      section: "Navigation",
      perform: onOpenBookmarks,
    },
    {
      id: "open-resource-vault",
      name: "Open Resource Vault",
      shortcut: ["1"],
      section: "Navigation",
      perform: onOpenResources,
    },
    {
      id: "show-dashboard",
      name: "Show Dashboard",
      shortcut: ["2"],
      section: "Navigation",
      perform: onDashboard,
    },
  ], [onDashboard, onOpenBookmarks, onOpenResources]);

  useRegisterActions(actions, [actions]);
  return null;
}

function formatReadDate(value) {
  const date = value ? new Date(value) : new Date();
  const month = date.toLocaleString(undefined, { month: "short" }).toUpperCase();
  const day = String(date.getDate()).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${month} ${day}, ${year}`;
}

function normalizeResourceVaultItems(value) {
  const sourceItems = Array.isArray(value)
    ? value
    : Array.isArray(value?.readItems)
      ? value.readItems
      : Array.isArray(value?.items)
        ? value.items
        : [];

  return sourceItems
    .map((item, index) => {
      const title = String(item?.title || "").trim();

      if (!title) {
        return null;
      }

      const createdAt = item?.createdAt && !Number.isNaN(new Date(item.createdAt).getTime())
        ? new Date(item.createdAt).toISOString()
        : new Date().toISOString();
      const status = item?.status === "done" ? "done" : "todo";
      const completedAt = status === "done" && item?.completedAt && !Number.isNaN(new Date(item.completedAt).getTime())
        ? new Date(item.completedAt).toISOString()
        : status === "done"
          ? createdAt
          : null;

      return {
        id: String(item?.id || `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`),
        title,
        description: String(item?.description || "").trim(),
        url: String(item?.url || "").trim(),
        tag: DEFAULT_READ_TAGS.includes(item?.tag) ? item.tag : "Read",
        status,
        createdAt,
        completedAt,
      };
    })
    .filter(Boolean);
}

function ResourceVaultPreview({ items, onOpen }) {
  const recentItems = React.useMemo(() => (
    normalizeResourceVaultItems(items)
      .sort((a, b) => {
        const aTime = new Date(a.completedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.completedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 10)
  ), [items]);

  return (
    <button type="button" className="vault-preview" onClick={onOpen} title="Open Resource Vault">
      <div className="vault-preview-header">
        <span>Vault</span>
        <HiArchiveBox className="size-4" />
      </div>
      <ul className="vault-preview-list">
        {recentItems.length ? recentItems.map((item) => (
          <li key={item.id} className="vault-preview-item">
            <span className={`read-tag-dot ${READ_TAG_COLORS[item.tag] || "bg-primary"}`} />
            <span className={`vault-preview-title ${item.status === "done" ? "line-through opacity-55" : ""}`}>
              {item.title}
            </span>
          </li>
        )) : (
          <li className="vault-preview-empty">No resources yet.</li>
        )}
      </ul>
    </button>
  );
}

function ReadView({
  items,
  onAddItem,
  onBack,
  onDeleteItem,
  onExportItems,
  onImportItems,
  onToggleItem,
  onUpdateItem,
}) {
  const importInputRef = React.useRef(null);
  const [query, setQuery] = React.useState("");
  const [activeTag, setActiveTag] = React.useState("All");
  const [activeStatus, setActiveStatus] = React.useState("todo");
  const [sortDirection, setSortDirection] = React.useState("desc");
  const [tagMenuOpen, setTagMenuOpen] = React.useState(false);
  const tagMenuRef = React.useRef(null);
  const [editingItemId, setEditingItemId] = React.useState(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = React.useState(null);
  const [rememberDeleteConfirm, setRememberDeleteConfirm] = React.useState(false);
  const [skipDeleteConfirm, setSkipDeleteConfirm] = React.useState(() => (
    typeof window !== "undefined" && window.localStorage?.getItem(RESOURCE_VAULT_SKIP_DELETE_CONFIRM_KEY) === "true"
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
      .filter((item) => {
        const matchesQuery = !lowerQuery || [
          item.title,
          item.description,
          item.url,
          item.tag,
        ].some((value) => String(value || "").toLowerCase().includes(lowerQuery));
        const matchesTag = activeTag === "All" || item.tag === activeTag;
        return matchesQuery && matchesTag;
      })
      .sort((a, b) => {
        const aSortDate = a.status === "done" ? (a.completedAt || a.createdAt) : a.createdAt;
        const bSortDate = b.status === "done" ? (b.completedAt || b.createdAt) : b.createdAt;
        const aTime = new Date(aSortDate || 0).getTime();
        const bTime = new Date(bSortDate || 0).getTime();
        return sortDirection === "desc" ? bTime - aTime : aTime - bTime;
      });
  }, [activeTag, normalizedItems, query, sortDirection]);

  const todoItems = visibleItems.filter((item) => item.status !== "done");
  const doneItems = visibleItems.filter((item) => item.status === "done");
  const activeItems = activeStatus === "todo" ? todoItems : doneItems;
  const pickDraftTag = React.useCallback((tag) => {
    setDraft((current) => ({ ...current, tag }));
    setTagMenuOpen(false);
  }, []);

  React.useEffect(() => {
    if (!tagMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (tagMenuRef.current && !tagMenuRef.current.contains(event.target)) {
        setTagMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
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

  const submitDraft = (event) => {
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

  const editItem = (item) => {
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

  const requestDeleteItem = (itemId) => {
    if (skipDeleteConfirm) {
      onDeleteItem(itemId);
      return;
    }

    setConfirmingDeleteId((current) => (current === itemId ? null : itemId));
  };

  const confirmDeleteItem = (itemId) => {
    if (rememberDeleteConfirm && typeof window !== "undefined") {
      window.localStorage?.setItem(RESOURCE_VAULT_SKIP_DELETE_CONFIRM_KEY, "true");
      setSkipDeleteConfirm(true);
    }

    setConfirmingDeleteId(null);
    onDeleteItem(itemId);
  };

  const importResourceVault = async (file) => {
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

  const renderItem = (item) => (
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

function BookmarkView({
  bookmarks,
  activeCategoryIndex,
  onBack,
  onAddBookmark,
  onRemoveBookmark,
  onUpdateBookmark,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
  onMoveCategory,
  onMoveBookmark,
  onReorderCategory,
  onReorderBookmark,
  onImportBookmarks,
  onExportBookmarks,
  pillSize = 3.25,
}) {
  const fileInputRef = React.useRef(null);
  const detectedBrowser = React.useMemo(() => detectBookmarkBrowser(), []);
  const [addOpen, setAddOpen] = React.useState(false);
  const [categoryOpen, setCategoryOpen] = React.useState(false);
  const [editingBookmark, setEditingBookmark] = React.useState(null);
  const [editingCategory, setEditingCategory] = React.useState(null);
  const [categoryDraft, setCategoryDraft] = React.useState("");
  const [categoryParentPath, setCategoryParentPath] = React.useState("");
  const [collapsedCategories, setCollapsedCategories] = React.useState(() => new Set());
  const [draggedItem, setDraggedItem] = React.useState(null);
  const [dragOverItem, setDragOverItem] = React.useState(null);
  const [importOpen, setImportOpen] = React.useState(false);
  const [importError, setImportError] = React.useState("");
  const [draggingImport, setDraggingImport] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const [draft, setDraft] = React.useState({
    categoryPath: String(activeCategoryIndex ?? 0),
    name: "",
    url: "",
  });

  React.useEffect(() => {
    setDraft((prev) => ({
      ...prev,
      categoryPath: String(activeCategoryIndex ?? prev.categoryPath ?? 0),
    }));
  }, [activeCategoryIndex]);

  React.useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const orderedBookmarks = React.useMemo(() => {
    const active = bookmarks[activeCategoryIndex];

    if (!active) {
      return bookmarks.map((group, index) => ({ ...group, originalIndex: index }));
    }

    return [
      { ...active, originalIndex: activeCategoryIndex },
      ...bookmarks
        .map((group, index) => ({ ...group, originalIndex: index }))
        .filter((group) => group.originalIndex !== activeCategoryIndex),
    ];
  }, [bookmarks, activeCategoryIndex]);

  const serializeCategoryPath = (path) => (Array.isArray(path) ? path : [path]).join(".");
  const parseCategoryPath = (value) => String(value).split(".").map((part) => Number(part)).filter((part) => Number.isInteger(part));
  const categoryPathsMatch = (left, right) => serializeCategoryPath(left) === serializeCategoryPath(right);
  const getCategoryPillClass = (isCollapsed, nested = false) => (
    isCollapsed
      ? "bg-amber-400 font-semibold text-slate-950 ring-2 ring-amber-100/80"
      : nested
        ? "bg-cyan-400 font-semibold text-slate-950 ring-2 ring-cyan-100/80"
        : "bg-primary font-medium text-primary-foreground"
  );
  const getCategoryOptions = (groups, parentPath = [], depth = 0) => (
    groups.flatMap((group, index) => {
      const path = [...parentPath, index];
      const children = Array.isArray(group.children) ? group.children : [];
      return [
        { label: `${"  ".repeat(depth)}${group.title}`, value: serializeCategoryPath(path) },
        ...getCategoryOptions(children, path, depth + 1),
      ];
    })
  );
  const categoryOptions = React.useMemo(() => getCategoryOptions(bookmarks), [bookmarks]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const name = draft.name.trim();
    const url = draft.url.trim();

    if (!name || !url) {
      return;
    }

    if (editingBookmark) {
      await onUpdateBookmark(editingBookmark.categoryPath, editingBookmark.bookmarkIndex, { name, url });
      setEditingBookmark(null);
    } else {
      await onAddBookmark(parseCategoryPath(draft.categoryPath), { name, url });
    }

    setDraft((prev) => ({ ...prev, name: "", url: "" }));
    setAddOpen(false);
  };

  const handleEditBookmark = (categoryPath, bookmarkIndex, bookmark) => {
    setEditingBookmark({ categoryPath, bookmarkIndex });
    setDraft({
      categoryPath: serializeCategoryPath(categoryPath),
      name: bookmark.name || "",
      url: bookmark.url || "",
    });
    setAddOpen(true);
  };

  const handleEditCategory = (categoryPath, title) => {
    setEditingCategory({ categoryPath, previousTitle: title });
    setCategoryDraft(title || "");
    setCategoryParentPath("");
    setAddOpen(false);
    setEditingBookmark(null);
    setCategoryOpen(true);
  };

  const handleDeleteCategory = async (categoryPath, title) => {
    await onDeleteCategory(categoryPath);
    setCollapsedCategories((current) => {
      const next = new Set(current);
      next.delete(title);
      return next;
    });

    if (editingCategory && categoryPathsMatch(editingCategory.categoryPath, categoryPath)) {
      setEditingCategory(null);
      setCategoryDraft("");
      setCategoryOpen(false);
    }
  };

  const toggleCategoryCollapsed = (categoryTitle) => {
    setCollapsedCategories((current) => {
      const next = new Set(current);

      if (next.has(categoryTitle)) {
        next.delete(categoryTitle);
      } else {
        next.add(categoryTitle);
      }

      return next;
    });
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleCategoryDrop = async (event, targetCategoryIndex) => {
    event.preventDefault();

    if (!draggedItem) {
      return;
    }

    if (draggedItem.type === "category" && draggedItem.categoryIndex !== targetCategoryIndex) {
      await onReorderCategory(draggedItem.categoryIndex, targetCategoryIndex);
    }

    if (draggedItem.type === "bookmark") {
      const targetContent = bookmarks[targetCategoryIndex]?.content || [];
      await onReorderBookmark(
        draggedItem.categoryIndex,
        draggedItem.bookmarkIndex,
        targetCategoryIndex,
        targetContent.length
      );
    }

    handleDragEnd();
  };

  const handleBookmarkDrop = async (event, targetCategoryIndex, targetBookmarkIndex) => {
    event.preventDefault();

    if (draggedItem?.type !== "bookmark") {
      handleDragEnd();
      return;
    }

    await onReorderBookmark(
      draggedItem.categoryIndex,
      draggedItem.bookmarkIndex,
      targetCategoryIndex,
      targetBookmarkIndex
    );
    handleDragEnd();
  };

  const handleAddToggle = () => {
    setEditingBookmark(null);
    setCategoryOpen(false);
    setDraft((prev) => ({
      ...prev,
      categoryPath: String(activeCategoryIndex ?? prev.categoryPath ?? 0),
      name: "",
      url: "",
    }));
    setAddOpen((open) => !open);
  };

  const showToast = (message) => {
    setToast(message);
  };

  const openImportModal = () => {
    setImportError("");
    setImportOpen(true);
  };

  const importBookmarkFile = async (file) => {
    if (!file) {
      return;
    }

    try {
      const html = await file.text();
      const importedGroups = parseBrowserBookmarksHtml(html);

      if (!importedGroups.length) {
        const message = "No bookmarks were found in that export file. Use your browser's HTML bookmark export.";
        setImportError(message);
        showToast(message);
        return;
      }

      await onImportBookmarks(importedGroups);
      setImportOpen(false);
      setImportError("");
      showToast(`Imported ${importedGroups.reduce((total, group) => total + countBookmarksInGroup(group), 0)} bookmarks.`);
    } catch (_error) {
      const message = "Could not import that bookmarks file. Try an HTML bookmarks export from your browser.";
      setImportError(message);
      showToast(message);
    }
  };

  const handleImportFile = async (event) => {
    const [file] = Array.from(event.target.files || []);
    event.target.value = "";
    await importBookmarkFile(file);
  };

  const handleImportDrop = async (event) => {
    event.preventDefault();
    setDraggingImport(false);
    const [file] = Array.from(event.dataTransfer.files || []);
    await importBookmarkFile(file);
  };

  const handleCategorySubmit = async (event) => {
    event.preventDefault();
    const title = categoryDraft.trim();

    if (!title) {
      return;
    }

    if (editingCategory) {
      await onRenameCategory(editingCategory.categoryPath, title);
      setCollapsedCategories((current) => {
        const next = new Set(current);

        if (next.has(editingCategory.previousTitle)) {
          next.delete(editingCategory.previousTitle);
          next.add(title);
        }

        return next;
      });
      setEditingCategory(null);
    } else {
      await onAddCategory(title, categoryParentPath ? parseCategoryPath(categoryParentPath) : null);
      setCollapsedCategories((current) => {
        const next = new Set(current);
        next.delete(title);
        return next;
      });
    }

    setCategoryDraft("");
    setCategoryParentPath("");
    setCategoryOpen(false);
  };

  const pillHeight = Math.max(2.5, Math.min(Number(pillSize) || 3.25, 5)) * 16;
  const iconWrapSize = Math.max(28, pillHeight - 14);
  const iconSize = Math.max(16, pillHeight * 0.38);
  const textSize = Math.max(14, pillHeight * 0.34);
  const gap = Math.max(8, pillHeight * 0.2);
  const pillStyle = {
    height: `${pillHeight}px`,
    maxWidth: `${pillHeight * 5.4}px`,
    paddingLeft: `${pillHeight * 0.42}px`,
    paddingRight: `${pillHeight * 0.55}px`,
    fontSize: `${textSize}px`,
  };
  const bookmarkPillStyle = {
    ...pillStyle,
    gap: `${gap}px`,
    paddingLeft: `${pillHeight * 0.11}px`,
  };
  const iconWrapStyle = {
    width: `${iconWrapSize}px`,
    height: `${iconWrapSize}px`,
  };
  const addButtonStyle = {
    width: `${pillHeight}px`,
    height: `${pillHeight}px`,
    fontSize: `${pillHeight * 0.5}px`,
  };
  const controlButtonStyle = {
    width: `${Math.max(22, pillHeight * 0.42)}px`,
    height: `${Math.max(22, pillHeight * 0.42)}px`,
  };

  function renderNestedGroup(group, categoryPath, labelPath, depth = 1) {
    const content = Array.isArray(group.content) ? group.content : [];
    const children = Array.isArray(group.children) ? group.children : [];
    const collapseKey = getGroupCollapseKey(labelPath);
    const isCollapsed = collapsedCategories.has(collapseKey);

    return (
      <React.Fragment key={collapseKey}>
        <span className="group/category relative inline-flex" style={{ marginLeft: `${Math.min(depth * 18, 72)}px` }}>
          <button
            type="button"
            onClick={() => toggleCategoryCollapsed(collapseKey)}
            className={`inline-flex items-center justify-between gap-2 rounded-full shadow-lg transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring ${getCategoryPillClass(isCollapsed, true)}`}
            style={pillStyle}
            title={`${isCollapsed ? "Expand" : "Collapse"} ${group.title}`}
            aria-expanded={!isCollapsed}
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <span
                className="inline-flex shrink-0 items-center justify-center rounded-full bg-background/25 text-current"
                style={{
                  width: `${Math.max(20, iconSize * 1.05)}px`,
                  height: `${Math.max(20, iconSize * 1.05)}px`,
                }}
              >
                {isCollapsed ? (
                  <HiPlus style={{ width: `${Math.max(12, iconSize * 0.62)}px`, height: `${Math.max(12, iconSize * 0.62)}px` }} />
                ) : (
                  <HiMinus style={{ width: `${Math.max(12, iconSize * 0.62)}px`, height: `${Math.max(12, iconSize * 0.62)}px` }} />
                )}
              </span>
              <span className="rounded-full bg-background/35 px-2 py-0.5 text-[0.65em] uppercase tracking-wide text-current">
                Sub
              </span>
              <span className="block truncate">{group.title}</span>
            </span>
            <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-background/20 px-2 py-0.5 text-[0.72em]">
              {countBookmarksInGroup(group)}
            </span>
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleEditCategory(categoryPath, group.title);
            }}
            className="absolute -right-1.5 -top-1.5 inline-flex items-center justify-center rounded-full border border-border/60 bg-card text-card-foreground opacity-0 shadow-md transition hover:bg-accent hover:text-accent-foreground focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring group-hover/category:opacity-100"
            style={controlButtonStyle}
            title={`Rename ${group.title}`}
          >
            <HiPencil className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleDeleteCategory(categoryPath, group.title);
            }}
            className="absolute -left-1.5 -top-1.5 inline-flex items-center justify-center rounded-full border border-border/60 bg-card text-card-foreground opacity-0 shadow-md transition hover:bg-destructive hover:text-destructive-foreground focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring group-hover/category:opacity-100"
            style={controlButtonStyle}
            title={`Delete ${group.title}`}
          >
            <HiTrash className="size-3.5" />
          </button>
        </span>

        {!isCollapsed && content.map(({ name, url }, index) => {
          const iconUrl = faviconUrl(url);
          const selfHosted = isSelfHostedUrl(url);
          const bookmark = { name, url };

          return (
            <span
              key={`${collapseKey}-${url}-${index}`}
              style={{ marginLeft: `${Math.min(depth * 18, 72)}px` }}
              className="group relative inline-flex"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                setDraggedItem({
                  type: "bookmark",
                  categoryIndex: categoryPath,
                  bookmarkIndex: index,
                });
              }}
              onDragOver={(event) => {
                if (draggedItem?.type === "bookmark") {
                  event.preventDefault();
                  setDragOverItem({
                    type: "bookmark",
                    categoryIndex: categoryPath,
                    bookmarkIndex: index,
                  });
                }
              }}
              onDrop={(event) => handleBookmarkDrop(event, categoryPath, index)}
              onDragEnd={handleDragEnd}
            >
              <a
                href={url}
                draggable={false}
                className={`inline-flex cursor-grab items-center rounded-full bg-card text-card-foreground shadow-lg transition active:cursor-grabbing hover:bg-accent hover:text-accent-foreground ${
                  dragOverItem?.type === "bookmark" &&
                  categoryPathsMatch(dragOverItem.categoryIndex, categoryPath) &&
                  dragOverItem.bookmarkIndex === index
                    ? "ring-2 ring-ring ring-offset-2 ring-offset-background"
                    : ""
                }`}
                style={bookmarkPillStyle}
                title={url}
              >
                <span
                  className="inline-flex shrink-0 items-center justify-center rounded-full bg-background/65"
                  style={iconWrapStyle}
                >
                  {selfHosted ? (
                    <LocalServiceStatus url={url} className="size-4" />
                  ) : iconUrl ? (
                    <>
                      <img
                        src={iconUrl}
                        srcSet={faviconSrcSet(url)}
                        alt=""
                        className="rounded-sm object-contain"
                        style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
                        onError={(imgEvent) => {
                          imgEvent.currentTarget.style.display = "none";
                          imgEvent.currentTarget.nextElementSibling?.removeAttribute("hidden");
                        }}
                      />
                      <span hidden className="bookmark-favicon-fallback" style={{ width: `${iconSize}px`, height: `${iconSize}px`, fontSize: `${Math.max(10, iconSize * 0.48)}px` }}>
                        {faviconFallbackLabel(name, url)}
                      </span>
                    </>
                  ) : (
                    <span className="bookmark-favicon-fallback" style={{ width: `${iconSize}px`, height: `${iconSize}px`, fontSize: `${Math.max(10, iconSize * 0.48)}px` }}>
                      {faviconFallbackLabel(name, url)}
                    </span>
                  )}
                </span>
                <span className="truncate font-medium">{name}</span>
              </a>
              <button
                type="button"
                onClick={() => onRemoveBookmark(categoryPath, index)}
                className="absolute -left-1.5 -top-1.5 inline-flex items-center justify-center rounded-full border border-border/60 bg-card text-card-foreground opacity-0 shadow-md transition hover:bg-destructive hover:text-destructive-foreground focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring group-hover:opacity-100"
                style={controlButtonStyle}
                title={`Remove ${name}`}
              >
                <HiMinus className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleEditBookmark(categoryPath, index, bookmark)}
                className="absolute -right-1.5 -top-1.5 inline-flex items-center justify-center rounded-full border border-border/60 bg-card text-card-foreground opacity-0 shadow-md transition hover:bg-accent hover:text-accent-foreground focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring group-hover:opacity-100"
                style={controlButtonStyle}
                title={`Edit ${name}`}
              >
                <HiPencil className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onMoveBookmark(categoryPath, index, -1)}
                className="absolute -bottom-1.5 left-2 inline-flex items-center justify-center rounded-full border border-border/60 bg-card text-card-foreground opacity-0 shadow-md transition hover:bg-accent hover:text-accent-foreground focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring group-hover:opacity-100"
                style={controlButtonStyle}
                title={`Move ${name} left`}
              >
                <HiChevronLeft className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onMoveBookmark(categoryPath, index, 1)}
                className="absolute -bottom-1.5 right-2 inline-flex items-center justify-center rounded-full border border-border/60 bg-card text-card-foreground opacity-0 shadow-md transition hover:bg-accent hover:text-accent-foreground focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring group-hover:opacity-100"
                style={controlButtonStyle}
                title={`Move ${name} right`}
              >
                <HiChevronRight className="size-3.5" />
              </button>
            </span>
          );
        })}

        {!isCollapsed && children.map((child, childIndex) =>
          renderNestedGroup(child, [...categoryPath, childIndex], [...labelPath, child.title], depth + 1)
        )}
      </React.Fragment>
    );
  }

  return (
    <div className="bookmark-vault h-screen w-full overflow-y-auto px-4 pb-16 pt-24 sm:px-6">
      <div className="bookmark-vault-header">
        <button
          type="button"
          onClick={onBack}
          className="bookmark-vault-back"
          title="Back to dashboard"
        >
          <HiChevronLeft className="size-4" />
        </button>
        <h1>Bookmark Vault:</h1>
        <div className="bookmark-vault-actions">
          <button
            type="button"
            onClick={openImportModal}
            className="bookmark-vault-button"
            title="Import browser bookmarks export"
          >
            Import
          </button>
          <button
            type="button"
            onClick={onExportBookmarks}
            className="bookmark-vault-button"
            title="Export bookmarks as browser HTML"
          >
            Export
          </button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".html,.htm,text/html"
        className="hidden"
        onChange={handleImportFile}
      />
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-xl gap-0 border-border/60 bg-background/98 p-6 pr-14 text-foreground sm:p-7 sm:pr-16">
          <DialogHeader className="pr-2">
            <DialogTitle className="font-serif text-xl">Import Bookmarks</DialogTitle>
            <DialogDescription className="leading-6">
              Select an HTML bookmarks export from {detectedBrowser}. Chrome, Firefox, Edge, Safari, Opera, and other Netscape-format exports are supported.
            </DialogDescription>
          </DialogHeader>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDraggingImport(true);
            }}
            onDragLeave={() => setDraggingImport(false)}
            onDrop={handleImportDrop}
            className={`mt-5 flex min-h-48 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition focus:outline-none focus:ring-2 focus:ring-ring ${
              draggingImport
                ? "border-primary bg-primary/10"
                : "border-border bg-card hover:bg-accent"
            }`}
          >
            <span className="text-base font-medium text-foreground">Drop bookmarks HTML here</span>
            <span className="mt-2 text-sm text-muted-foreground">or click to open your file explorer</span>
            <span className="mt-4 text-xs text-muted-foreground">Folders become categories. Subfolders become nested subcategories.</span>
          </button>
          {importError ? (
            <div className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {importError}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      {toast ? (
        <div className="fixed right-4 top-24 z-50 max-w-sm rounded-xl border border-border/60 bg-card px-4 py-3 text-sm text-card-foreground shadow-xl">
          {toast}
        </div>
      ) : null}

      <div className="bookmark-vault-list">
        {orderedBookmarks.map((group) => {
          const content = Array.isArray(group.content) ? group.content : [];
          const children = Array.isArray(group.children) ? group.children : [];
          const isCollapsed = collapsedCategories.has(group.title);
          const categoryPath = [group.originalIndex];

          return (
            <React.Fragment key={`${group.title}-${group.originalIndex}`}>
              <span
                className="group/category relative inline-flex"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  setDraggedItem({ type: "category", categoryIndex: group.originalIndex });
                }}
                onDragOver={(event) => {
                  if (draggedItem) {
                    event.preventDefault();
                    setDragOverItem({ type: "category", categoryIndex: group.originalIndex });
                  }
                }}
                onDrop={(event) => handleCategoryDrop(event, group.originalIndex)}
                onDragEnd={handleDragEnd}
              >
                <button
                  type="button"
                  onClick={() => {
                    setDraft((prev) => ({ ...prev, categoryPath: serializeCategoryPath(categoryPath) }));
                    toggleCategoryCollapsed(group.title);
                  }}
                  className={`inline-flex cursor-grab items-center justify-between gap-2 rounded-full shadow-lg transition active:cursor-grabbing hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring ${getCategoryPillClass(isCollapsed)} ${
                    dragOverItem?.type === "category" && dragOverItem.categoryIndex === group.originalIndex
                      ? "ring-2 ring-ring ring-offset-2 ring-offset-background"
                      : ""
                  }`}
                  style={pillStyle}
                  title={`${isCollapsed ? "Expand" : "Collapse"} ${group.title}`}
                  aria-expanded={!isCollapsed}
                >
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <span
                      className="inline-flex shrink-0 items-center justify-center rounded-full bg-background/25 text-current"
                      style={{
                        width: `${Math.max(20, iconSize * 1.05)}px`,
                        height: `${Math.max(20, iconSize * 1.05)}px`,
                      }}
                    >
                      {isCollapsed ? (
                        <HiPlus style={{ width: `${Math.max(12, iconSize * 0.62)}px`, height: `${Math.max(12, iconSize * 0.62)}px` }} />
                      ) : (
                        <HiMinus style={{ width: `${Math.max(12, iconSize * 0.62)}px`, height: `${Math.max(12, iconSize * 0.62)}px` }} />
                      )}
                    </span>
                    <span className="block truncate">{group.title}</span>
                  </span>
                  <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-background/20 px-2 py-0.5 text-[0.72em]">
                    {countBookmarksInGroup(group)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onMoveCategory(group.originalIndex, -1);
                  }}
                  className="absolute -left-1.5 -top-1.5 inline-flex items-center justify-center rounded-full border border-border/60 bg-card text-card-foreground opacity-0 shadow-md transition hover:bg-accent hover:text-accent-foreground focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring group-hover/category:opacity-100"
                  style={controlButtonStyle}
                  title={`Move ${group.title} left`}
                >
                  <HiChevronLeft className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onMoveCategory(group.originalIndex, 1);
                  }}
                  className="absolute -right-1.5 -top-1.5 inline-flex items-center justify-center rounded-full border border-border/60 bg-card text-card-foreground opacity-0 shadow-md transition hover:bg-accent hover:text-accent-foreground focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring group-hover/category:opacity-100"
                  style={controlButtonStyle}
                  title={`Move ${group.title} right`}
                >
                  <HiChevronRight className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleEditCategory(categoryPath, group.title);
                  }}
                  className="absolute -bottom-1.5 right-2 inline-flex items-center justify-center rounded-full border border-border/60 bg-card text-card-foreground opacity-0 shadow-md transition hover:bg-accent hover:text-accent-foreground focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring group-hover/category:opacity-100"
                  style={controlButtonStyle}
                  title={`Rename ${group.title}`}
                >
                  <HiPencil className="size-3.5" />
                </button>
                {bookmarks.length > 1 ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteCategory(categoryPath, group.title);
                    }}
                    className="absolute -bottom-1.5 left-2 inline-flex items-center justify-center rounded-full border border-border/60 bg-card text-card-foreground opacity-0 shadow-md transition hover:bg-destructive hover:text-destructive-foreground focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring group-hover/category:opacity-100"
                    style={controlButtonStyle}
                    title={`Delete ${group.title}`}
                  >
                    <HiTrash className="size-3.5" />
                  </button>
                ) : null}
              </span>

              {!isCollapsed && content.map(({ name, url }, index) => {
                const iconUrl = faviconUrl(url);
                const selfHosted = isSelfHostedUrl(url);
                const bookmark = { name, url };

                return (
                  <span
                    key={`${url}-${index}`}
                    className="group relative inline-flex"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      setDraggedItem({
                        type: "bookmark",
                        categoryIndex: group.originalIndex,
                        bookmarkIndex: index,
                      });
                    }}
                    onDragOver={(event) => {
                      if (draggedItem?.type === "bookmark") {
                        event.preventDefault();
                        setDragOverItem({
                          type: "bookmark",
                          categoryIndex: group.originalIndex,
                          bookmarkIndex: index,
                        });
                      }
                    }}
                    onDrop={(event) => handleBookmarkDrop(event, group.originalIndex, index)}
                    onDragEnd={handleDragEnd}
                  >
                    <a
                      href={url}
                      draggable={false}
                      className={`inline-flex cursor-grab items-center rounded-full bg-card text-card-foreground shadow-lg transition active:cursor-grabbing hover:bg-accent hover:text-accent-foreground ${
                        dragOverItem?.type === "bookmark" &&
                        dragOverItem.categoryIndex === group.originalIndex &&
                        dragOverItem.bookmarkIndex === index
                          ? "ring-2 ring-ring ring-offset-2 ring-offset-background"
                          : ""
                      }`}
                      style={bookmarkPillStyle}
                      title={url}
                    >
                      <span
                        className="inline-flex shrink-0 items-center justify-center rounded-full bg-background/65"
                        style={iconWrapStyle}
                      >
                        {selfHosted ? (
                          <LocalServiceStatus url={url} className="size-4" />
                        ) : iconUrl ? (
                          <>
                            <img
                              src={iconUrl}
                              srcSet={faviconSrcSet(url)}
                              alt=""
                              className="rounded-sm object-contain"
                              style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
                              onError={(event) => {
                                event.currentTarget.style.display = "none";
                                event.currentTarget.nextElementSibling?.removeAttribute("hidden");
                              }}
                            />
                            <span hidden className="bookmark-favicon-fallback" style={{ width: `${iconSize}px`, height: `${iconSize}px`, fontSize: `${Math.max(10, iconSize * 0.48)}px` }}>
                              {faviconFallbackLabel(name, url)}
                            </span>
                          </>
                        ) : (
                          <span className="bookmark-favicon-fallback" style={{ width: `${iconSize}px`, height: `${iconSize}px`, fontSize: `${Math.max(10, iconSize * 0.48)}px` }}>
                            {faviconFallbackLabel(name, url)}
                          </span>
                        )}
                      </span>
                      <span className="truncate font-medium">{name}</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => onRemoveBookmark(categoryPath, index)}
                      className="absolute -left-1.5 -top-1.5 inline-flex items-center justify-center rounded-full border border-border/60 bg-card text-card-foreground opacity-0 shadow-md transition hover:bg-destructive hover:text-destructive-foreground focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring group-hover:opacity-100"
                      style={controlButtonStyle}
                      title={`Remove ${name}`}
                    >
                      <HiMinus className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEditBookmark(categoryPath, index, bookmark)}
                      className="absolute -right-1.5 -top-1.5 inline-flex items-center justify-center rounded-full border border-border/60 bg-card text-card-foreground opacity-0 shadow-md transition hover:bg-accent hover:text-accent-foreground focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring group-hover:opacity-100"
                      style={controlButtonStyle}
                      title={`Edit ${name}`}
                    >
                      <HiPencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onMoveBookmark(group.originalIndex, index, -1)}
                      className="absolute -bottom-1.5 left-2 inline-flex items-center justify-center rounded-full border border-border/60 bg-card text-card-foreground opacity-0 shadow-md transition hover:bg-accent hover:text-accent-foreground focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring group-hover:opacity-100"
                      style={controlButtonStyle}
                      title={`Move ${name} left`}
                    >
                      <HiChevronLeft className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onMoveBookmark(group.originalIndex, index, 1)}
                      className="absolute -bottom-1.5 right-2 inline-flex items-center justify-center rounded-full border border-border/60 bg-card text-card-foreground opacity-0 shadow-md transition hover:bg-accent hover:text-accent-foreground focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring group-hover:opacity-100"
                      style={controlButtonStyle}
                      title={`Move ${name} right`}
                    >
                      <HiChevronRight className="size-3.5" />
                    </button>
                  </span>
                );
              })}
              {!isCollapsed && children.map((child, childIndex) =>
                renderNestedGroup(child, [group.originalIndex, childIndex], [group.title, child.title])
              )}
            </React.Fragment>
          );
        })}

        <button
          type="button"
          onClick={handleAddToggle}
          className="bookmark-vault-add"
          style={addButtonStyle}
          title="Add bookmark"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => {
            setAddOpen(false);
            setEditingBookmark(null);
            setEditingCategory(null);
            setCategoryDraft("");
            setCategoryParentPath("");
            setCategoryOpen((open) => !open);
          }}
          className="bookmark-vault-category-add"
          style={{ height: `${pillHeight}px`, fontSize: `${textSize}px` }}
          title="Add category"
        >
          Category +
        </button>
      </div>

      {categoryOpen ? (
        <form
          onSubmit={handleCategorySubmit}
          className="bookmark-vault-form max-w-xl"
        >
          <label className="grid min-w-64 flex-1 gap-1 text-xs text-muted-foreground">
            {editingCategory ? "Rename Category" : "Category Name"}
            <input
              value={categoryDraft}
              onChange={(event) => setCategoryDraft(event.target.value)}
              className="h-11 rounded-full border border-input bg-background px-4 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              placeholder="Work"
            />
          </label>
          {!editingCategory ? (
            <label className="grid min-w-52 gap-1 text-xs text-muted-foreground">
              Parent
              <select
                value={categoryParentPath}
                onChange={(event) => setCategoryParentPath(event.target.value)}
                className="h-11 rounded-full border border-input bg-background px-4 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Top level</option>
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            type="submit"
            className="h-11 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            {editingCategory ? "Save" : "Add"}
          </button>
        </form>
      ) : null}

      {addOpen ? (
        <form
          onSubmit={handleSubmit}
          className="bookmark-vault-form max-w-4xl"
        >
          <label className="grid gap-1 text-xs text-muted-foreground">
            Category
            <select
              value={draft.categoryPath}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, categoryPath: event.target.value }))
              }
              className="h-11 rounded-full border border-input bg-background px-4 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid min-w-48 flex-1 gap-1 text-xs text-muted-foreground">
            Name
            <input
              value={draft.name}
              onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
              className="h-11 rounded-full border border-input bg-background px-4 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              placeholder="Github"
            />
          </label>

          <label className="grid min-w-64 flex-1 gap-1 text-xs text-muted-foreground">
            URL
            <input
              value={draft.url}
              onChange={(event) => setDraft((prev) => ({ ...prev, url: event.target.value }))}
              className="h-11 rounded-full border border-input bg-background px-4 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              placeholder="https://github.com"
            />
          </label>

          <button
            type="submit"
            className="h-11 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            {editingBookmark ? "Save" : "Add"}
          </button>
        </form>
      ) : null}
    </div>
  );
}

export default function Index() {
  const [settingsState, setSettingsState] = React.useState(() => readSettings());
  const latestSettingsRef = React.useRef(settingsState);
  const settings = settingsState;
  const hiddenBoxes = settings.layout?.hiddenBoxes || {};
  const showBox = (id) => !hiddenBoxes[id];
  const ui = settings.ui || {};
  const decorativeVideo = settings.decorativeVideo || {};
  const bookmarkGroups = Array.isArray(settings.bookmark) ? settings.bookmark : [];
  const bookmarkBoxCategories = settings.layout?.bookmarkBoxCategories || [0, 1, 2, 3, 4];
  const getBookmarkGroupForBox = (boxIndex) =>
    bookmarkGroups[bookmarkBoxCategories[boxIndex]] || bookmarkGroups[boxIndex] || { title: "", content: [] };
  const gapClass = ui.gridDensity === "compact" ? "gap-y-4 gap-x-4" : "gap-y-6 gap-x-6";
  const decorativeGap = ui.gridDensity === "compact" ? 16 : 24;
  const tilePx = (ui.tileSize || 9) * 16;
  const tallTilePx = tilePx * 2 + decorativeGap;
  // Minimum viewport width (px) for n columns to fit without overflow.
  // Section has px-4 = 32px total horizontal padding.
  const minWidthFor = (n) => n * tilePx + (n - 1) * decorativeGap + 32;
  const gridCss = `
    .dashboard-grid,
    .bookmark-page-grid {
      --dashboard-tile-max: ${tilePx}px;
      --dashboard-gap: ${decorativeGap}px;
      --dashboard-inline-padding: 2rem;
      --dashboard-tile: clamp(88px, calc((100vw - var(--dashboard-inline-padding) - var(--dashboard-gap)) / 2), var(--dashboard-tile-max));
      grid-template-columns: repeat(2, minmax(0, var(--dashboard-tile)));
      grid-auto-rows: var(--dashboard-tile);
    }
    .dashboard-grid .grid-feature-responsive {
      grid-column: span 2 / span 2;
    }
    @media (min-width: ${minWidthFor(3)}px) {
      .dashboard-grid,
      .bookmark-page-grid {
        --dashboard-tile: clamp(88px, calc((100vw - var(--dashboard-inline-padding) - ${decorativeGap * 2}px) / 3), var(--dashboard-tile-max));
        grid-template-columns: repeat(3, minmax(0, var(--dashboard-tile)));
      }
      .dashboard-grid .grid-feature-responsive {
        grid-column: span 3 / span 3;
      }
    }
    @media (min-width: ${minWidthFor(5)}px) {
      .dashboard-grid,
      .bookmark-page-grid {
        --dashboard-tile: clamp(88px, calc((100vw - var(--dashboard-inline-padding) - ${decorativeGap * 4}px) / 5), var(--dashboard-tile-max));
        grid-template-columns: repeat(5, minmax(0, var(--dashboard-tile)));
      }
    }
    @media (min-width: ${minWidthFor(7)}px) {
      .dashboard-grid,
      .bookmark-page-grid {
        --dashboard-tile: clamp(88px, calc((100vw - var(--dashboard-inline-padding) - ${decorativeGap * 6}px) / 7), var(--dashboard-tile-max));
        grid-template-columns: repeat(7, minmax(0, var(--dashboard-tile)));
      }
    }
  `;
  const radiusClass = ui.cardStyle === "soft" ? "rounded-[2rem]" : ui.cardStyle === "sharp" ? "rounded-md" : "rounded-xl";
  const showDecorativeMedia = ui.showDecorativeMedia !== false;
  const decorativeVideoUrls = Array.isArray(decorativeVideo.urls)
    ? decorativeVideo.urls.filter((value) => typeof value === "string" && value.trim() !== "")
    : [];
  const [decorativeVideoUrl] = React.useState(() => {
    if (!decorativeVideoUrls.length) {
      return desert;
    }

    const randomIndex = Math.floor(Math.random() * decorativeVideoUrls.length);
    return decorativeVideoUrls[randomIndex] || desert;
  });
  const [activeView, setActiveView] = React.useState("dashboard");
  const [activeBookmarkCategory, setActiveBookmarkCategory] = React.useState(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const storedCategory = window.localStorage?.getItem(STARTUP_PAGE_BOOKMARK_CATEGORY_KEY);
    return storedCategory === null ? null : Number(storedCategory);
  });

  const panel = (extra = "") => `${radiusClass} ${extra}`;
  const surface = "bg-card text-card-foreground border border-border/60 shadow-lg";
  const mutedSurface = "bg-muted/50 text-foreground border border-border/60 shadow-lg";
  const strongSurface = "bg-primary text-primary-foreground border border-border/40 shadow-lg";
  const bookmarksOpen = activeView === "bookmarks";
  const readOpen = activeView === "read";
  const openBookmarkView = React.useCallback((categoryIndex = null) => {
    setActiveBookmarkCategory(categoryIndex);
    setActiveView("bookmarks");
    window.localStorage?.setItem(STARTUP_PAGE_VIEW_KEY, "bookmarks");

    if (categoryIndex === null) {
      window.localStorage?.removeItem(STARTUP_PAGE_BOOKMARK_CATEGORY_KEY);
    } else {
      window.localStorage?.setItem(STARTUP_PAGE_BOOKMARK_CATEGORY_KEY, String(categoryIndex));
    }
  }, []);

  const openBookmarkVault = React.useCallback(() => {
    openBookmarkView(null);
  }, [openBookmarkView]);

  const closeBookmarkView = React.useCallback(() => {
    setActiveView("dashboard");
    window.localStorage?.setItem(STARTUP_PAGE_VIEW_KEY, "dashboard");
  }, []);

  const openReadView = React.useCallback(() => {
    setActiveView("read");
    window.localStorage?.setItem(STARTUP_PAGE_VIEW_KEY, "read");
  }, []);

  const closeReadView = React.useCallback(() => {
    setActiveView("dashboard");
    window.localStorage?.setItem(STARTUP_PAGE_VIEW_KEY, "dashboard");
  }, []);

  const handleVaultWheel = React.useCallback((event) => {
    if (Math.abs(event.deltaX) < 72 || Math.abs(event.deltaX) < Math.abs(event.deltaY) * 1.35) {
      return;
    }

    const target = event.target;
    if (target?.closest?.("input, textarea, select, [contenteditable='true']")) {
      return;
    }

    if (event.deltaX > 0) {
      if (readOpen) {
        closeReadView();
      } else if (!bookmarksOpen) {
        openBookmarkVault();
      }
      return;
    }

    if (bookmarksOpen) {
      closeBookmarkView();
    } else if (!readOpen) {
      openReadView();
    }
  }, [bookmarksOpen, closeBookmarkView, closeReadView, openBookmarkVault, openReadView, readOpen]);

  React.useEffect(() => {
    const handleKeyDown = (event) => {
      const target = event.target;

      if (target?.closest?.("input, textarea, select, [contenteditable='true']")) {
        return;
      }

      if (event.key === "Escape" && activeView !== "dashboard") {
        event.preventDefault();
        closeReadView();
        return;
      }

      if (!event.metaKey && !event.ctrlKey && !event.altKey) {
        if (event.key === "1") {
          event.preventDefault();
          openReadView();
          return;
        }

        if (event.key === "2") {
          event.preventDefault();
          closeReadView();
          return;
        }

        if (event.key === "3") {
          event.preventDefault();
          openBookmarkVault();
          return;
        }
      }

    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeView, closeReadView, openBookmarkVault, openReadView]);

  const updateActiveBookmarkCategory = (categoryIndex) => {
    setActiveBookmarkCategory(categoryIndex);

    if (categoryIndex === null) {
      window.localStorage?.removeItem(STARTUP_PAGE_BOOKMARK_CATEGORY_KEY);
    } else {
      window.localStorage?.setItem(STARTUP_PAGE_BOOKMARK_CATEGORY_KEY, String(categoryIndex));
    }
  };

  React.useEffect(() => {
    latestSettingsRef.current = settingsState;
  }, [settingsState]);

  const normalizeBookmarkUrl = (url) => {
    const trimmedUrl = url.trim();
    const hasScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmedUrl);
    return hasScheme
      ? trimmedUrl
      : `${isSelfHostedUrl(trimmedUrl) ? "http" : "https"}://${trimmedUrl}`;
  };

  const normalizeCategoryPath = (categoryPath) => (
    Array.isArray(categoryPath) ? categoryPath : [categoryPath]
  ).map((part) => Number(part)).filter((part) => Number.isInteger(part));

  const updateBookmarkGroupAtPath = (groups, categoryPath, updater) => {
    const [currentIndex, ...restPath] = normalizeCategoryPath(categoryPath);

    return groups.map((group, index) => {
      if (index !== currentIndex) {
        return group;
      }

      if (!restPath.length) {
        return updater(group);
      }

      return {
        ...group,
        children: updateBookmarkGroupAtPath(Array.isArray(group.children) ? group.children : [], restPath, updater),
      };
    });
  };

  const getBookmarkGroupAtPath = (groups, categoryPath) => {
    const [currentIndex, ...restPath] = normalizeCategoryPath(categoryPath);
    const group = groups[currentIndex];

    if (!group || !restPath.length) {
      return group;
    }

    return getBookmarkGroupAtPath(Array.isArray(group.children) ? group.children : [], restPath);
  };

  const removeBookmarkGroupAtPath = (groups, categoryPath) => {
    const [currentIndex, ...restPath] = normalizeCategoryPath(categoryPath);

    if (!restPath.length) {
      return groups.filter((_group, index) => index !== currentIndex);
    }

    return groups.map((group, index) => (
      index === currentIndex
        ? {
            ...group,
            children: removeBookmarkGroupAtPath(Array.isArray(group.children) ? group.children : [], restPath),
          }
        : group
    ));
  };

  function normalizeImportedBookmarkGroup(group) {
    return {
      title: group.title || "Imported",
      content: (Array.isArray(group.content) ? group.content : [])
        .filter((bookmark) => bookmark?.name && bookmark?.url)
        .map((bookmark) => ({
          name: bookmark.name,
          url: normalizeBookmarkUrl(bookmark.url),
        })),
      children: (Array.isArray(group.children) ? group.children : [])
        .map(normalizeImportedBookmarkGroup)
        .filter((child) => countBookmarksInGroup(child) > 0),
    };
  }

  const persistSettings = async (nextSettings) => {
    latestSettingsRef.current = nextSettings;
    setSettingsState(nextSettings);
    await writeSettings(nextSettings);
  };

  const handleAddBookmark = async (categoryIndex, bookmark) => {
    const currentSettings = latestSettingsRef.current;
    const currentBookmarkGroups = Array.isArray(currentSettings.bookmark) ? currentSettings.bookmark : [];
    const normalizedUrl = normalizeBookmarkUrl(bookmark.url);
    const nextSettings = {
      ...currentSettings,
      bookmark: updateBookmarkGroupAtPath(currentBookmarkGroups, categoryIndex, (group) => ({
        ...group,
        content: [
          ...(Array.isArray(group.content) ? group.content : []),
          { name: bookmark.name, url: normalizedUrl },
        ],
      })),
    };

    await persistSettings(nextSettings);
  };

  const handleUpdateBookmark = async (categoryIndex, bookmarkIndex, bookmark) => {
    const currentSettings = latestSettingsRef.current;
    const currentBookmarkGroups = Array.isArray(currentSettings.bookmark) ? currentSettings.bookmark : [];
    const normalizedUrl = normalizeBookmarkUrl(bookmark.url);
    const nextSettings = {
      ...currentSettings,
      bookmark: updateBookmarkGroupAtPath(currentBookmarkGroups, categoryIndex, (group) => ({
        ...group,
        content: (Array.isArray(group.content) ? group.content : []).map((item, itemIndex) =>
          itemIndex === bookmarkIndex
            ? { name: bookmark.name, url: normalizedUrl }
            : item
        ),
      })),
    };

    await persistSettings(nextSettings);
  };

  const handleRemoveBookmark = async (categoryIndex, bookmarkIndex) => {
    const currentSettings = latestSettingsRef.current;
    const currentBookmarkGroups = Array.isArray(currentSettings.bookmark) ? currentSettings.bookmark : [];
    const nextSettings = {
      ...currentSettings,
      bookmark: updateBookmarkGroupAtPath(currentBookmarkGroups, categoryIndex, (group) => ({
        ...group,
        content: (Array.isArray(group.content) ? group.content : []).filter(
          (_item, itemIndex) => itemIndex !== bookmarkIndex
        ),
      })),
    };

    await persistSettings(nextSettings);
  };

  const handleAddBookmarkCategory = async (title, parentCategoryPath = null) => {
    const currentSettings = latestSettingsRef.current;
    const currentBookmarkGroups = Array.isArray(currentSettings.bookmark) ? currentSettings.bookmark : [];
    const newCategory = { title, content: [], children: [] };

    if (parentCategoryPath) {
      await persistSettings({
        ...currentSettings,
        bookmark: updateBookmarkGroupAtPath(currentBookmarkGroups, parentCategoryPath, (group) => ({
          ...group,
          children: [
            ...(Array.isArray(group.children) ? group.children : []),
            newCategory,
          ],
        })),
      });
      return;
    }

    const nextSettings = {
      ...currentSettings,
      bookmark: [
        ...currentBookmarkGroups,
        newCategory,
      ],
    };

    updateActiveBookmarkCategory(currentBookmarkGroups.length);
    await persistSettings(nextSettings);
  };

  const handleImportBookmarks = async (importedGroups) => {
    const currentSettings = latestSettingsRef.current;
    const currentBookmarkGroups = Array.isArray(currentSettings.bookmark) ? currentSettings.bookmark : [];
    const normalizedGroups = importedGroups
      .map(normalizeImportedBookmarkGroup)
      .filter((group) => countBookmarksInGroup(group) > 0);

    if (!normalizedGroups.length) {
      return;
    }

    updateActiveBookmarkCategory(currentBookmarkGroups.length);
    await persistSettings({
      ...currentSettings,
      bookmark: [
        ...currentBookmarkGroups,
        ...normalizedGroups,
      ],
    });
  };

  const handleRenameBookmarkCategory = async (categoryIndex, title) => {
    const currentSettings = latestSettingsRef.current;
    const currentBookmarkGroups = Array.isArray(currentSettings.bookmark) ? currentSettings.bookmark : [];

    await persistSettings({
      ...currentSettings,
      bookmark: updateBookmarkGroupAtPath(currentBookmarkGroups, categoryIndex, (group) => ({ ...group, title })),
    });
  };

  const handleExportBookmarks = () => {
    const currentSettings = latestSettingsRef.current;
    const currentBookmarkGroups = Array.isArray(currentSettings.bookmark) ? currentSettings.bookmark : [];
    const html = createBookmarksExportHtml(currentBookmarkGroups);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);

    anchor.href = url;
    anchor.download = `startup-page-bookmarks-${date}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleDeleteBookmarkCategory = async (categoryIndex) => {
    const currentSettings = latestSettingsRef.current;
    const currentBookmarkGroups = Array.isArray(currentSettings.bookmark) ? currentSettings.bookmark : [];
    const currentMapping = currentSettings.layout?.bookmarkBoxCategories || [0, 1, 2, 3, 4];
    const categoryPath = normalizeCategoryPath(categoryIndex);

    if (!categoryPath.length || (categoryPath.length === 1 && currentBookmarkGroups.length <= 1)) {
      return;
    }

    if (categoryPath.length > 1) {
      await persistSettings({
        ...currentSettings,
        bookmark: removeBookmarkGroupAtPath(currentBookmarkGroups, categoryPath),
      });
      return;
    }

    const [topLevelCategoryIndex] = categoryPath;
    const bookmark = currentBookmarkGroups.filter((_group, index) => index !== topLevelCategoryIndex);
    const fallbackIndex = Math.min(topLevelCategoryIndex, bookmark.length - 1);
    const bookmarkBoxCategoriesNext = currentMapping.map((mappedIndex, boxIndex) => {
      if (mappedIndex === topLevelCategoryIndex) {
        return Math.min(boxIndex, bookmark.length - 1);
      }

      if (mappedIndex > topLevelCategoryIndex) {
        return mappedIndex - 1;
      }

      return Math.min(mappedIndex, bookmark.length - 1);
    });

    if (activeBookmarkCategory === topLevelCategoryIndex) {
      updateActiveBookmarkCategory(fallbackIndex);
    } else if (activeBookmarkCategory > topLevelCategoryIndex) {
      updateActiveBookmarkCategory(activeBookmarkCategory - 1);
    }

    await persistSettings({
      ...currentSettings,
      bookmark,
      layout: {
        ...currentSettings.layout,
        bookmarkBoxCategories: bookmarkBoxCategoriesNext,
      },
    });
  };

  const handleMoveBookmarkCategory = async (categoryIndex, direction) => {
    const currentSettings = latestSettingsRef.current;
    const currentBookmarkGroups = Array.isArray(currentSettings.bookmark) ? currentSettings.bookmark : [];
    const currentMapping = currentSettings.layout?.bookmarkBoxCategories || [0, 1, 2, 3, 4];
    const nextIndex = categoryIndex + direction;

    if (nextIndex < 0 || nextIndex >= currentBookmarkGroups.length) {
      return;
    }

    const bookmark = [...currentBookmarkGroups];
    [bookmark[categoryIndex], bookmark[nextIndex]] = [bookmark[nextIndex], bookmark[categoryIndex]];

    const bookmarkBoxCategoriesNext = currentMapping.map((mappedIndex) => {
      if (mappedIndex === categoryIndex) {
        return nextIndex;
      }

      if (mappedIndex === nextIndex) {
        return categoryIndex;
      }

      return mappedIndex;
    });

    if (activeBookmarkCategory === categoryIndex) {
      updateActiveBookmarkCategory(nextIndex);
    } else if (activeBookmarkCategory === nextIndex) {
      updateActiveBookmarkCategory(categoryIndex);
    }

    await persistSettings({
      ...currentSettings,
      bookmark,
      layout: {
        ...currentSettings.layout,
        bookmarkBoxCategories: bookmarkBoxCategoriesNext,
      },
    });
  };

  const handleReorderBookmarkCategory = async (fromIndex, toIndex) => {
    const currentSettings = latestSettingsRef.current;
    const currentBookmarkGroups = Array.isArray(currentSettings.bookmark) ? currentSettings.bookmark : [];
    const currentMapping = currentSettings.layout?.bookmarkBoxCategories || [0, 1, 2, 3, 4];

    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= currentBookmarkGroups.length ||
      toIndex >= currentBookmarkGroups.length
    ) {
      return;
    }

    const orderedIndexes = currentBookmarkGroups.map((_, index) => index);
    const [movedIndex] = orderedIndexes.splice(fromIndex, 1);
    orderedIndexes.splice(toIndex, 0, movedIndex);

    const oldToNewIndex = new Map(orderedIndexes.map((oldIndex, newIndex) => [oldIndex, newIndex]));
    const bookmark = orderedIndexes.map((oldIndex) => currentBookmarkGroups[oldIndex]);
    const bookmarkBoxCategoriesNext = currentMapping.map((mappedIndex) =>
      oldToNewIndex.has(mappedIndex) ? oldToNewIndex.get(mappedIndex) : mappedIndex
    );

    if (oldToNewIndex.has(activeBookmarkCategory)) {
      updateActiveBookmarkCategory(oldToNewIndex.get(activeBookmarkCategory));
    }

    await persistSettings({
      ...currentSettings,
      bookmark,
      layout: {
        ...currentSettings.layout,
        bookmarkBoxCategories: bookmarkBoxCategoriesNext,
      },
    });
  };

  const handleMoveBookmark = async (categoryIndex, bookmarkIndex, direction) => {
    const currentSettings = latestSettingsRef.current;
    const currentBookmarkGroups = Array.isArray(currentSettings.bookmark) ? currentSettings.bookmark : [];
    const group = getBookmarkGroupAtPath(currentBookmarkGroups, categoryIndex);
    const content = Array.isArray(group?.content) ? [...group.content] : [];
    const nextIndex = bookmarkIndex + direction;

    if (!group || nextIndex < 0 || nextIndex >= content.length) {
      return;
    }

    [content[bookmarkIndex], content[nextIndex]] = [content[nextIndex], content[bookmarkIndex]];

    await persistSettings({
      ...currentSettings,
      bookmark: updateBookmarkGroupAtPath(currentBookmarkGroups, categoryIndex, (currentGroup) => ({
        ...currentGroup,
        content,
      })),
    });
  };

  const handleReorderBookmark = async (fromCategoryIndex, fromBookmarkIndex, toCategoryIndex, toBookmarkIndex) => {
    const currentSettings = latestSettingsRef.current;
    const currentBookmarkGroups = Array.isArray(currentSettings.bookmark) ? currentSettings.bookmark : [];
    const fromGroup = getBookmarkGroupAtPath(currentBookmarkGroups, fromCategoryIndex);
    const toGroup = getBookmarkGroupAtPath(currentBookmarkGroups, toCategoryIndex);
    const fromContent = Array.isArray(fromGroup?.content) ? [...fromGroup.content] : [];
    const sameCategory = JSON.stringify(normalizeCategoryPath(fromCategoryIndex)) === JSON.stringify(normalizeCategoryPath(toCategoryIndex));
    const toContent = sameCategory
      ? fromContent
      : Array.isArray(toGroup?.content)
        ? [...toGroup.content]
        : [];

    if (
      !fromGroup ||
      !toGroup ||
      fromBookmarkIndex < 0 ||
      fromBookmarkIndex >= fromContent.length
    ) {
      return;
    }

    if (
      sameCategory &&
      (fromBookmarkIndex === toBookmarkIndex || fromBookmarkIndex + 1 === toBookmarkIndex)
    ) {
      return;
    }

    const [movedBookmark] = fromContent.splice(fromBookmarkIndex, 1);
    const adjustedTargetIndex = sameCategory && toBookmarkIndex > fromBookmarkIndex
      ? toBookmarkIndex - 1
      : toBookmarkIndex;
    const boundedTargetIndex = Math.max(0, Math.min(adjustedTargetIndex, toContent.length));
    toContent.splice(boundedTargetIndex, 0, movedBookmark);

    const bookmark = sameCategory
      ? updateBookmarkGroupAtPath(currentBookmarkGroups, fromCategoryIndex, (group) => ({ ...group, content: fromContent }))
      : updateBookmarkGroupAtPath(
          updateBookmarkGroupAtPath(currentBookmarkGroups, fromCategoryIndex, (group) => ({ ...group, content: fromContent })),
          toCategoryIndex,
          (group) => ({ ...group, content: toContent })
        );

    await persistSettings({
      ...currentSettings,
      bookmark,
    });
  };

  const handleAddReadItem = async (item) => {
    const currentSettings = latestSettingsRef.current;
    const currentItems = Array.isArray(currentSettings.readItems) ? currentSettings.readItems : [];
    const nextItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: item.title,
      description: item.description,
      url: item.url,
      tag: item.tag,
      status: "todo",
      createdAt: new Date().toISOString(),
    };

    await persistSettings({
      ...currentSettings,
      readItems: [nextItem, ...currentItems],
    });
  };

  const handleToggleReadItem = async (itemId) => {
    const currentSettings = latestSettingsRef.current;
    const currentItems = Array.isArray(currentSettings.readItems) ? currentSettings.readItems : [];

    await persistSettings({
      ...currentSettings,
      readItems: currentItems.map((item) => (
        item.id === itemId
          ? {
              ...item,
              status: item.status === "done" ? "todo" : "done",
              completedAt: item.status === "done" ? null : new Date().toISOString(),
            }
          : item
      )),
    });
  };

  const handleUpdateReadItem = async (itemId, nextItem) => {
    const currentSettings = latestSettingsRef.current;
    const currentItems = Array.isArray(currentSettings.readItems) ? currentSettings.readItems : [];

    await persistSettings({
      ...currentSettings,
      readItems: currentItems.map((item) => (
        item.id === itemId
          ? {
              ...item,
              title: nextItem.title,
              description: nextItem.description,
              url: nextItem.url,
              tag: nextItem.tag,
            }
          : item
      )),
    });
  };

  const handleDeleteReadItem = async (itemId) => {
    const currentSettings = latestSettingsRef.current;
    const currentItems = Array.isArray(currentSettings.readItems) ? currentSettings.readItems : [];

    await persistSettings({
      ...currentSettings,
      readItems: currentItems.filter((item) => item.id !== itemId),
    });
  };

  const handleImportReadItems = async (items) => {
    const currentSettings = latestSettingsRef.current;

    await persistSettings({
      ...currentSettings,
      readItems: normalizeResourceVaultItems(items),
    });
  };

  const handleExportReadItems = () => {
    const currentSettings = latestSettingsRef.current;
    const currentItems = normalizeResourceVaultItems(currentSettings.readItems);
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      items: currentItems,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
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

  const renderDecorativeVideo = (variant, className) => {
    const sceneWidth = tilePx + decorativeGap + tilePx;
    const sceneHeight = tallTilePx;
    const viewports = {
      tall: { x: 0, y: 0, width: tilePx, height: tallTilePx },
      small: {
        x: tilePx + decorativeGap,
        y: 0,
        width: tilePx,
        height: tilePx,
      },
    };
    const viewport = viewports[variant];
    const zoom = Number(
      decorativeVideo.zoom ??
      decorativeVideo.tall?.zoom ??
      1.6
    );
    const offsetX = Number(
      decorativeVideo.offsetX ??
      decorativeVideo.tall?.offsetX ??
      0
    );
    const offsetY = Number(
      decorativeVideo.offsetY ??
      decorativeVideo.tall?.offsetY ??
      0
    );
    const scaledSceneWidth = sceneWidth * zoom;
    const scaledSceneHeight = sceneHeight * zoom;
    const left = offsetX - (viewport.x * zoom);
    const top = offsetY - (viewport.y * zoom);

    return (
      <DecorativeVideoTile
        className={className}
        src={decorativeVideoUrl}
        fallbackSrc={desert}
        width={`${scaledSceneWidth}px`}
        height={`${scaledSceneHeight}px`}
        left={`${left}px`}
        top={`${top}px`}
      />
    );
  };

  const customThemes = settings.customThemes || [];
  const activeCustomTheme = !isBuiltInPalette(ui.themePalette)
    ? customThemes.find((ct) => ct.id === ui.themePalette)
    : null;
  const initialCustomThemeVars = activeCustomTheme
    ? { light: activeCustomTheme.light, dark: activeCustomTheme.dark }
    : null;

  return (
    <ThemeProvider initialThemeMode={ui.themeMode} initialThemePalette={ui.themePalette} initialCustomThemeVars={initialCustomThemeVars}>
      <KBarProvider>
        <KBarWrapper>
      <VaultNavigationActions
        onDashboard={closeReadView}
        onOpenBookmarks={openBookmarkVault}
        onOpenResources={openReadView}
      />
      <section
        className="relative min-h-screen overflow-x-hidden bg-background text-foreground transition-colors"
        onWheel={handleVaultWheel}
      >
        <style>{gridCss}</style>
        <nav className="vault-nav-center" aria-label="Page navigation">
          <button
            type="button"
            className={`vault-nav-button ${readOpen ? "vault-nav-button-active" : ""}`}
            onClick={openReadView}
            title="Open Resource Vault (1)"
            aria-label="Resource Vault"
            aria-current={readOpen ? "page" : undefined}
          >
            <HiArchiveBox className="size-4" />
            <span className="vault-nav-number">1</span>
          </button>
          <button
            type="button"
            className={`vault-nav-button ${activeView === "dashboard" ? "vault-nav-button-active" : ""}`}
            onClick={closeReadView}
            title="Dashboard (2)"
            aria-label="Dashboard"
            aria-current={activeView === "dashboard" ? "page" : undefined}
          >
            <HiHome className="size-4" />
            <span className="vault-nav-number">2</span>
          </button>
          <button
            type="button"
            className={`vault-nav-button ${bookmarksOpen ? "vault-nav-button-active" : ""}`}
            onClick={openBookmarkVault}
            title="Open Bookmark Vault (3)"
            aria-label="Bookmark Vault"
            aria-current={bookmarksOpen ? "page" : undefined}
          >
            <HiBookmark className="size-4" />
            <span className="vault-nav-number">3</span>
          </button>
        </nav>
        <div className="fixed right-5 top-5 z-40 flex items-center gap-3 text-foreground drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]">
          <Toggle />
          <SettingsButton />
        </div>
        <div className={`flex min-h-screen items-center justify-center px-4 pb-10 pt-28 transition-all duration-500 ease-in-out ${bookmarksOpen ? "-translate-x-full opacity-0" : readOpen ? "translate-x-full opacity-0" : "translate-x-0 opacity-100"}`}>
        <div className={`dashboard-grid grid w-fit ${gapClass} grid-flow-row-dense content-center justify-center`}>

          {/* row 1 */}
          {showDecorativeMedia && showBox("videoTall") && <div className={panel(`overflow-hidden ${GRID_TALL} ${DASHBOARD_TALL_TILE} ${surface}`)}>
            {renderDecorativeVideo("tall", `sticky h-full w-full rounded-xl overflow-hidden`)}
          </div>}
          {showDecorativeMedia && showBox("videoSmall") && <div className={panel(`overflow-hidden ${GRID_SINGLE} ${DASHBOARD_TILE} ${surface}`)}>
            {renderDecorativeVideo("small", `sticky h-full w-full rounded-xl overflow-hidden`)}
          </div>}
          {showBox("search") && <div className={panel(`${GRID_WIDE} ${DASHBOARD_WIDE_TILE} ${strongSurface}`)}><SearchBox /></div>}
          {showBox("bookmark1") && <Bookmark title={ getBookmarkGroupForBox(0).title } content={ getBookmarkGroupForBox(0).content } onTitleClick={() => openBookmarkView(bookmarkBoxCategories[0] ?? 0)} cardClass={panel(`h-full w-full ${GRID_SINGLE} ${DASHBOARD_TILE} overflow-y-auto ${strongSurface}`)} />}
          {showBox("weather") && <div className={panel(`${GRID_WIDE} ${DASHBOARD_WIDE_TILE} overflow-hidden`)}><WeatherBox /></div>}
          
          {/* row 2 */}
          {showBox("unsplash2") && <div className={panel(`${GRID_SINGLE} ${DASHBOARD_TILE} ${surface}`)}><Unsplash search={ settings.unsplash.unsplashBox2 } cardClass={panel("relative overflow-hidden h-full w-full bg-center bg-no-repeat")} /></div>}
          {showBox("bookmark2") && <Bookmark title={ getBookmarkGroupForBox(1).title } content={ getBookmarkGroupForBox(1).content } onTitleClick={() => openBookmarkView(bookmarkBoxCategories[1] ?? 1)} cardClass={panel(`h-full w-full ${GRID_SINGLE} ${DASHBOARD_TILE} overflow-y-auto ${strongSurface}`)} />}
          {showBox("featurePanel") && <div className={panel(`grid-feature-responsive h-full w-full overflow-visible ${GRID_FEATURE} ${DASHBOARD_LARGE_TILE} ${surface}`)}><FeaturePanel /></div>}
          {showBox("unsplash3") && <div className={panel(`${GRID_SINGLE} ${DASHBOARD_TILE} ${surface}`)}><Unsplash search={ settings.unsplash.unsplashBox3 } cardClass={panel("relative overflow-hidden h-full w-full bg-center bg-no-repeat")} /></div>}

          {/* row 3 */}
          {showBox("bookmark3") && <Bookmark title={ getBookmarkGroupForBox(2).title } content={ getBookmarkGroupForBox(2).content } onTitleClick={() => openBookmarkView(bookmarkBoxCategories[2] ?? 2)} cardClass={panel(`h-full w-full ${GRID_SINGLE} ${DASHBOARD_TILE} overflow-y-auto ${strongSurface}`)} />}
          {showBox("solarGraph") && <div className={panel(`h-full w-full bg-black ${GRID_SOLAR} ${DASHBOARD_LARGE_TILE} border border-border/60 shadow-lg`)}><SolarGraph /></div>}

          {/* row 4 */}
          {showBox("bookmark4") && <Bookmark title={ getBookmarkGroupForBox(3).title } content={ getBookmarkGroupForBox(3).content } onTitleClick={() => openBookmarkView(bookmarkBoxCategories[3] ?? 3)} cardClass={panel(`h-full w-full ${GRID_SINGLE} ${DASHBOARD_TILE} overflow-y-auto ${strongSurface}`)} />}
          {showBox("bookmark5") && <Bookmark title={ getBookmarkGroupForBox(4).title } content={ getBookmarkGroupForBox(4).content } onTitleClick={() => openBookmarkView(bookmarkBoxCategories[4] ?? 4)} cardClass={panel(`h-full w-full ${GRID_SINGLE} ${DASHBOARD_TILE} overflow-y-auto ${strongSurface}`)} />}
          {showBox("unsplash4") && <div className={panel(`${GRID_SINGLE} ${DASHBOARD_TILE} ${surface}`)}><Unsplash search={ settings.unsplash.unsplashBox4 } cardClass={panel("relative overflow-hidden h-full w-full bg-center bg-no-repeat")} /></div>}
          {showBox("unsplash5") && <div className={panel(`${GRID_SINGLE} ${DASHBOARD_TILE} ${surface}`)}><Unsplash search={ settings.unsplash.unsplashBox5 } cardClass={panel("relative overflow-hidden h-full w-full bg-center bg-no-repeat")} /></div>}
          {showBox("vaultPreview") && <div className={panel(`${GRID_SINGLE} ${DASHBOARD_TILE} ${strongSurface} overflow-hidden`)}><ResourceVaultPreview items={settings.readItems} onOpen={openReadView} /></div>}
          {showBox("clock") && <div className={panel(`${GRID_SINGLE} ${DASHBOARD_TILE} ${mutedSurface}`)}><Clock /></div>}
        </div>
        </div>
        {bookmarksOpen && (
          <div className="absolute inset-0 z-20 overflow-y-auto transition-all duration-500 ease-in-out">
            <BookmarkView
              bookmarks={bookmarkGroups}
              activeCategoryIndex={activeBookmarkCategory}
              onBack={closeBookmarkView}
              onAddBookmark={handleAddBookmark}
              onRemoveBookmark={handleRemoveBookmark}
              onUpdateBookmark={handleUpdateBookmark}
              onAddCategory={handleAddBookmarkCategory}
              onRenameCategory={handleRenameBookmarkCategory}
              onDeleteCategory={handleDeleteBookmarkCategory}
              onMoveCategory={handleMoveBookmarkCategory}
              onMoveBookmark={handleMoveBookmark}
              onReorderCategory={handleReorderBookmarkCategory}
              onReorderBookmark={handleReorderBookmark}
              onImportBookmarks={handleImportBookmarks}
              onExportBookmarks={handleExportBookmarks}
              pillSize={ui.bookmarkPillSize}
            />
          </div>
        )}
        {readOpen && (
          <div className="absolute inset-0 z-20 overflow-y-auto transition-all duration-500 ease-in-out">
            <ReadView
              items={settings.readItems}
              onBack={closeReadView}
              onAddItem={handleAddReadItem}
              onExportItems={handleExportReadItems}
              onImportItems={handleImportReadItems}
              onToggleItem={handleToggleReadItem}
              onUpdateItem={handleUpdateReadItem}
              onDeleteItem={handleDeleteReadItem}
            />
          </div>
        )}
      </section>
        </KBarWrapper>
      </KBarProvider>
    </ThemeProvider>
  );
}
