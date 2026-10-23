// @vitest-environment node
//
// This endpoint runs as a Vercel serverless function (Node/edge runtime),
// never in a browser — jsdom's fetch/Response/ReadableStream shims don't
// match production closely enough, so this file opts into the real `node`
// environment instead of the project's default jsdom one.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "./_lib/http";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("./_lib/auth.js", () => ({ getCurrentUser: authMock }));

beforeEach(() => {
  authMock.mockReset().mockResolvedValue({ id: "user-1" });
});

import { GET, suggestPlaceTag, toCandidate } from "./geocode";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function requestFor(q: string) {
  return new Request(`https://example.com/api/geocode?q=${encodeURIComponent(q)}`);
}

function nominatimResult(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    display_name: "Onibus Coffee, Nakameguro, Meguro City, Tokyo, Japan",
    lat: "35.6446",
    lon: "139.6989",
    category: "amenity",
    type: "cafe",
    osm_type: "node",
    osm_id: 12345,
    ...overrides,
  };
}

describe("suggestPlaceTag", () => {
  it("maps well-known OSM category/type pairs to their tag", () => {
    expect(suggestPlaceTag("place", "city")).toBe("City");
    expect(suggestPlaceTag("place", "town")).toBe("City");
    expect(suggestPlaceTag("amenity", "cafe")).toBe("Cafe");
    expect(suggestPlaceTag("amenity", "restaurant")).toBe("Restaurant");
    expect(suggestPlaceTag("amenity", "bar")).toBe("Bar");
    expect(suggestPlaceTag("leisure", "park")).toBe("Park");
    expect(suggestPlaceTag("natural", "water")).toBe("Lake");
    expect(suggestPlaceTag("natural", "peak")).toBe("Mountain");
    expect(suggestPlaceTag("highway", "path")).toBe("Trail");
    expect(suggestPlaceTag("route", "hiking")).toBe("Trail");
    expect(suggestPlaceTag("natural", "beach")).toBe("Beach");
    expect(suggestPlaceTag("tourism", "hotel")).toBe("Hotel");
    expect(suggestPlaceTag("shop", "supermarket")).toBe("Shop");
    expect(suggestPlaceTag("tourism", "attraction")).toBe("Landmark");
    expect(suggestPlaceTag("historic", "monument")).toBe("Landmark");
  });

  // A real-world city/town search (e.g. "Paris", "Meguro City") comes back
  // from Nominatim as an administrative boundary (category "boundary", type
  // "administrative"), not OSM's place=city/town key directly — the
  // addresstype field is what actually says "this is a city" here. Without
  // this fallback, every city search would silently tag as "Other".
  it("uses addresstype to recognize a city/town returned as an administrative boundary", () => {
    expect(suggestPlaceTag("boundary", "administrative", "city")).toBe("City");
    expect(suggestPlaceTag("boundary", "administrative", "town")).toBe("City");
    expect(suggestPlaceTag("boundary", "administrative", "village")).toBe("City");
  });

  it("falls back to 'Other' for anything unrecognized", () => {
    expect(suggestPlaceTag("boundary", "administrative")).toBe("Other");
    expect(suggestPlaceTag("boundary", "administrative", "county")).toBe("Other");
    expect(suggestPlaceTag("", "")).toBe("Other");
  });
});

describe("toCandidate", () => {
  it("maps a raw Nominatim result to a candidate, coercing lat/lon to numbers", () => {
    const candidate = toCandidate(nominatimResult());
    expect(candidate).toEqual({
      name: "Onibus Coffee",
      address: "Onibus Coffee, Nakameguro, Meguro City, Tokyo, Japan",
      lat: 35.6446,
      lng: 139.6989,
      tag: "Cafe",
      osmId: "node12345",
    });
  });

  it("falls back to the first display_name segment when name is missing", () => {
    const candidate = toCandidate(nominatimResult({ name: undefined, display_name: "Meguro City, Tokyo, Japan" }));
    expect(candidate.name).toBe("Meguro City");
  });

  it("tags a city search using addresstype", () => {
    const candidate = toCandidate(
      nominatimResult({
        name: "Paris",
        category: "boundary",
        type: "administrative",
        addresstype: "city",
      }),
    );
    expect(candidate.tag).toBe("City");
  });

  it("still works against an older Nominatim instance that sends `class` instead of `category`", () => {
    const candidate = toCandidate({ ...nominatimResult({ category: undefined }), class: "amenity" });
    expect(candidate.tag).toBe("Cafe");
  });
});

describe("GET /api/geocode", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 401 for signed-out requests without calling Nominatim", async () => {
    authMock.mockRejectedValueOnce(new HttpError(401, "Missing bearer token"));
    const res = await GET(requestFor("meguro"));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 422 when q is missing or blank", async () => {
    const missing = await GET(new Request("https://example.com/api/geocode"));
    expect(missing.status).toBe(422);

    const blank = await GET(requestFor("   "));
    expect(blank.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 422 for an unreasonably long query", async () => {
    const res = await GET(requestFor("x".repeat(500)));
    expect(res.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 502 when Nominatim responds with a non-OK status", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Service Unavailable", { status: 503 }));
    const res = await GET(requestFor("Onibus Coffee"));
    expect(res.status).toBe(502);
  });

  it("returns candidates with suggested tags on the happy path", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        nominatimResult(),
        nominatimResult({
          display_name: "Meguro City, Tokyo, Japan",
          name: "Meguro City",
          lat: "35.6333",
          lon: "139.7167",
          category: "boundary",
          type: "administrative",
          addresstype: "city",
          osm_type: "relation",
          osm_id: 6789,
        }),
      ]),
    );

    const res = await GET(requestFor("meguro"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.candidates).toHaveLength(2);
    expect(body.candidates[0]).toMatchObject({ name: "Onibus Coffee", tag: "Cafe" });
    expect(body.candidates[1]).toMatchObject({ name: "Meguro City", tag: "City" });
  });

  it("sends a descriptive, non-browser User-Agent to Nominatim", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    await GET(requestFor("meguro"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toContain("nominatim.openstreetmap.org/search");
    expect(String(calledUrl)).toContain("q=meguro");
    expect(calledInit.headers["User-Agent"]).toBeTruthy();
    expect(calledInit.headers["User-Agent"]).not.toMatch(/mozilla/i);
  });
});
