import { describe, expect, it } from "vitest";
import { createBookmarksExportHtml, detectBookmarkBrowser, parseBrowserBookmarksHtml } from "./importExport";

describe("createBookmarksExportHtml", () => {
  it("produces a valid Netscape bookmark file header", () => {
    const html = createBookmarksExportHtml([]);
    expect(html).toContain("<!DOCTYPE NETSCAPE-Bookmark-file-1>");
    expect(html).toContain("<TITLE>Bookmarks</TITLE>");
  });

  it("renders a folder with its bookmarks and nested children", () => {
    const html = createBookmarksExportHtml([
      {
        title: "Work",
        content: [{ name: "Example", url: "https://example.com" }],
        children: [{ title: "Nested", content: [{ name: "Deep", url: "https://deep.example.com" }] }],
      },
    ]);
    expect(html).toContain('<H3>Work</H3>');
    expect(html).toContain('<A HREF="https://example.com">Example</A>');
    expect(html).toContain('<H3>Nested</H3>');
    expect(html).toContain('<A HREF="https://deep.example.com">Deep</A>');
  });

  it("escapes HTML-significant characters in titles/names/urls", () => {
    const html = createBookmarksExportHtml([
      { title: 'A & B <folder>', content: [{ name: 'Q&A "quotes"', url: "https://example.com?a=1&b=2" }] },
    ]);
    expect(html).toContain("A &amp; B &lt;folder&gt;");
    expect(html).toContain("Q&amp;A &quot;quotes&quot;");
    expect(html).toContain("https://example.com?a=1&amp;b=2");
    expect(html).not.toContain("<folder>");
  });

  it("falls back to the URL as link text when a bookmark has no name", () => {
    const html = createBookmarksExportHtml([{ title: "Folder", content: [{ url: "https://example.com" }] }]);
    expect(html).toContain('<A HREF="https://example.com">https://example.com</A>');
  });
});

describe("parseBrowserBookmarksHtml", () => {
  it("round-trips a folder with a bookmark through export then import", () => {
    const exported = createBookmarksExportHtml([
      { title: "Work", content: [{ name: "Example", url: "https://example.com" }] },
    ]);
    const parsed = parseBrowserBookmarksHtml(exported);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe("Work");
    expect(parsed[0].content).toEqual([
      expect.objectContaining({ name: "Example", url: "https://example.com" }),
    ]);
  });

  it("round-trips nested folders", () => {
    const exported = createBookmarksExportHtml([
      {
        title: "Work",
        content: [],
        children: [{ title: "Nested", content: [{ name: "Deep", url: "https://deep.example.com" }] }],
      },
    ]);
    const parsed = parseBrowserBookmarksHtml(exported);
    expect(parsed[0].children).toHaveLength(1);
    expect(parsed[0].children[0].title).toBe("Nested");
    expect(parsed[0].children[0].content[0].url).toBe("https://deep.example.com");
  });

  it("collects top-level (uncategorized) links into a synthetic first folder", () => {
    const html = [
      "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
      "<DL><p>",
      '<DT><A HREF="https://example.com">Example</A>',
      "</DL><p>",
    ].join("\n");
    const parsed = parseBrowserBookmarksHtml(html);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe("Uncategorized");
    expect(parsed[0].content[0].url).toBe("https://example.com");
  });

  it("drops folders that end up with zero bookmarks (directly or nested)", () => {
    const html = [
      "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
      "<DL><p>",
      "<DT><H3>Empty</H3>",
      "<DL><p>",
      "</DL><p>",
      "</DL><p>",
    ].join("\n");
    expect(parseBrowserBookmarksHtml(html)).toEqual([]);
  });

  it("returns an empty array when there's no <DL> at all", () => {
    expect(parseBrowserBookmarksHtml("<html><body>not bookmarks</body></html>")).toEqual([]);
  });

  it("assigns every imported folder and bookmark a fresh id", () => {
    const exported = createBookmarksExportHtml([
      { title: "Work", content: [{ name: "Example", url: "https://example.com" }] },
    ]);
    const parsed = parseBrowserBookmarksHtml(exported);
    expect(parsed[0].id).toBeTruthy();
    expect(parsed[0].content[0].id).toBeTruthy();
  });
});

describe("detectBookmarkBrowser", () => {
  it("identifies common browsers from their user agent string", () => {
    const cases: Array<[string, string]> = [
      ["Mozilla/5.0 (Windows NT 10.0) Gecko/20100101 Firefox/120.0", "Firefox"],
      ["Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36", "Chrome"],
      ["Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0 Safari/537.36 Edg/120.0", "Edge"],
      ["Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15", "Safari"],
    ];
    const original = navigator.userAgent;
    for (const [ua, expected] of cases) {
      Object.defineProperty(navigator, "userAgent", { value: ua, configurable: true });
      expect(detectBookmarkBrowser()).toBe(expected);
    }
    Object.defineProperty(navigator, "userAgent", { value: original, configurable: true });
  });
});
