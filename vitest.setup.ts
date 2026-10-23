import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement matchMedia or crypto.randomUUID; several modules
// under test (theme detection, id generation) call them directly.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;
}

if (typeof crypto !== "undefined" && typeof crypto.randomUUID !== "function") {
  // @ts-expect-error -- polyfilling a missing method on the real crypto object
  crypto.randomUUID = () => `test-uuid-${Math.random().toString(36).slice(2)}`;
}

// Node 22+ defines its own global `localStorage` (undefined unless started
// with --localstorage-file), which stops jsdom's from being installed. Give
// tests a working in-memory one.
if (typeof window !== "undefined" && !window.localStorage) {
  class MemoryStorage implements Storage {
    private items = new Map<string, string>();
    get length() {
      return this.items.size;
    }
    clear() {
      this.items.clear();
    }
    getItem(key: string) {
      return this.items.get(key) ?? null;
    }
    key(index: number) {
      return [...this.items.keys()][index] ?? null;
    }
    removeItem(key: string) {
      this.items.delete(key);
    }
    setItem(key: string, value: string) {
      this.items.set(key, String(value));
    }
  }
  Object.defineProperty(window, "localStorage", { value: new MemoryStorage(), configurable: true });
  Object.defineProperty(window, "sessionStorage", { value: new MemoryStorage(), configurable: true });
}
