import path from "node:path";
import fs from "node:fs";

// Runs api/*.ts Vercel-style handlers (exported GET/POST/etc, Web
// Request/Response signature — see api/health.ts) directly inside the Vite
// dev server, so `pnpm dev` can exercise simple auth-free endpoints (like
// /api/link-preview) without needing the Vercel CLI. Routes that depend on
// env vars (DATABASE_URL, Clerk, Stripe) still need `make dev-cloud`
// (vercel dev) — this only replicates filesystem routing + request/response
// plumbing, not Vercel's actual runtime/env injection.
//
// Registered directly in configureServer (not via a returned callback) so it
// runs BEFORE Vite's own middleware — otherwise Vite's base-path checker
// intercepts unmatched /api/* requests first and returns its "did you mean"
// 404 hint instead of ever reaching this handler.
export default function localApiDevPlugin() {
  const apiDir = path.resolve(process.cwd(), "api");

  return {
    name: "local-api-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith("/api/")) {
          next();
          return;
        }

        const [pathname, search] = req.url.split("?");
        const routePath = pathname.replace(/^\/api\//, "").replace(/\/$/, "");
        const modulePath = path.join(apiDir, `${routePath}.ts`);

        if (!routePath || !fs.existsSync(modulePath)) {
          next();
          return;
        }

        try {
          const mod = await server.ssrLoadModule(modulePath);
          const method = (req.method || "GET").toUpperCase();
          const handler = mod[method];

          if (typeof handler !== "function") {
            res.statusCode = 405;
            res.end("Method not allowed");
            return;
          }

          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === "string") headers.set(key, value);
            else if (Array.isArray(value)) headers.set(key, value.join(", "));
          }

          let body;
          if (method !== "GET" && method !== "HEAD") {
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            body = Buffer.concat(chunks);
          }

          const url = new URL(`${pathname}${search ? `?${search}` : ""}`, `http://${req.headers.host || "localhost"}`);
          const request = new Request(url, { method, headers, body });
          const response = await handler(request);

          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (error) {
          console.error(`[api dev] /api/${routePath} failed:`, error);
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ detail: "Internal server error (local api dev plugin)" }));
        }
      });
    },
  };
}
