import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { HttpError } from "./http.js";

// Outbound fetches to user-supplied URLs (link previews) must not reach
// internal infrastructure. Checking the hostname string alone isn't enough:
// a public name can resolve to a private address, and a public page can
// redirect to one. So every hop's hostname is resolved and each resulting
// address is checked, and redirects are followed by hand so each hop gets
// the same check. A DNS-rebinding race (resolving differently between our
// lookup and fetch's own) is still possible; closing it needs a pinned-IP
// dispatcher, which is more than a personal link-preview warrants.

const MAX_REDIRECTS = 5;

function ipv4ToInt(address: string): number {
  return address.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

const PRIVATE_IPV4_RANGES: Array<[string, number]> = [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local, incl. cloud metadata 169.254.169.254
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15], // benchmarking
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + broadcast
];

function isPrivateIpv4(address: string): boolean {
  const value = ipv4ToInt(address);
  return PRIVATE_IPV4_RANGES.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (value & mask) === (ipv4ToInt(base) & mask);
  });
}

function isPrivateIpv6(address: string): boolean {
  const lower = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (lower === "::" || lower === "::1") return true;
  // IPv4-mapped (::ffff:10.0.0.1) — judge by the embedded IPv4 address.
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIpv4(mapped[1]);
  return (
    /^f[cd]/.test(lower) || // unique local fc00::/7
    /^fe[89ab]/.test(lower) || // link-local fe80::/10
    /^ff/.test(lower) // multicast
  );
}

/** True for loopback, private, link-local, CGNAT, multicast and other non-public addresses. */
export function isPrivateAddress(address: string): boolean {
  const version = isIP(address.replace(/^\[|\]$/g, ""));
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true; // not an IP at all — treat as unsafe
}

async function assertPublicHost(hostname: string): Promise<void> {
  const bare = hostname.replace(/^\[|\]$/g, "");
  if (/^localhost$/i.test(bare) || /\.localhost$/i.test(bare)) {
    throw new HttpError(422, "That host can't be previewed");
  }

  let addresses: string[];
  if (isIP(bare)) {
    addresses = [bare];
  } else {
    try {
      addresses = (await lookup(bare, { all: true, verbatim: true })).map((entry) => entry.address);
    } catch {
      throw new HttpError(502, "Couldn't resolve that host");
    }
  }

  if (!addresses.length || addresses.some(isPrivateAddress)) {
    throw new HttpError(422, "That host can't be previewed");
  }
}

/**
 * fetch() for an untrusted http(s) URL: refuses hosts that resolve to
 * non-public addresses, on the first request and on every redirect hop.
 */
export async function safeFetch(rawUrl: string | URL, init: RequestInit = {}): Promise<Response> {
  let current = new URL(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (current.protocol !== "http:" && current.protocol !== "https:") {
      throw new HttpError(422, "Only http/https URLs are supported");
    }
    await assertPublicHost(current.hostname);

    const response = await fetch(current, { ...init, redirect: "manual" });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      response.body?.cancel().catch(() => {});
      current = new URL(location, current);
      continue;
    }
    return response;
  }

  throw new HttpError(502, "Too many redirects");
}
