import path from "node:path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import localApiDevPlugin from './scripts/vite-api-dev-plugin.mjs'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  base: "https://timothypholmes.github.io/startup-page/",
  plugins: [
    react(),
    // Dev-only: lets plain `pnpm dev` exercise simple api/*.ts endpoints
    // without the Vercel CLI. Never runs during `vite build`.
    command === "serve" && localApiDevPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-icon.png", "robots.txt"],
      manifest: {
        name: "Start Page",
        short_name: "Start Page",
        description: "A personal, widget-based new tab dashboard.",
        start_url: ".",
        scope: ".",
        display: "standalone",
        theme_color: "#1d2d44",
        background_color: "#1d2d44",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        // The dashboard's own JS/CSS/icons — small and worth having ready
        // offline immediately. Bulky per-widget media (the default video
        // widget's clip, the vault page's background photo) is deliberately
        // left out of this list; runtimeCaching below picks those up the
        // first time each is actually requested instead of bloating the
        // initial install.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        globIgnores: ["**/vault-preview-bg-*.jpg", "**/desert-*.mp4"],
        navigateFallback: "index.html",
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === "image" || request.destination === "video",
            handler: "CacheFirst",
            options: {
              cacheName: "startup-page-media",
              expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
      // The dev-time SW is more trouble than it's worth here (stale-module
      // caching fights Vite's own HMR) — only production builds get one.
      devOptions: { enabled: false },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/react-router")) {
            return "vendor-react";
          }
          if (id.includes("/kbar/") || id.includes("/@headlessui/") || id.includes("/@radix-ui/")) {
            return "vendor-ui";
          }
          return undefined;
        },
      },
    },
  }
}))
