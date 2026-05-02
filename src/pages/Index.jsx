/*eslint-disable*/
import React from "react";
import { KBarProvider } from "kbar";
import { HiArrowLeft, HiArrowTopRightOnSquare, HiBookmark, HiChevronLeft, HiChevronRight, HiMinus, HiPencil, HiPlus, HiTrash } from "react-icons/hi2";

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
import WeatherBox from "../components/Weather";
import Toggle from "../components/ThemeToggle";
import ThemeProvider from "../components/ThemeContext";
import Bookmark, { faviconUrl, isSelfHostedUrl, LocalServiceStatus } from "../components/Bookmark";
import SettingsButton from "../components/SettingsButton";
import CommandPalette from "../components/CommandPalette";
import useKBarActions from "../hooks/useKBarActions";

// assets
import desert from "../assets/media/desert.mp4"

const STARTUP_PAGE_VIEW_KEY = "startup-page.active-view";
const STARTUP_PAGE_BOOKMARK_CATEGORY_KEY = "startup-page.active-bookmark-category";

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
  pillSize = 3.25,
}) {
  const [addOpen, setAddOpen] = React.useState(false);
  const [categoryOpen, setCategoryOpen] = React.useState(false);
  const [editingBookmark, setEditingBookmark] = React.useState(null);
  const [editingCategory, setEditingCategory] = React.useState(null);
  const [categoryDraft, setCategoryDraft] = React.useState("");
  const [collapsedCategories, setCollapsedCategories] = React.useState(() => new Set());
  const [draggedItem, setDraggedItem] = React.useState(null);
  const [dragOverItem, setDragOverItem] = React.useState(null);
  const [draft, setDraft] = React.useState({
    categoryIndex: activeCategoryIndex ?? 0,
    name: "",
    url: "",
  });

  React.useEffect(() => {
    setDraft((prev) => ({
      ...prev,
      categoryIndex: activeCategoryIndex ?? prev.categoryIndex ?? 0,
    }));
  }, [activeCategoryIndex]);

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

  const handleSubmit = async (event) => {
    event.preventDefault();
    const name = draft.name.trim();
    const url = draft.url.trim();

    if (!name || !url) {
      return;
    }

    if (editingBookmark) {
      await onUpdateBookmark(editingBookmark.categoryIndex, editingBookmark.bookmarkIndex, { name, url });
      setEditingBookmark(null);
    } else {
      await onAddBookmark(Number(draft.categoryIndex), { name, url });
    }

    setDraft((prev) => ({ ...prev, name: "", url: "" }));
    setAddOpen(false);
  };

  const handleEditBookmark = (categoryIndex, bookmarkIndex, bookmark) => {
    setEditingBookmark({ categoryIndex, bookmarkIndex });
    setDraft({
      categoryIndex,
      name: bookmark.name || "",
      url: bookmark.url || "",
    });
    setAddOpen(true);
  };

  const handleEditCategory = (categoryIndex, title) => {
    setEditingCategory({ categoryIndex, previousTitle: title });
    setCategoryDraft(title || "");
    setAddOpen(false);
    setEditingBookmark(null);
    setCategoryOpen(true);
  };

  const handleDeleteCategory = async (categoryIndex, title) => {
    await onDeleteCategory(categoryIndex);
    setCollapsedCategories((current) => {
      const next = new Set(current);
      next.delete(title);
      return next;
    });

    if (editingCategory?.categoryIndex === categoryIndex) {
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
      categoryIndex: activeCategoryIndex ?? prev.categoryIndex ?? 0,
      name: "",
      url: "",
    }));
    setAddOpen((open) => !open);
  };

  const handleCategorySubmit = async (event) => {
    event.preventDefault();
    const title = categoryDraft.trim();

    if (!title) {
      return;
    }

    if (editingCategory) {
      await onRenameCategory(editingCategory.categoryIndex, title);
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
      await onAddCategory(title);
      setCollapsedCategories((current) => {
        const next = new Set(current);
        next.delete(title);
        return next;
      });
    }

    setCategoryDraft("");
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

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-background px-4 py-5 text-foreground">
      <div className="flex h-20 items-start justify-between border-b border-border/40">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex size-12 items-center justify-center rounded-full bg-card text-card-foreground shadow-lg transition hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          title="Back to dashboard"
        >
          <HiArrowLeft className="size-5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-3 pt-5">
        {orderedBookmarks.map((group) => {
          const content = Array.isArray(group.content) ? group.content : [];
          const isCollapsed = collapsedCategories.has(group.title);

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
                    setDraft((prev) => ({ ...prev, categoryIndex: group.originalIndex }));
                    toggleCategoryCollapsed(group.title);
                  }}
                  className={`inline-flex cursor-grab items-center justify-between gap-2 rounded-full bg-primary font-medium text-primary-foreground shadow-lg transition active:cursor-grabbing hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring ${
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
                      className="inline-flex shrink-0 items-center justify-center rounded-full bg-background/25 text-primary-foreground"
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
                    {content.length}
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
                    handleEditCategory(group.originalIndex, group.title);
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
                      handleDeleteCategory(group.originalIndex, group.title);
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
                          <img
                            src={iconUrl}
                            alt=""
                            className="rounded-sm object-contain"
                            style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
                            onError={(event) => { event.currentTarget.style.display = "none"; }}
                          />
                        ) : (
                          <HiArrowTopRightOnSquare className="opacity-65" style={{ width: `${iconSize}px`, height: `${iconSize}px` }} />
                        )}
                      </span>
                      <span className="truncate font-medium">{name}</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => onRemoveBookmark(group.originalIndex, index)}
                      className="absolute -left-1.5 -top-1.5 inline-flex items-center justify-center rounded-full border border-border/60 bg-card text-card-foreground opacity-0 shadow-md transition hover:bg-destructive hover:text-destructive-foreground focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring group-hover:opacity-100"
                      style={controlButtonStyle}
                      title={`Remove ${name}`}
                    >
                      <HiMinus className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEditBookmark(group.originalIndex, index, bookmark)}
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
            </React.Fragment>
          );
        })}

        <button
          type="button"
          onClick={handleAddToggle}
          className="inline-flex items-center justify-center rounded-full bg-card text-card-foreground shadow-lg transition hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
            setCategoryOpen((open) => !open);
          }}
          className="inline-flex items-center justify-center rounded-full bg-card px-5 font-medium text-card-foreground shadow-lg transition hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          style={{ height: `${pillHeight}px`, fontSize: `${textSize}px` }}
          title="Add category"
        >
          Category +
        </button>
      </div>

      {categoryOpen ? (
        <form
          onSubmit={handleCategorySubmit}
          className="mt-7 flex max-w-xl flex-wrap items-end gap-3 rounded-3xl border border-border/60 bg-card p-4 shadow-lg"
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
          className="mt-7 flex max-w-4xl flex-wrap items-end gap-3 rounded-3xl border border-border/60 bg-card p-4 shadow-lg"
        >
          <label className="grid gap-1 text-xs text-muted-foreground">
            Category
            <select
              value={draft.categoryIndex}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, categoryIndex: event.target.value }))
              }
              className="h-11 rounded-full border border-input bg-background px-4 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              {bookmarks.map((group, index) => (
                <option key={`${group.title}-${index}`} value={index}>
                  {group.title}
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
    .dashboard-grid { grid-template-columns: repeat(2, ${tilePx}px); grid-auto-rows: ${tilePx}px; }
    .bookmark-page-grid { grid-template-columns: repeat(2, ${tilePx}px); grid-auto-rows: ${tilePx}px; }
    @media (min-width: ${minWidthFor(3)}px) { .dashboard-grid { grid-template-columns: repeat(3, ${tilePx}px); } }
    @media (min-width: ${minWidthFor(3)}px) { .bookmark-page-grid { grid-template-columns: repeat(3, ${tilePx}px); } }
    @media (min-width: ${minWidthFor(5)}px) { .dashboard-grid { grid-template-columns: repeat(5, ${tilePx}px); } }
    @media (min-width: ${minWidthFor(5)}px) { .bookmark-page-grid { grid-template-columns: repeat(5, ${tilePx}px); } }
    @media (min-width: ${minWidthFor(7)}px) { .dashboard-grid { grid-template-columns: repeat(7, ${tilePx}px); } }
    @media (min-width: ${minWidthFor(7)}px) { .bookmark-page-grid { grid-template-columns: repeat(7, ${tilePx}px); } }
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
  const [bookmarksOpen, setBookmarksOpen] = React.useState(() =>
    typeof window !== "undefined" && window.localStorage?.getItem(STARTUP_PAGE_VIEW_KEY) === "bookmarks"
  );
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
  const openBookmarkView = (categoryIndex = null) => {
    setActiveBookmarkCategory(categoryIndex);
    setBookmarksOpen(true);
    window.localStorage?.setItem(STARTUP_PAGE_VIEW_KEY, "bookmarks");

    if (categoryIndex === null) {
      window.localStorage?.removeItem(STARTUP_PAGE_BOOKMARK_CATEGORY_KEY);
    } else {
      window.localStorage?.setItem(STARTUP_PAGE_BOOKMARK_CATEGORY_KEY, String(categoryIndex));
    }
  };

  const closeBookmarkView = () => {
    setBookmarksOpen(false);
    window.localStorage?.setItem(STARTUP_PAGE_VIEW_KEY, "dashboard");
  };

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
      bookmark: currentBookmarkGroups.map((group, index) =>
        index === categoryIndex
          ? {
              ...group,
              content: [
                ...(Array.isArray(group.content) ? group.content : []),
                { name: bookmark.name, url: normalizedUrl },
              ],
            }
          : group
      ),
    };

    await persistSettings(nextSettings);
  };

  const handleUpdateBookmark = async (categoryIndex, bookmarkIndex, bookmark) => {
    const currentSettings = latestSettingsRef.current;
    const currentBookmarkGroups = Array.isArray(currentSettings.bookmark) ? currentSettings.bookmark : [];
    const normalizedUrl = normalizeBookmarkUrl(bookmark.url);
    const nextSettings = {
      ...currentSettings,
      bookmark: currentBookmarkGroups.map((group, index) =>
        index === categoryIndex
          ? {
              ...group,
              content: (Array.isArray(group.content) ? group.content : []).map((item, itemIndex) =>
                itemIndex === bookmarkIndex
                  ? { name: bookmark.name, url: normalizedUrl }
                  : item
              ),
            }
          : group
      ),
    };

    await persistSettings(nextSettings);
  };

  const handleRemoveBookmark = async (categoryIndex, bookmarkIndex) => {
    const currentSettings = latestSettingsRef.current;
    const currentBookmarkGroups = Array.isArray(currentSettings.bookmark) ? currentSettings.bookmark : [];
    const nextSettings = {
      ...currentSettings,
      bookmark: currentBookmarkGroups.map((group, index) =>
        index === categoryIndex
          ? {
              ...group,
              content: (Array.isArray(group.content) ? group.content : []).filter(
                (_item, itemIndex) => itemIndex !== bookmarkIndex
              ),
            }
          : group
      ),
    };

    await persistSettings(nextSettings);
  };

  const handleAddBookmarkCategory = async (title) => {
    const currentSettings = latestSettingsRef.current;
    const currentBookmarkGroups = Array.isArray(currentSettings.bookmark) ? currentSettings.bookmark : [];
    const nextSettings = {
      ...currentSettings,
      bookmark: [
        ...currentBookmarkGroups,
        { title, content: [] },
      ],
    };

    updateActiveBookmarkCategory(currentBookmarkGroups.length);
    await persistSettings(nextSettings);
  };

  const handleRenameBookmarkCategory = async (categoryIndex, title) => {
    const currentSettings = latestSettingsRef.current;
    const currentBookmarkGroups = Array.isArray(currentSettings.bookmark) ? currentSettings.bookmark : [];

    if (!currentBookmarkGroups[categoryIndex]) {
      return;
    }

    await persistSettings({
      ...currentSettings,
      bookmark: currentBookmarkGroups.map((group, index) =>
        index === categoryIndex
          ? { ...group, title }
          : group
      ),
    });
  };

  const handleDeleteBookmarkCategory = async (categoryIndex) => {
    const currentSettings = latestSettingsRef.current;
    const currentBookmarkGroups = Array.isArray(currentSettings.bookmark) ? currentSettings.bookmark : [];
    const currentMapping = currentSettings.layout?.bookmarkBoxCategories || [0, 1, 2, 3, 4];

    if (currentBookmarkGroups.length <= 1 || !currentBookmarkGroups[categoryIndex]) {
      return;
    }

    const bookmark = currentBookmarkGroups.filter((_group, index) => index !== categoryIndex);
    const fallbackIndex = Math.min(categoryIndex, bookmark.length - 1);
    const bookmarkBoxCategoriesNext = currentMapping.map((mappedIndex, boxIndex) => {
      if (mappedIndex === categoryIndex) {
        return Math.min(boxIndex, bookmark.length - 1);
      }

      if (mappedIndex > categoryIndex) {
        return mappedIndex - 1;
      }

      return Math.min(mappedIndex, bookmark.length - 1);
    });

    if (activeBookmarkCategory === categoryIndex) {
      updateActiveBookmarkCategory(fallbackIndex);
    } else if (activeBookmarkCategory > categoryIndex) {
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
    const group = currentBookmarkGroups[categoryIndex];
    const content = Array.isArray(group?.content) ? [...group.content] : [];
    const nextIndex = bookmarkIndex + direction;

    if (!group || nextIndex < 0 || nextIndex >= content.length) {
      return;
    }

    [content[bookmarkIndex], content[nextIndex]] = [content[nextIndex], content[bookmarkIndex]];

    const bookmark = currentBookmarkGroups.map((currentGroup, index) =>
      index === categoryIndex
        ? { ...currentGroup, content }
        : currentGroup
    );

    await persistSettings({
      ...currentSettings,
      bookmark,
    });
  };

  const handleReorderBookmark = async (fromCategoryIndex, fromBookmarkIndex, toCategoryIndex, toBookmarkIndex) => {
    const currentSettings = latestSettingsRef.current;
    const currentBookmarkGroups = Array.isArray(currentSettings.bookmark) ? currentSettings.bookmark : [];
    const fromGroup = currentBookmarkGroups[fromCategoryIndex];
    const toGroup = currentBookmarkGroups[toCategoryIndex];
    const fromContent = Array.isArray(fromGroup?.content) ? [...fromGroup.content] : [];
    const toContent = fromCategoryIndex === toCategoryIndex
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
      fromCategoryIndex === toCategoryIndex &&
      (fromBookmarkIndex === toBookmarkIndex || fromBookmarkIndex + 1 === toBookmarkIndex)
    ) {
      return;
    }

    const [movedBookmark] = fromContent.splice(fromBookmarkIndex, 1);
    const adjustedTargetIndex = fromCategoryIndex === toCategoryIndex && toBookmarkIndex > fromBookmarkIndex
      ? toBookmarkIndex - 1
      : toBookmarkIndex;
    const boundedTargetIndex = Math.max(0, Math.min(adjustedTargetIndex, toContent.length));
    toContent.splice(boundedTargetIndex, 0, movedBookmark);

    const bookmark = currentBookmarkGroups.map((group, index) => {
      if (index === fromCategoryIndex) {
        return { ...group, content: fromContent };
      }

      if (index === toCategoryIndex) {
        return { ...group, content: toContent };
      }

      return group;
    });

    await persistSettings({
      ...currentSettings,
      bookmark,
    });
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
      <section className="relative min-h-screen overflow-hidden bg-background text-foreground transition-colors">
        <style>{gridCss}</style>
        <div className={`flex min-h-screen items-center justify-center px-4 pt-10 pb-10 transition-all duration-500 ease-in-out ${bookmarksOpen ? "-translate-x-full opacity-0" : "translate-x-0 opacity-100"}`}>
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
          {showBox("unsplash1") && <div className={panel(`${GRID_SINGLE} ${DASHBOARD_TILE} ${surface}`)}><Unsplash search={ settings.unsplash.unsplashBox1 } cardClass={panel("relative overflow-hidden h-full w-full bg-center bg-no-repeat")} /></div>}
          {showBox("weather") && <div className={panel(`${GRID_SINGLE} ${DASHBOARD_TILE} ${mutedSurface}`)}><WeatherBox /></div>}
          
          {/* row 2 */}
          {showBox("unsplash2") && <div className={panel(`${GRID_SINGLE} ${DASHBOARD_TILE} ${surface}`)}><Unsplash search={ settings.unsplash.unsplashBox2 } cardClass={panel("relative overflow-hidden h-full w-full bg-center bg-no-repeat")} /></div>}
          {showBox("bookmark2") && <Bookmark title={ getBookmarkGroupForBox(1).title } content={ getBookmarkGroupForBox(1).content } onTitleClick={() => openBookmarkView(bookmarkBoxCategories[1] ?? 1)} cardClass={panel(`h-full w-full ${GRID_SINGLE} ${DASHBOARD_TILE} overflow-y-auto ${strongSurface}`)} />}
          {showBox("featurePanel") && <div className={panel(`h-full w-full overflow-visible ${GRID_FEATURE} ${DASHBOARD_LARGE_TILE} ${surface}`)}><FeaturePanel /></div>}
          {showBox("unsplash3") && <div className={panel(`${GRID_SINGLE} ${DASHBOARD_TILE} ${surface}`)}><Unsplash search={ settings.unsplash.unsplashBox3 } cardClass={panel("relative overflow-hidden h-full w-full bg-center bg-no-repeat")} /></div>}

          {/* row 3 */}
          {showBox("bookmark3") && <Bookmark title={ getBookmarkGroupForBox(2).title } content={ getBookmarkGroupForBox(2).content } onTitleClick={() => openBookmarkView(bookmarkBoxCategories[2] ?? 2)} cardClass={panel(`h-full w-full ${GRID_SINGLE} ${DASHBOARD_TILE} overflow-y-auto ${strongSurface}`)} />}
          {showBox("solarGraph") && <div className={panel(`h-full w-full bg-black ${GRID_SOLAR} ${DASHBOARD_LARGE_TILE} border border-border/60 shadow-lg`)}><SolarGraph /></div>}

          {/* row 4 */}
          {showBox("bookmark4") && <Bookmark title={ getBookmarkGroupForBox(3).title } content={ getBookmarkGroupForBox(3).content } onTitleClick={() => openBookmarkView(bookmarkBoxCategories[3] ?? 3)} cardClass={panel(`h-full w-full ${GRID_SINGLE} ${DASHBOARD_TILE} overflow-y-auto ${strongSurface}`)} />}
          {showBox("bookmark5") && <Bookmark title={ getBookmarkGroupForBox(4).title } content={ getBookmarkGroupForBox(4).content } onTitleClick={() => openBookmarkView(bookmarkBoxCategories[4] ?? 4)} cardClass={panel(`h-full w-full ${GRID_SINGLE} ${DASHBOARD_TILE} overflow-y-auto ${strongSurface}`)} />}
          {showBox("unsplash4") && <div className={panel(`${GRID_SINGLE} ${DASHBOARD_TILE} ${surface}`)}><Unsplash search={ settings.unsplash.unsplashBox4 } cardClass={panel("relative overflow-hidden h-full w-full bg-center bg-no-repeat")} /></div>}
          {showBox("themeTools") && <div className={panel(`h-full w-full flex items-center justify-center gap-1 ${GRID_SINGLE} ${DASHBOARD_TILE} ${strongSurface}`)}>
              <Toggle />
            <button
              type="button"
              onClick={() => openBookmarkView(null)}
              className="text-4xl text-primary-foreground transition hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-primary-foreground/45"
              title="Open bookmark view"
            >
              <HiBookmark />
            </button>
            <SettingsButton />
          </div>}
          {showBox("unsplash5") && <div className={panel(`${GRID_SINGLE} ${DASHBOARD_TILE} ${surface}`)}><Unsplash search={ settings.unsplash.unsplashBox5 } cardClass={panel("relative overflow-hidden h-full w-full bg-center bg-no-repeat")} /></div>}
          {showBox("clock") && <div className={panel(`${GRID_SINGLE} ${DASHBOARD_TILE} ${mutedSurface}`)}><Clock /></div>}
        </div>
        </div>
        <div className={`absolute inset-0 transition-all duration-500 ease-in-out ${bookmarksOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none"}`}>
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
            pillSize={ui.bookmarkPillSize}
          />
        </div>
      </section>
        </KBarWrapper>
      </KBarProvider>
    </ThemeProvider>
  );
}
