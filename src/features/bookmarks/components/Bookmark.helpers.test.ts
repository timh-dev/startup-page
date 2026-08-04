import { describe, expect, it } from "vitest";
import { faviconFallbackLabel, faviconSrcSet, faviconUrl, getHostname, isSelfHostedUrl } from "./Bookmark";

describe("getHostname", () => {
  it("extracts the hostname and strips a leading www.", () => {
    expect(getHostname("https://www.example.com/path")).toBe("example.com");
    expect(getHostname("https://sub.example.com")).toBe("sub.example.com");
  });

  it("assumes http:// when no scheme is given", () => {
    expect(getHostname("example.com")).toBe("example.com");
  });

  it("returns an empty string for unparsable input", () => {
    expect(getHostname("")).toBe("");
    expect(getHostname(null)).toBe("");
  });
});

describe("faviconUrl / faviconSrcSet", () => {
  it("builds a Google favicon URL keyed on the hostname and size", () => {
    expect(faviconUrl("https://example.com")).toBe(
      "https://www.google.com/s2/favicons?domain=example.com&sz=64",
    );
    expect(faviconUrl("https://example.com", 32)).toContain("sz=32");
  });

  it("returns null when the URL has no resolvable hostname", () => {
    expect(faviconUrl("")).toBeNull();
  });

  it("builds a 1x/2x/3x srcset from the same hostname", () => {
    const srcSet = faviconSrcSet("https://example.com");
    expect(srcSet).toBe(
      "https://www.google.com/s2/favicons?domain=example.com&sz=32 1x, " +
        "https://www.google.com/s2/favicons?domain=example.com&sz=64 2x, " +
        "https://www.google.com/s2/favicons?domain=example.com&sz=128 3x",
    );
  });

  it("returns undefined srcset when there's no hostname", () => {
    expect(faviconSrcSet("")).toBeUndefined();
  });
});

describe("faviconFallbackLabel", () => {
  it("uses the first alphanumeric character of the name, uppercased", () => {
    expect(faviconFallbackLabel("hacker news", "https://news.ycombinator.com")).toBe("H");
  });

  it("falls back to the hostname when no name is given", () => {
    expect(faviconFallbackLabel("", "https://example.com")).toBe("E");
  });

  it("falls back to '?' when nothing alphanumeric is available", () => {
    expect(faviconFallbackLabel("", "")).toBe("?");
  });
});

describe("isSelfHostedUrl", () => {
  it("flags IPv4 hosts", () => {
    expect(isSelfHostedUrl("http://192.168.1.1")).toBe(true);
    expect(isSelfHostedUrl("192.168.1.1:8080")).toBe(true);
  });

  it("flags IPv6 hosts", () => {
    expect(isSelfHostedUrl("http://[::1]")).toBe(true);
  });

  it("flags localhost and .local domains", () => {
    expect(isSelfHostedUrl("localhost:3000")).toBe(true);
    expect(isSelfHostedUrl("http://nas.local")).toBe(true);
  });

  it("does not flag ordinary public domains", () => {
    expect(isSelfHostedUrl("https://example.com")).toBe(false);
    expect(isSelfHostedUrl("https://github.com")).toBe(false);
  });

  it("returns false for unparsable input instead of throwing", () => {
    expect(isSelfHostedUrl("")).toBe(false);
  });
});
