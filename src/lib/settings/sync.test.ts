// End-to-end tests for cloud sync across devices: real settings + cloudSync
// modules, an in-memory IndexedDB per device (fake-indexeddb), and a fake
// /api/settings that applies the same accept/reject rule as api/settings.ts.
//
// Tests marked `it.fails` describe how sync should behave but currently
// doesn't (the whole-object, client-clock conflict model). They pass while
// the bug exists and will start failing once it's fixed, at which point the
// marker should be removed.
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type SettingsModule = typeof import("@/lib/settings");
type CloudSyncModule = typeof import("@/lib/cloudSync");
type AuthStoresModule = typeof import("@/features/auth/stores");

// Mirrors api/settings.ts: GET 404s until something is stored; PUT is
// rejected with 409 when it carries an older client timestamp than what's
// stored, otherwise it replaces the stored settings wholesale.
class FakeCloud {
  settings: Record<string, any> | null = null;
  clientUpdatedAt = 0;
  serverUpdatedAt = 0;
  puts = 0;
  rejected = 0;

  async handle(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const method = (init.method ?? "GET").toUpperCase();
    if (!String(input).endsWith("/api/settings")) return new Response(null, { status: 404 });

    if (method === "GET") {
      if (!this.settings) return Response.json({ detail: "No settings saved yet" }, { status: 404 });
      return Response.json(this.body());
    }

    const payload = JSON.parse(String(init.body));
    const incoming = payload.client_updated_at ? Date.parse(payload.client_updated_at) : 0;
    if (this.clientUpdatedAt > 0 && incoming < this.clientUpdatedAt) {
      this.rejected += 1;
      return Response.json({ detail: "Conflict: server has newer data", ...this.body() }, { status: 409 });
    }
    this.puts += 1;
    this.settings = structuredClone(payload.settings);
    this.clientUpdatedAt = incoming;
    this.serverUpdatedAt = Date.now();
    return Response.json(this.body());
  }

  private body() {
    return {
      settings: this.settings,
      schema_version: 2,
      server_updated_at: new Date(this.serverUpdatedAt).toISOString(),
      client_updated_at: this.clientUpdatedAt ? new Date(this.clientUpdatedAt).toISOString() : null,
    };
  }
}

interface Device {
  name: string;
  idb: IDBFactory;
  storage: Record<string, string>;
  clockOffsetMs: number;
}

let cloud: FakeCloud;
let realNow: number;
let current: Device | null = null;
let settings: SettingsModule;
let cloudSync: CloudSyncModule;
let auth: AuthStoresModule;

function device(name: string, clockOffsetMs = 0): Device {
  return { name, idb: new IDBFactory(), storage: {}, clockOffsetMs };
}

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, "onLine", { value: online, configurable: true });
}

// Let queued promise callbacks, dynamic imports and IndexedDB requests run.
async function settle() {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 5));
}

/** Switch the test to `next`'s storage, clock and a fresh copy of the app modules (a page load). */
async function open(next: Device) {
  if (current) {
    const storage = window.localStorage;
    current.storage = {};
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)!;
      current.storage[key] = storage.getItem(key)!;
    }
  }
  window.localStorage.clear();
  for (const [key, value] of Object.entries(next.storage)) window.localStorage.setItem(key, value);
  Object.defineProperty(window, "indexedDB", { value: next.idb, configurable: true });
  vi.setSystemTime(realNow + next.clockOffsetMs);
  current = next;

  vi.resetModules();
  settings = await import("@/lib/settings");
  cloudSync = await import("@/lib/cloudSync");
  auth = await import("@/features/auth/stores");
  auth.useAuthStore.setState({ isSignedIn: true, isLoaded: true, subscriptionStatus: "active" });
  await settings.hydrateSettingsFromIndexedDb();
}

/** What AuthBridge does once per page load after sign-in. */
async function signIn() {
  await settings.syncSettingsFromCloud();
  await flushPush();
}

async function flushPush() {
  await settle();
  cloudSync.forcePushNow();
  await settle();
}

async function edit(change: (current: Record<string, any>) => Record<string, any>) {
  await settings.writeSettings(change(settings.readSettings()));
  await flushPush();
}

/** Move real time forward; each device's clock keeps its own offset. */
function wait(ms: number) {
  realNow += ms;
  vi.setSystemTime(realNow + (current?.clockOffsetMs ?? 0));
}

