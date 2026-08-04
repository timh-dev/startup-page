import { describe, expect, it } from "vitest";
import { normalizeBookmarkUrl } from "./url";

describe("normalizeBookmarkUrl", () => {
  it("leaves a URL with an explicit scheme untouched", () => {
    expect(normalizeBookmarkUrl("https://example.com")).toBe("https://example.com");
    expect(normalizeBookmarkUrl("http://example.com")).toBe("http://example.com");
    expect(normalizeBookmarkUrl("ftp://example.com")).toBe("ftp://example.com");
  });

  it("defaults a bare public hostname to https", () => {
    expect(normalizeBookmarkUrl("example.com")).toBe("https://example.com");
    expect(normalizeBookmarkUrl("www.example.com/path")).toBe("https://www.example.com/path");
  });

  it("defaults a self-hosted-looking hostname to http", () => {
    expect(normalizeBookmarkUrl("localhost:8080")).toBe("http://localhost:8080");
    expect(normalizeBookmarkUrl("192.168.1.1")).toBe("http://192.168.1.1");
    expect(normalizeBookmarkUrl("nas.local/share")).toBe("http://nas.local/share");
  });

  it("trims surrounding whitespace before checking the scheme", () => {
    expect(normalizeBookmarkUrl("  example.com  ")).toBe("https://example.com");
  });

  it("treats an empty or missing value as an empty string with the https default", () => {
    expect(normalizeBookmarkUrl("")).toBe("https://");
    expect(normalizeBookmarkUrl(undefined as unknown as string)).toBe("https://");
  });
});
