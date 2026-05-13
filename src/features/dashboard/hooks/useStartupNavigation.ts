import React from "react";

const STARTUP_PAGE_VIEW_KEY = "startup-page.active-view";
const STARTUP_PAGE_BOOKMARK_CATEGORY_KEY = "startup-page.active-bookmark-category";
const VALID_PAGE_VIEWS = new Set(["dashboard", "bookmarks", "read"]);

export type StartupPageView = "dashboard" | "bookmarks" | "read";

const readStoredView = (): StartupPageView => {
  if (typeof window === "undefined") {
    return "dashboard";
  }

  const storedView = window.localStorage?.getItem(STARTUP_PAGE_VIEW_KEY);
  return VALID_PAGE_VIEWS.has(storedView ?? "") ? (storedView as StartupPageView) : "dashboard";
};

const readStoredBookmarkCategory = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const storedCategory = window.localStorage?.getItem(STARTUP_PAGE_BOOKMARK_CATEGORY_KEY);
  return storedCategory === null ? null : Number(storedCategory);
};

export function useStartupNavigation() {
  const [activeView, setActiveView] = React.useState<StartupPageView>(readStoredView);
  const [activeBookmarkCategory, setActiveBookmarkCategory] = React.useState<number | null>(
    readStoredBookmarkCategory,
  );

  const updateActiveBookmarkCategory = React.useCallback((categoryIndex: number | null) => {
    setActiveBookmarkCategory(categoryIndex);

    if (categoryIndex === null) {
      window.localStorage?.removeItem(STARTUP_PAGE_BOOKMARK_CATEGORY_KEY);
    } else {
      window.localStorage?.setItem(STARTUP_PAGE_BOOKMARK_CATEGORY_KEY, String(categoryIndex));
    }
  }, []);

  const openBookmarkView = React.useCallback((categoryIndex: number | null = null) => {
    updateActiveBookmarkCategory(categoryIndex);
    setActiveView("bookmarks");
    window.localStorage?.setItem(STARTUP_PAGE_VIEW_KEY, "bookmarks");
  }, [updateActiveBookmarkCategory]);

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

  return {
    activeView,
    activeBookmarkCategory,
    bookmarksOpen: activeView === "bookmarks",
    readOpen: activeView === "read",
    openBookmarkView,
    openBookmarkVault,
    closeBookmarkView,
    openReadView,
    closeReadView,
    updateActiveBookmarkCategory,
  };
}
