/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Clerk publishable key — omit entirely for local-only / self-hosted installs. */
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
  /** Remote API origin. Defaults to same-origin ("" → /api/...). */
  readonly VITE_API_URL?: string;
  /**
   * Set to "true" to force local-only mode (no auth, no cloud sync) even if
   * VITE_CLERK_PUBLISHABLE_KEY is set — lets a dev with real cloud creds
   * pulled locally still preview what a self-hosted/open-source user sees.
   */
  readonly VITE_LOCAL_ONLY?: string;
  /**
   * Open-Meteo API key (a paid plan). The free API is for non-commercial use,
   * so the hosted site (accounts and a subscription) only calls Open-Meteo
   * with one; self-hosted and local-only installs use the free API.
   */
  readonly VITE_OPEN_METEO_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
