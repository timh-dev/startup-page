// Clerk session token for calls to our own /api. Read off window.Clerk (set
// once ClerkProvider loads) so plain modules can use it without hooks.
// The last token is kept so a synchronous flush on pagehide can still send
// it (Clerk session tokens live ~60s).
let cachedToken: string | null = null;

/** A fresh session token, or null when signed out / Clerk isn't configured. */
export async function getAuthToken(): Promise<string | null> {
  try {
    const session = (window as unknown as { Clerk?: { session?: { getToken: () => Promise<string> } } }).Clerk?.session;
    if (!session) return null;
    cachedToken = await session.getToken();
    return cachedToken;
  } catch {
    return cachedToken;
  }
}

/** The most recently fetched token, without waiting on Clerk. */
export function getCachedAuthToken(): string | null {
  return cachedToken;
}
