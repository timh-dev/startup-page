import { StrictMode, lazy, Suspense, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import "@fontsource-variable/inter/opsz.css";
import "@fontsource-variable/playfair-display/wght.css";
import "@fontsource-variable/playfair-display/wght-italic.css";
import "@fontsource-variable/jetbrains-mono/wght.css";
import "@/assets/styles/index.css";
import { hydrateSettingsFromIndexedDb } from "@/lib/settings";
import { useSettingsStore } from "@/features/settings/stores";
import { ClerkErrorBoundary, ClerkUnavailableProvider } from "@/features/auth/ClerkStatus";
import { clerkAppearance } from "@/features/auth/clerkAppearance";

import AppLayout from "@/components/layout/AppLayout";

// Secondary routes are split out of the first-paint bundle — they load on
// navigation, so the dashboard shell isn't blocked downloading their code.
const BookmarksPage = lazy(() => import("@/pages/BookmarksPage"));
const ResourceVaultPage = lazy(() => import("@/pages/ResourceVaultPage"));
// Dev tools for checking weather scenes and the day bar; left out of production builds.
const WeatherPreviewPage = import.meta.env.DEV ? lazy(() => import("@/pages/WeatherPreview")) : null;
const DayBarPreviewPage = import.meta.env.DEV ? lazy(() => import("@/pages/DayBarPreview")) : null;

const LOCAL_ONLY = import.meta.env.VITE_LOCAL_ONLY === "true";
// Forcing local-only ignores a real key so a dev with cloud creds pulled into
// .env.local can still preview what a self-hosted/open-source user sees.
const CLERK_KEY = LOCAL_ONLY ? undefined : (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined);

const rootLookup = document.getElementById("root");
if (!rootLookup) throw new Error("Root element was not found.");
const rootElement: HTMLElement = rootLookup;

const routes = (
  <HashRouter>
    <Suspense fallback={null}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" />
          <Route path="/bookmarks" element={<BookmarksPage />} />
          <Route path="/resources" element={<ResourceVaultPage />} />
        </Route>
        {WeatherPreviewPage && <Route path="/weather-preview" element={<WeatherPreviewPage />} />}
        {DayBarPreviewPage && <Route path="/day-bar-preview" element={<DayBarPreviewPage />} />}
        {/* Unknown links (including the preview in production) go home. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  </HashRouter>
);

async function render() {
  let content: ReactNode;
  if (CLERK_KEY) {
    // Dynamic import keeps Clerk out of the initial bundle for self-hosted installs
    const { ClerkProvider } = await import("@clerk/clerk-react");
    content = (
      // ClerkErrorBoundary catches invalid keys, network failures, or any other
      // Clerk init error and falls back to local-only mode automatically.
      <ClerkErrorBoundary fallback={<ClerkUnavailableProvider>{routes}</ClerkUnavailableProvider>}>
        <ClerkProvider
          publishableKey={CLERK_KEY}
          afterSignInUrl="/#/"
          afterSignUpUrl="/#/"
          appearance={clerkAppearance}
        >
          {routes}
        </ClerkProvider>
      </ClerkErrorBoundary>
    );
  } else {
    content = <ClerkUnavailableProvider>{routes}</ClerkUnavailableProvider>;
  }
  createRoot(rootElement).render(<StrictMode>{content}</StrictMode>);
}

void render();

// Sync from IndexedDB in the background (more reliable than localStorage for large settings).
void hydrateSettingsFromIndexedDb().then(() => {
  useSettingsStore.getState().reloadSettings();
});
