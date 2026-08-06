// @vitest-environment node
//
// This endpoint runs as a Vercel serverless function (Node/edge runtime),
// never in a browser — jsdom's fetch/Response/ReadableStream shims don't
// match production closely enough, so this file opts into the real `node`
// environment instead of the project's default jsdom one.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GET,
  decodeEntities,
  extractDescription,
  extractOgType,
  extractTitle,
  faviconUrlFor,
  fetchYoutubeOembed,
  isBlockedHostname,
  isYoutubeUrl,
  suggestTag,
} from "./link-preview";

function htmlResponse(html: string, contentType = "text/html; charset=utf-8") {
  return new Response(html, { status: 200, headers: { "content-type": contentType } });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function requestFor(url: string) {
  return new Request(`https://example.com/api/link-preview?url=${encodeURIComponent(url)}`);
}

describe("extractTitle / extractDescription (pure regex extraction)", () => {
  it("prefers og:title / og:description over the plain <title>/meta description", () => {
    const html = `
      <head>
        <title>Fallback Title</title>
        <meta name="description" content="Fallback description">
        <meta property="og:title" content="Real OG Title">
        <meta property="og:description" content="Real OG description">
      </head>`;
    expect(extractTitle(html)).toBe("Real OG Title");
    expect(extractDescription(html)).toBe("Real OG description");
  });

  it("falls back to <title> and meta[name=description] when there's no OG tag", () => {
    const html = `<head><title>Plain Title</title><meta name="description" content="Plain description"></head>`;
    expect(extractTitle(html)).toBe("Plain Title");
    expect(extractDescription(html)).toBe("Plain description");
  });

  it("handles content= appearing before property= in the same meta tag", () => {
    const html = `<meta content="Reordered OG Title" property="og:title">`;
    expect(extractTitle(html)).toBe("Reordered OG Title");
  });

  it("decodes HTML entities in the extracted text", () => {
    const html = `<title>Tom &amp; Jerry &mdash;&nbsp;S1</title>`;
    // &mdash; isn't in the decode list (only the ones actually seen in the
    // wild for titles/descriptions are handled) — the point of this test is
    // that &amp;/&nbsp; DO get decoded correctly, not exhaustive entity coverage.
    expect(extractTitle(html)).toBe("Tom & Jerry &mdash; S1");
  });

  it("returns null when neither OG tags nor a usable <title>/description exist", () => {
    expect(extractTitle("<head></head>")).toBeNull();
    expect(extractDescription("<head></head>")).toBeNull();
  });
});

describe("isBlockedHostname", () => {
  it("blocks localhost/private/link-local ranges", () => {
    for (const host of ["localhost", "127.0.0.1", "169.254.169.254", "10.0.0.5", "192.168.1.1", "172.16.0.1"]) {
      expect(isBlockedHostname(host)).toBe(true);
    }
  });

  it("allows ordinary public hostnames", () => {
    for (const host of ["wanderlog.com", "www.youtube.com", "github.com"]) {
      expect(isBlockedHostname(host)).toBe(false);
    }
  });
});

describe("isYoutubeUrl", () => {
  it("recognizes youtube.com and youtu.be in any common form", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=2QmP_adcZEY",
      "https://youtube.com/watch?v=2QmP_adcZEY",
      "https://m.youtube.com/watch?v=2QmP_adcZEY",
      "https://youtu.be/2QmP_adcZEY",
    ]) {
      expect(isYoutubeUrl(new URL(url))).toBe(true);
    }
  });

  it("does not misfire on unrelated hosts", () => {
    expect(isYoutubeUrl(new URL("https://wanderlog.com/"))).toBe(false);
    expect(isYoutubeUrl(new URL("https://www.youtube-downloader.example.com/"))).toBe(false);
  });
});

