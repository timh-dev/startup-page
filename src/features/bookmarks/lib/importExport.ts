/*eslint-disable*/
import { countBookmarksInGroup, generateId } from "@/features/bookmarks/lib/tree";

export const detectBookmarkBrowser = () => {
  if (typeof navigator === "undefined") return "your browser";
  const ua = navigator.userAgent || "";
  if (/firefox/i.test(ua)) return "Firefox";
  if (/chrome|crios/i.test(ua) && !/edg|opr|opera/i.test(ua)) return "Chrome";
  if (/edg/i.test(ua)) return "Edge";
  if (/opr|opera/i.test(ua)) return "Opera";
  if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) return "Safari";
  return "your browser";
};

function escapeBookmarkHtml(value: any) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function createBookmarksExportHtml(groups: any[]) {
  function renderGroup(group: any, depth = 1): string {
    const indent = "    ".repeat(depth);
    const childIndent = "    ".repeat(depth + 1);
    const content = Array.isArray(group.content) ? group.content : [];
    const children = Array.isArray(group.children) ? group.children : [];

    return [
      `${indent}<DT><H3>${escapeBookmarkHtml(group.title || "Bookmarks")}</H3>`,
      `${indent}<DL><p>`,
      ...content.map(
        (bookmark: any) =>
          `${childIndent}<DT><A HREF="${escapeBookmarkHtml(bookmark.url)}">${escapeBookmarkHtml(bookmark.name || bookmark.url)}</A>`,
      ),
      ...children.map((child: any) => renderGroup(child, depth + 1)),
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

export function parseBrowserBookmarksHtml(html: string) {
  const parser = new DOMParser();
  const document = parser.parseFromString(html, "text/html");
  const roots: any[] = [];
  const uncategorized: any = { id: generateId(), title: "Uncategorized", content: [], children: [] };

  function getDirectBookmarkLinks(node: Element) {
    return Array.from(node.children)
      .filter((child) => child.tagName === "DT")
      .map((child) =>
        Array.from(child.children).find((grandchild) => grandchild.tagName === "A"),
      )
      .filter(Boolean)
      .map((anchor: any) => ({
        id: generateId(),
        name: (anchor.textContent || anchor.href || "Bookmark").trim(),
        url: anchor.getAttribute("href") || anchor.href,
      }))
      .filter((bookmark: any) => bookmark.url);
  }

  function parseFolder(heading: Element): any {
    const folder: any = {
      id: generateId(),
      title: (heading.textContent || "Imported Folder").trim(),
      content: [],
      children: [],
    };
    const dl =
      heading.parentElement?.nextElementSibling?.tagName === "DL"
        ? heading.parentElement.nextElementSibling
        : heading.nextElementSibling?.tagName === "DL"
          ? heading.nextElementSibling
          : null;

    if (!dl) return folder;

    folder.content = getDirectBookmarkLinks(dl);
    Array.from(dl.children)
      .filter((child) => child.tagName === "DT")
      .forEach((child) => {
        const childHeading = Array.from(child.children).find(
          (grandchild) => grandchild.tagName === "H3",
        );
        if (childHeading) folder.children.push(parseFolder(childHeading));
      });

    return folder;
  }

  const rootDl = document.querySelector("dl");
  if (!rootDl) return [];

  uncategorized.content = getDirectBookmarkLinks(rootDl);
  Array.from(rootDl.children)
    .filter((child) => child.tagName === "DT")
    .forEach((child) => {
      const heading = Array.from(child.children).find(
        (grandchild) => grandchild.tagName === "H3",
      );
      if (heading) roots.push(parseFolder(heading));
    });

  if (uncategorized.content.length) roots.unshift(uncategorized);

  return roots.filter((group) => countBookmarksInGroup(group) > 0);
}
