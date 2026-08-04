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
