// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { batchMock } = vi.hoisted(() => ({ batchMock: vi.fn() }));
vi.mock("./_lib/auth.js", () => ({
  getCurrentUser: vi.fn(async () => ({ id: "user-1" })),
  requireSyncAccess: vi.fn(),
}));
vi.mock("./_lib/db.js", () => ({ getDb: () => ({ batch: batchMock }) }));

import { PUT } from "./settings";

function put(body: unknown) {
  return PUT(new Request("https://example.com/api/settings", { method: "PUT", body: typeof body === "string" ? body : JSON.stringify(body) }));
}

beforeEach(() => batchMock.mockReset());

describe("PUT /api/settings", () => {
  it("refuses whole-settings pushes from clients older than versioned sync", async () => {
    const res = await put({ settings: { units: "metric" }, client_updated_at: "2026-10-22T00:00:00.000Z" });
    expect(res.status).toBe(426);
    expect(batchMock).not.toHaveBeenCalled();
  });

  it("rejects malformed domain data", async () => {
    const res = await put({ domains: { bookmarks: { data: "nope", base_version: 1 } } });
    expect(res.status).toBe(422);
    expect((await res.json()).detail).toContain("domains.bookmarks.data");
  });

  it("rejects bodies over the size cap", async () => {
    const res = await put("x".repeat(2 * 1024 * 1024 + 1));
    expect(res.status).toBe(413);
  });

  it("does nothing for an empty change set", async () => {
    const res = await put({ domains: {} });
    expect(await res.json()).toEqual({ domains: {} });
    expect(batchMock).not.toHaveBeenCalled();
  });
});
