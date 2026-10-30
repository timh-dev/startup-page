// End-to-end tests for cloud sync across devices: the real settings and
// cloudSync modules, an in-memory IndexedDB per device (fake-indexeddb), and
// a fake /api/settings that applies the same per-domain version rule as
// api/settings.ts (a write applies only if its base version is current).
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SETTINGS_DOMAIN_IDS, sliceSettings, type SettingsDomainId } from "../../../shared/settingsDomains";

type SettingsModule = typeof import("@/lib/settings");
type CloudSyncModule = typeof import("@/lib/cloudSync");
type AuthStoresModule = typeof import("@/features/auth/stores");

interface Stored {
  data: unknown;
  version: number;
}

class FakeCloud {
  domains: Partial<Record<SettingsDomainId, Stored>> = {};
  puts = 0;
  conflicts = 0;
  /** Runs while a PUT is being handled, to simulate something happening mid-sync. */
  duringPut: (() => Promise<void>) | null = null;

  async handle(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    if (!String(input).endsWith("/api/settings")) return new Response(null, { status: 404 });
    const method = (init.method ?? "GET").toUpperCase();
    if (method === "GET") return Response.json({ domains: structuredClone(this.domains) });

    this.puts += 1;
    const hook = this.duringPut;
    this.duringPut = null;
    if (hook) await hook();

    const { domains } = JSON.parse(String(init.body));
    const results: Record<string, unknown> = {};
    for (const [id, change] of Object.entries(domains as Record<SettingsDomainId, { data: unknown; base_version: number }>)) {
      const stored = this.domains[id as SettingsDomainId];
      if ((stored?.version ?? 0) === change.base_version) {
        const version = (stored?.version ?? 0) + 1;
        this.domains[id as SettingsDomainId] = { data: structuredClone(change.data), version };
        results[id] = { status: "ok", version };
      } else {
        this.conflicts += 1;
        results[id] = { status: "conflict", ...structuredClone(stored!) };
      }
    }
    return Response.json({ domains: results });
  }

  data(id: SettingsDomainId): any {
    return this.domains[id]?.data;
  }
}

interface Device {
  idb: IDBFactory;
  storage: Record<string, string>;
  clockOffsetMs: number;
}

let cloud: FakeCloud;
let realNow: number;
let current: Device | null = null;
let stopBackgroundSync: (() => void) | null = null;
let settings: SettingsModule;
let cloudSync: CloudSyncModule;
let auth: AuthStoresModule;

function device(clockOffsetMs = 0): Device {
  return { idb: new IDBFactory(), storage: {}, clockOffsetMs };
}

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, "onLine", { value: online, configurable: true });
}

// Let queued promise callbacks, dynamic imports and IndexedDB requests run.
async function settle() {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 5));
}

/**
 * Switches to `next`'s storage and clock with a fresh copy of the app
 * modules: a page load, or returning to a tab that was already open (its
 * state is just what it saved, since nothing else touched it).
 */
async function open(next: Device) {
  stopBackgroundSync?.();
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
  stopBackgroundSync = cloudSync.startBackgroundSync();
}

/** A page load with sync: what AuthBridge does after sign-in. */
async function load(next: Device) {
  await open(next);
  await cloudSync.syncNow();
}

