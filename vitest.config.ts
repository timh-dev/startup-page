import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Deliberately separate from vite.config.js: that config's PWA plugin, GitHub
// Pages `base`, and dev-only API plugin are build/serve concerns the test
// runner doesn't need, so this stays a minimal config with just the alias
// and JSX transform tests actually rely on.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    css: false,
    // Pins date/timezone-sensitive tests (formatItemDate, groupLabelFor, ...)
    // to a fixed offset so they don't flake based on the machine running them.
    env: { TZ: "UTC" },
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.d.ts",
        "src/app/**",
        "src/assets/**",
      ],
    },
  },
});