describe("suggestTag", () => {
  it("maps well-known hostnames to their tag", () => {
    expect(suggestTag(new URL("https://www.youtube.com/watch?v=abc"))).toBe("Watch");
    expect(suggestTag(new URL("https://youtu.be/abc"))).toBe("Watch");
    expect(suggestTag(new URL("https://vimeo.com/12345"))).toBe("Watch");
    expect(suggestTag(new URL("https://open.spotify.com/episode/abc"))).toBe("Listen");
    expect(suggestTag(new URL("https://soundcloud.com/someone/track"))).toBe("Listen");
    expect(suggestTag(new URL("https://github.com/someorg/somerepo"))).toBe("Build");
    expect(suggestTag(new URL("https://www.udemy.com/course/x"))).toBe("Learn");
    expect(suggestTag(new URL("https://www.airbnb.com/rooms/123"))).toBe("Travel");
    expect(suggestTag(new URL("https://www.eventbrite.com/e/some-event"))).toBe("Join");
    expect(suggestTag(new URL("https://docs.stripe.com/api"))).toBe("Reference");
    expect(suggestTag(new URL("https://developer.mozilla.org/en-US/docs/Web"))).toBe("Reference");
  });

  it("distinguishes LinkedIn job postings from profiles by path", () => {
    expect(suggestTag(new URL("https://www.linkedin.com/jobs/view/123"))).toBe("Work");
    expect(suggestTag(new URL("https://www.linkedin.com/in/someone"))).toBe("Follow");
  });

  it("falls back to og:type when the hostname isn't recognized", () => {
    expect(suggestTag(new URL("https://example.com/post"), "article")).toBe("Read");
    expect(suggestTag(new URL("https://example.com/post"), "video.other")).toBe("Watch");
    expect(suggestTag(new URL("https://example.com/post"), "music.song")).toBe("Listen");
    expect(suggestTag(new URL("https://example.com/post"), "profile")).toBe("Follow");
  });

  it("returns null when nothing matches", () => {
    expect(suggestTag(new URL("https://example.com/post"))).toBeNull();
    expect(suggestTag(new URL("https://example.com/post"), "website")).toBeNull();
  });
});

describe("extractOgType", () => {
  it("extracts the og:type meta tag", () => {
    expect(extractOgType(`<meta property="og:type" content="article">`)).toBe("article");
  });

  it("returns null when absent", () => {
    expect(extractOgType("<head></head>")).toBeNull();
  });
});

describe("faviconUrlFor", () => {
  it("builds a Google favicon URL from the hostname", () => {
    expect(faviconUrlFor(new URL("https://wanderlog.com/trip/123"))).toBe(
      "https://www.google.com/s2/favicons?domain=wanderlog.com&sz=64",
    );
  });
});

