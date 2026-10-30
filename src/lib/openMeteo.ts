// Whether and how this build may call Open-Meteo. Its free API is for
// non-commercial use only (https://open-meteo.com/en/terms), and a site with
// subscriptions counts as commercial. So: the hosted site (accounts on) only
// calls it with a paid key; local-only and self-hosted installs use the free
// API.

const KEY = (import.meta.env.VITE_OPEN_METEO_API_KEY as string | undefined)?.trim() || "";
const HOSTED = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY && import.meta.env.VITE_LOCAL_ONLY !== "true";

const HOSTS = {
  forecast: { free: "https://api.open-meteo.com/v1/forecast", paid: "https://customer-api.open-meteo.com/v1/forecast" },
  "air-quality": {
    free: "https://air-quality-api.open-meteo.com/v1/air-quality",
    paid: "https://customer-air-quality-api.open-meteo.com/v1/air-quality",
  },
};

/** Whether Open-Meteo can be used here at all. */
export const openMeteoAllowed = !!KEY || !HOSTED;

/** The URL for an Open-Meteo request, or null when this build may not use it. */
export function openMeteoUrl(api: keyof typeof HOSTS, params: Record<string, string | number>): string | null {
  if (!openMeteoAllowed) return null;
  const query = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]));
  if (KEY) query.set("apikey", KEY);
  return `${KEY ? HOSTS[api].paid : HOSTS[api].free}?${query}`;
}