beforeEach(() => {
  cloud = new FakeCloud();
  realNow = Date.parse("2026-10-22T12:00:00.000Z");
  current = null;
  vi.useFakeTimers({ toFake: ["Date"] });
  setOnline(true);
  (window as unknown as { Clerk: unknown }).Clerk = { session: { getToken: async () => "test-token" } };
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => cloud.handle(input, init)));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("cloud sync across devices", () => {
  it("pushes the first device's settings when the cloud is empty", async () => {
    const laptop = device("laptop");
    await open(laptop);
    await edit((s) => ({ ...s, units: "metric" }));
    await signIn();

    expect(cloud.settings?.units).toBe("metric");
  });

  it("a fresh device signing in adopts the cloud copy instead of overwriting it", async () => {
    const laptop = device("laptop");
    await open(laptop);
    await signIn();
    wait(1000);
    await edit((s) => ({ ...s, units: "metric" }));
    expect(cloud.settings?.units).toBe("metric");

    wait(60_000);
    await open(device("phone"));
    await signIn();

    expect(settings.readSettings().units).toBe("metric");
    expect(cloud.settings?.units).toBe("metric");
  });

  it("merges edits to different settings made on two devices between page loads", async () => {
    const laptop = device("laptop");
    const phone = device("phone");
    await open(laptop);
    await signIn();
    await open(phone);
    await signIn();

    wait(1000);
    await open(laptop);
    await signIn();
    await edit((s) => ({ ...s, units: "metric" }));

    wait(1000);
    await open(phone);
    await signIn(); // a page load pulls and three-way merges before editing
    await edit((s) => ({ ...s, ui: { ...s.ui, themeMode: "dark" } }));

    expect(cloud.settings?.units).toBe("metric");
    expect(cloud.settings?.ui?.themeMode).toBe("dark");
  });

  it("queues an offline edit and pushes it when the connection returns", async () => {
    await open(device("laptop"));
    await signIn();

    setOnline(false);
    wait(1000);
    await edit((s) => ({ ...s, units: "metric" }));
    expect(cloud.settings?.units).not.toBe("metric");
    expect(auth.useAuthStore.getState().syncStatus).toBe("offline");

    setOnline(true);
    window.dispatchEvent(new Event("online"));
    await settle();

    expect(cloud.settings?.units).toBe("metric");
  });

  it.fails("keeps an edit made on another device since this page loaded", async () => {
    // Pushes replace the whole settings object, and a device only pulls once
    // per page load, so a long-open tab overwrites newer edits from elsewhere.
    const laptop = device("laptop");
    const phone = device("phone");
    await open(laptop);
    await signIn();
    await open(phone);
    await signIn();

    wait(1000);
    await open(laptop);
    await signIn();
    await edit((s) => ({ ...s, units: "metric" }));

    wait(1000);
    // Back to the phone tab that was already open: its state from before the
    // laptop's edit, and no pull (that only happens on page load).
    await open(phone);
    await edit((s) => ({ ...s, ui: { ...s.ui, themeMode: "dark" } }));

    expect(cloud.settings?.ui?.themeMode).toBe("dark");
    expect(cloud.settings?.units).toBe("metric");
  });

  it.fails("keeps edits to different items in the same list", async () => {
    // The merge is per top-level key, so two devices editing different vault
    // items is a conflict on `vaultItems` and the older side's edit is lost.
    const laptop = device("laptop");
    const phone = device("phone");
    await open(laptop);
    await edit((s) => ({
      ...s,
      vaultItems: [
        { id: "a", kind: "code", title: "A" },
        { id: "b", kind: "code", title: "B" },
      ],
    }));
    await signIn();
    await open(phone);
    await signIn();

    wait(1000);
    await open(laptop);
    await signIn();
    await edit((s) => ({ ...s, vaultItems: s.vaultItems.map((i: any) => (i.id === "a" ? { ...i, title: "A2" } : i)) }));

    wait(1000);
    await open(phone); // still-open tab, no pull
    await edit((s) => ({ ...s, vaultItems: s.vaultItems.map((i: any) => (i.id === "b" ? { ...i, title: "B2" } : i)) }));

    const titles = (cloud.settings?.vaultItems ?? []).map((i: any) => i.title).sort();
    expect(titles).toEqual(["A2", "B2"]);
  });

  it.fails("accepts edits from a device whose clock is behind", async () => {
    // The server orders pushes by the client's own clock, so a device running
    // an hour slow has every push rejected (409) after a correct-clock device
    // has pushed, and nothing retries.
    const laptop = device("laptop");
    const slowPhone = device("phone", -60 * 60 * 1000);
    await open(laptop);
    await signIn();
    await open(slowPhone);
    await signIn();

    wait(1000);
    await open(laptop);
    await signIn();
    await edit((s) => ({ ...s, units: "metric" }));

    wait(5 * 60 * 1000);
    await open(slowPhone);
    await signIn();
    await edit((s) => ({ ...s, ui: { ...s.ui, themeMode: "dark" } }));

    expect(cloud.rejected).toBe(0);
    expect(cloud.settings?.ui?.themeMode).toBe("dark");
  });

  it.fails("recovers from a rejected push instead of stopping at an error", async () => {
    // A 409 sets the status to "error" and drops the push; the edit only
    // reaches the cloud if the user reloads.
    const laptop = device("laptop");
    const phone = device("phone");
    await open(laptop);
    await signIn();
    await open(phone);
    await signIn();

    // The phone's clock runs ahead, so its push carries a "newer" timestamp…
    wait(1000);
    phone.clockOffsetMs = 10 * 60 * 1000;
    await open(phone);
    await edit((s) => ({ ...s, units: "metric" }));

    // …then the laptop tab (still open, no pull) edits and gets a 409.
    wait(1000);
    await open(laptop);
    await edit((s) => ({ ...s, ui: { ...s.ui, themeMode: "dark" } }));
    expect(cloud.rejected).toBe(1);

    expect(auth.useAuthStore.getState().syncStatus).not.toBe("error");
    expect(cloud.settings?.ui?.themeMode).toBe("dark");
  });
});
