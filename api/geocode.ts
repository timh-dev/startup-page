import { json, errorResponse, HttpError } from "./_lib/http.js";
import { getCurrentUser } from "./_lib/auth.js";

const FETCH_TIMEOUT_MS = 6000;
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const MAX_QUERY_LENGTH = 200;

// Nominatim's usage policy requires a descriptive, non-browser User-Agent
// identifying the calling application — kept generic/non-personal rather
// than naming a specific person, since this header is sent to a third-party
// service on every request.
const USER_AGENT = "StartupPagePersonalDashboard/1.0";

// Best-effort mapping from a Nominatim result's OSM class/type to one of the
// vault's fixed place tags (kept as plain string literals here, not shared
// with src/features/places/constants.ts — same reasoning as suggestTag in
// link-preview.ts: the api/ functions are a separate serverless bundle and
// don't share a build with src/). Order matters: first match wins.
const OSM_CLASS_TYPE_RULES: Array<{ tag: string; test: (klass: string, type: string) => boolean }> = [
  { tag: "City", test: (k, t) => k === "place" && ["city", "town", "village", "hamlet"].includes(t) },
  { tag: "Cafe", test: (k, t) => k === "amenity" && t === "cafe" },
  { tag: "Restaurant", test: (k, t) => k === "amenity" && ["restaurant", "fast_food"].includes(t) },
  { tag: "Bar", test: (k, t) => k === "amenity" && ["bar", "pub", "nightclub"].includes(t) },
  { tag: "Park", test: (k, t) => k === "leisure" && ["park", "garden", "nature_reserve"].includes(t) },
  { tag: "Lake", test: (k, t) => k === "natural" && ["water", "bay"].includes(t) },
  { tag: "Mountain", test: (k, t) => k === "natural" && ["peak", "volcano", "ridge"].includes(t) },
  {
    tag: "Trail",
    test: (k, t) => (k === "highway" && ["path", "footway", "track"].includes(t)) || (k === "route" && t === "hiking"),
  },
  { tag: "Beach", test: (k, t) => k === "natural" && t === "beach" },
  { tag: "Hotel", test: (k, t) => k === "tourism" && ["hotel", "hostel", "guest_house"].includes(t) },
  { tag: "Shop", test: (k) => k === "shop" },
  {
    tag: "Landmark",
    test: (k, t) => (k === "tourism" && ["attraction", "museum", "viewpoint"].includes(t)) || k === "historic",
  },
];

// A city/town/village is usually returned as an administrative boundary
// (category "boundary", type "administrative") rather than tagged with the
// OSM place=city/town/village key directly — Nominatim exposes what kind of
// place it actually is via the separate `addresstype` field instead, so
// that's checked as a fallback after the class/type rules above.
const ADDRESS_TYPE_CITY_VALUES = ["city", "town", "village", "hamlet", "suburb"];

export function suggestPlaceTag(osmCategory: string, osmType: string, addressType?: string): string {
  for (const rule of OSM_CLASS_TYPE_RULES) {
    if (rule.test(osmCategory, osmType)) {
      return rule.tag;
    }
  }
  if (addressType && ADDRESS_TYPE_CITY_VALUES.includes(addressType)) {
    return "City";
  }
  return "Other";
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  // Nominatim's jsonv2 format names this field `category` (older docs/versions
  // call it `class`) — both are accepted since a self-hosted instance on an
  // older Nominatim version may still send `class`.
  category?: string;
  class?: string;
  type: string;
  addresstype?: string;
  osm_type: string;
  osm_id: number;
  name?: string;
}

export interface GeocodeCandidate {
  name: string;
  address: string;
  lat: number;
  lng: number;
  tag: string;
  osmId: string;
}

export function toCandidate(result: NominatimResult): GeocodeCandidate {
  return {
    name: result.name || result.display_name.split(",")[0].trim(),
    address: result.display_name,
    lat: Number(result.lat),
    lng: Number(result.lon),
    tag: suggestPlaceTag(result.category ?? result.class ?? "", result.type, result.addresstype),
    osmId: `${result.osm_type}${result.osm_id}`,
  };
}

export async function GET(request: Request): Promise<Response> {
  try {
    // Signed-in users only, so this can't be used to send anonymous
    // traffic to Nominatim under our User-Agent.
    await getCurrentUser(request);

    const q = new URL(request.url).searchParams.get("q")?.trim();
    if (!q) {
      throw new HttpError(422, "Missing q parameter");
    }
    if (q.length > MAX_QUERY_LENGTH) {
      throw new HttpError(422, "Query too long");
    }

    const url = new URL(NOMINATIM_URL);
    url.searchParams.set("q", q);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("extratags", "1");
    url.searchParams.set("limit", "5");

    const response = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new HttpError(502, `Upstream responded with ${response.status}`);
    }

    const results = (await response.json()) as NominatimResult[];
    return json({ candidates: results.map(toCandidate) });
  } catch (err) {
    return errorResponse(err);
  }
}