async function edit(change: (current: Record<string, any>) => Record<string, any>) {
  await settings.writeSettings(change(settings.readSettings()));
  await settle();
  await cloudSync.forceSyncNow();
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
  stopBackgroundSync?.();
  stopBackgroundSync = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("cloud sync across devices", () => {
  it("pushes the first device's changes when the cloud is empty", async () => {
    await load(device());
    await edit((s) => ({ ...s, units: "metric" }));

    expect(cloud.data("preferences").units).toBe("metric");
    expect(auth.useAuthStore.getState().syncStatus).toBe("synced");
  });

  it("doesn't push an untouched device's defaults", async () => {
    await load(device());
    expect(cloud.puts).toBe(0);
  });

  it("a fresh device adopts the cloud copy instead of overwriting it", async () => {
    await load(device());
    await edit((s) => ({ ...s, units: "metric" }));

    wait(60_000);
    await load(device());

    expect(settings.readSettings().units).toBe("metric");
    expect(cloud.data("preferences").units).toBe("metric");
  });

  it("merges edits to different settings made on two devices", async () => {
    const laptop = device();
    const phone = device();
    await load(laptop);
    await load(phone);

    await load(laptop);
    await edit((s) => ({ ...s, units: "metric" }));
    await load(phone);
    await edit((s) => ({ ...s, ui: { ...s.ui, themeMode: "dark" } }));

    expect(cloud.data("preferences")).toMatchObject({ units: "metric", ui: { themeMode: "dark" } });
    await load(laptop);
    expect(settings.readSettings()).toMatchObject({ units: "metric", ui: { themeMode: "dark" } });
  });

  it("keeps an edit made on another device since a tab was opened", async () => {
    const laptop = device();
    const phone = device();
    await load(laptop);
    await load(phone);

    await load(laptop);
    await edit((s) => ({ ...s, units: "metric" }));

    // Back to the phone tab that was already open: it hasn't seen the edit.
    await open(phone);
    await edit((s) => ({ ...s, ui: { ...s.ui, themeMode: "dark" } }));

    expect(cloud.data("preferences")).toMatchObject({ units: "metric", ui: { themeMode: "dark" } });
    expect(settings.readSettings()).toMatchObject({ units: "metric", ui: { themeMode: "dark" } });
    expect(auth.useAuthStore.getState().syncStatus).toBe("synced");
  });

  it("recovers from a push rejected because another device wrote first", async () => {
    await load(device());
    await edit((s) => ({ ...s, news: { ...s.news, rotationSeconds: 9 } }));

    // The phone pushes while the laptop's sync is between its pull and push.
    cloud.duringPut = async () => {
      const preferences = cloud.domains.preferences!;
      cloud.domains.preferences = { data: { ...(preferences.data as object), units: "metric" }, version: preferences.version + 1 };
    };
    await edit((s) => ({ ...s, ui: { ...s.ui, themeMode: "dark" } }));

    expect(cloud.conflicts).toBe(1);
    expect(cloud.data("preferences")).toMatchObject({ units: "metric", ui: { themeMode: "dark" } });
    expect(settings.readSettings().units).toBe("metric");
    expect(auth.useAuthStore.getState().syncStatus).toBe("synced");
  });

  it("keeps edits to different items in the same list", async () => {
    const laptop = device();
    const phone = device();
    await load(laptop);
    await edit((s) => ({
      ...s,
      vaultItems: [
        { id: "a", kind: "code", title: "A" },
        { id: "b", kind: "code", title: "B" },
      ],
    }));
    await load(phone);

    await load(laptop);
    await edit((s) => ({ ...s, vaultItems: s.vaultItems.map((i: any) => (i.id === "a" ? { ...i, title: "A2" } : i)) }));
    await open(phone);
    await edit((s) => ({ ...s, vaultItems: s.vaultItems.map((i: any) => (i.id === "b" ? { ...i, title: "B2" } : i)) }));

    expect(cloud.data("vaultItems").map((i: any) => i.title)).toEqual(["A2", "B2"]);
  });

  it("keeps items added on two devices at once", async () => {
    const laptop = device();
    const phone = device();
    await load(laptop);
    await load(phone);

    await load(laptop);
    await edit((s) => ({ ...s, readItems: [{ id: "from-laptop", title: "Laptop link", url: "https://a" }, ...s.readItems] }));
    await open(phone);
    await edit((s) => ({ ...s, readItems: [{ id: "from-phone", title: "Phone link", url: "https://b" }, ...s.readItems] }));

    expect(cloud.data("readItems").map((i: any) => i.id).sort()).toEqual(["from-laptop", "from-phone"]);
  });

  it("accepts edits from a device whose clock is behind", async () => {
    const laptop = device();
    const slowPhone = device(-60 * 60 * 1000);
    await load(laptop);
    await load(slowPhone);

    await load(laptop);
    await edit((s) => ({ ...s, units: "metric" }));
    wait(5 * 60 * 1000);
    await load(slowPhone);
    await edit((s) => ({ ...s, ui: { ...s.ui, themeMode: "dark" } }));

    expect(cloud.data("preferences")).toMatchObject({ units: "metric", ui: { themeMode: "dark" } });
  });

  it("queues an offline edit and pushes it when the connection returns", async () => {
    await load(device());

    setOnline(false);
    await edit((s) => ({ ...s, units: "metric" }));
    expect(cloud.data("preferences")?.units).not.toBe("metric");
    expect(auth.useAuthStore.getState().syncStatus).toBe("offline");

    setOnline(true);
    window.dispatchEvent(new Event("online"));
    await settle();

    expect(cloud.data("preferences").units).toBe("metric");
  });

  it("keeps an edit made while a sync is in flight, and pushes it next", async () => {
    const laptop = device();
    const phone = device();
    await load(laptop);
    await load(phone);
    await load(laptop);
    await edit((s) => ({ ...s, units: "metric" }));

    await open(phone);
    cloud.duringPut = async () => {
      await settings.saveSettingsLocally({ ...settings.readSettings(), news: { subreddit: "space" } });
    };
    await edit((s) => ({ ...s, ui: { ...s.ui, themeMode: "dark" } }));
    await cloudSync.syncNow();

    const expected = { units: "metric", ui: { themeMode: "dark" }, news: { subreddit: "space" } };
    expect(settings.readSettings()).toMatchObject(expected);
    expect(cloud.data("preferences")).toMatchObject(expected);
  });

  it("merges against a snapshot saved before versioned sync instead of overwriting", async () => {
    await open(device());
    // State left by the previous sync design: a whole-settings snapshot, and
    // cloud rows at version 1 (what the migration gives existing rows).
    const base = settings.readSettings();
    await settings.writeSyncSnapshot({ schemaVersion: 2, updatedAt: "2026-10-01T00:00:00.000Z", settings: base });
    for (const [id, data] of Object.entries(sliceSettings(base))) {
      cloud.domains[id as SettingsDomainId] = { data: structuredClone(data), version: 1 };
    }
    // Another device changed units after this one last synced.
    cloud.domains.preferences = { data: { ...(cloud.data("preferences") as object), units: "metric" }, version: 2 };

    await settings.saveSettingsLocally({ ...base, ui: { ...base.ui, themeMode: "dark" } });
    await cloudSync.syncNow();

    expect(cloud.data("preferences")).toMatchObject({ units: "metric", ui: { themeMode: "dark" } });
    expect(SETTINGS_DOMAIN_IDS.filter((id) => (cloud.domains[id]?.version ?? 0) > 1)).toEqual(["preferences"]);
  });

  it("tells subscribers when a sync changes local settings", async () => {
    await load(device());
    await edit((s) => ({ ...s, units: "metric" }));

    await open(device());
    const seen: unknown[] = [];
    cloudSync.subscribeToRemoteChanges((next) => seen.push(next.units));
    await cloudSync.syncNow();

    expect(seen).toEqual(["metric"]);
  });
});