describe("GET /api/link-preview — popular real-world site shapes", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("wanderlog.com: a normal site with real OG tags in static HTML works as-is", async () => {
    fetchMock.mockResolvedValueOnce(
      htmlResponse(`
        <head>
          <title>Wanderlog - Travel planning made easy</title>
          <meta property="og:title" content="Wanderlog: Trip Planner &amp; Itinerary App">
          <meta property="og:description" content="Plan your next trip with Wanderlog.">
        </head>`),
    );

    const res = await GET(requestFor("https://wanderlog.com/"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.title).toBe("Wanderlog: Trip Planner & Itinerary App");
    expect(body.description).toBe("Plan your next trip with Wanderlog.");
    // wanderlog.com isn't one of the hardcoded travel hostnames and this
    // page has no og:type — no confident tag guess, so null (not "Travel").
    expect(body.tag).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1); // no oEmbed detour for a non-YouTube host
  });

  it("youtube.com watch link: uses oEmbed and returns the real video title, not '- YouTube' boilerplate", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        title: "Never Gonna Give You Up",
        author_name: "Rick Astley",
        author_url: "https://www.youtube.com/@RickAstleyYT",
      }),
    );

    const res = await GET(requestFor("https://www.youtube.com/watch?v=2QmP_adcZEY"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.title).toBe("Never Gonna Give You Up");
    expect(body.title).not.toContain("- YouTube");
    expect(body.description).toBe("Video by Rick Astley");
    expect(body.tag).toBe("Watch");

    // Hit oEmbed only — never fell through to the generic HTML scrape.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("youtube.com/oembed");
  });

  it("youtu.be short link also takes the oEmbed path", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ title: "Some Video", author_name: "Some Channel" }));

    const res = await GET(requestFor("https://youtu.be/2QmP_adcZEY"));
    const body = await res.json();

    expect(body.title).toBe("Some Video");
    expect(String(fetchMock.mock.calls[0][0])).toContain("youtube.com/oembed");
  });

  it("falls back to the generic scrape when a YouTube URL isn't a real video (oEmbed 404s)", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("Not Found", { status: 404 })) // oEmbed fails
      .mockResolvedValueOnce(
        htmlResponse(`<head><title>Some Channel - YouTube</title><meta name="description" content="Enjoy the videos and music you love, upload original content, and share it all with friends, family, and the world on YouTube."></head>`),
      );

    const res = await GET(requestFor("https://www.youtube.com/@SomeChannel"));
    const body = await res.json();

    // Degrades to the same boilerplate every other scraper would see —
    // documented, expected fallback, not the primary fix target.
    expect(body.title).toBe("Some Channel - YouTube");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("a site with only a plain <title> and meta description (no OG tags) still works", async () => {
    fetchMock.mockResolvedValueOnce(
      htmlResponse(`<head><title>Hacker News</title><meta name="description" content="A social news website."></head>`),
    );
    const res = await GET(requestFor("https://news.ycombinator.com/"));
    const body = await res.json();
    expect(body.title).toBe("Hacker News");
    expect(body.description).toBe("A social news website.");
  });

  it("a page that stuffs a lot of script/JSON before </head> (YouTube-shaped, non-YouTube host) still finds the tags", async () => {
    const padding = "<script>" + "x".repeat(50_000) + "</script>";
    fetchMock.mockResolvedValueOnce(
      htmlResponse(`<head>${padding}<meta property="og:title" content="Deep In The Head"></head>`),
    );
    const res = await GET(requestFor("https://example.com/heavy-page"));
    const body = await res.json();
    expect(body.title).toBe("Deep In The Head");
  });

  it("falls back to og:type to guess a tag when the hostname isn't one of the hardcoded ones", async () => {
    fetchMock.mockResolvedValueOnce(
      htmlResponse(`<head><title>Some Blog Post</title><meta property="og:type" content="article"></head>`),
    );
    const res = await GET(requestFor("https://someblog.example.com/post"));
    const body = await res.json();
    expect(body.tag).toBe("Read");
  });

  it("a non-HTML response (e.g. a direct image/PDF link) returns null title/description, not an error", async () => {
    fetchMock.mockResolvedValueOnce(new Response("binary", { status: 200, headers: { "content-type": "application/pdf" } }));
    const res = await GET(requestFor("https://example.com/file.pdf"));
    const body = await res.json();
    expect(body.title).toBeNull();
    expect(body.description).toBeNull();
    expect(body.faviconUrl).toContain("example.com");
  });

  it("rejects a blocked (private/local) hostname without ever calling fetch", async () => {
    const res = await GET(requestFor("http://192.168.1.1/admin"));
    expect(res.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 422 for a missing or invalid url parameter", async () => {
    const missing = await GET(new Request("https://example.com/api/link-preview"));
    expect(missing.status).toBe(422);

    const invalid = await GET(requestFor("not a url"));
    expect(invalid.status).toBe(422);
  });

  it("surfaces a 502 when the upstream site itself errors", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Service Unavailable", { status: 503 }));
    const res = await GET(requestFor("https://example.com/down"));
    expect(res.status).toBe(502);
  });

  it("degrades gracefully (returns null fields, no throw) when oEmbed request itself throws", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network error"));
    const result = await fetchYoutubeOembed(new URL("https://www.youtube.com/watch?v=2QmP_adcZEY"));
    expect(result).toBeNull();
  });
});
