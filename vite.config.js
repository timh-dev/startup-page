import path from "node:path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import localApiDevPlugin from './scripts/vite-api-dev-plugin.mjs'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  base: "https://timothypholmes.github.io/startup-page/",
  plugins: [
    react(),
    // Dev-only: lets plain `pnpm dev` exercise simple api/*.ts endpoints
    // without the Vercel CLI. Never runs during `vite build`.
    command === "serve" && localApiDevPlugin(),
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
