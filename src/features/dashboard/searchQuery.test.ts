import { describe, expect, it } from "vitest";
import { DEFAULT_SEARCH_ENGINES } from "@/features/dashboard/searchEngines";
import { asUrl, describeIntent, resolveQuery, safeCalculate } from "@/features/dashboard/searchQuery";

const engines = DEFAULT_SEARCH_ENGINES;

describe("resolveQuery", () => {
  it("searches the given engine, else the first one", () => {
    expect(resolveQuery("lofi beats", engines)).toEqual({
      kind: "search",
      label: "DuckDuckGo",
      query: "lofi beats",
      url: "https://duckduckgo.com/?q=lofi%20beats",
    });
    expect(resolveQuery("paris", engines, engines[3])).toMatchObject({ url: "https://www.google.com/maps/search/paris" });
  });

  it("knows the built-in bangs and the user's engines by id", () => {
    expect(resolveQuery("!yt lofi", engines)).toMatchObject({ kind: "bang", label: "YouTube", url: "https://www.youtube.com/results?search_query=lofi" });
    expect(resolveQuery("!maps paris", engines)).toMatchObject({ kind: "bang", label: "Google Maps" });
    expect(resolveQuery("!wikipedia moon", engines)).toMatchObject({ kind: "bang", label: "Wikipedia" });
  });

  it("searches an unknown bang as plain text", () => {
    expect(resolveQuery("!nope thing", engines)).toMatchObject({ kind: "search", query: "!nope thing" });
  });

  it("works out sums and leaves unfinished ones alone", () => {
    expect(resolveQuery("= 2^10", engines)).toEqual({ kind: "calc", result: "1024" });
    expect(resolveQuery("=0.1+0.2", engines)).toEqual({ kind: "calc", result: "0.3" });
    expect(resolveQuery("= 2 +", engines)).toBeNull();
    expect(resolveQuery("=", engines)).toBeNull();
  });

  it("opens things that look like sites", () => {
    expect(resolveQuery("example.com", engines)).toEqual({ kind: "url", url: "https://example.com" });
    expect(resolveQuery("localhost:5211/startup-page", engines)).toEqual({ kind: "url", url: "http://localhost:5211/startup-page" });
    expect(resolveQuery("node.js streams", engines)?.kind).toBe("search");
  });

  it("does nothing for an empty query or with no engine", () => {
    expect(resolveQuery("   ", engines)).toBeNull();
    expect(resolveQuery("hello", [])).toBeNull();
  });
});

describe("asUrl", () => {
  it("keeps full URLs and rejects words", () => {
    expect(asUrl("https://a.b/c?d")).toBe("https://a.b/c?d");
    expect(asUrl("hello")).toBeNull();
    expect(asUrl("v1.2")).toBeNull();
  });
});

describe("safeCalculate", () => {
  it("refuses anything but arithmetic", () => {
    expect(safeCalculate("alert(1)")).toBeNull();
    expect(safeCalculate("1/0")).toBeNull();
    expect(safeCalculate("1,000*2")).toBe(2000);
  });
});

describe("describeIntent", () => {
  it("says what Enter will do", () => {
    expect(describeIntent({ kind: "url", url: "https://example.com" })).toBe("Open example.com");
    expect(describeIntent({ kind: "calc", result: "4" })).toBe("= 4");
  });
});
