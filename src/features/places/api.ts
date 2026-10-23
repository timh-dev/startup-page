import type { PlaceCandidate } from "./types";
import { getAuthToken } from "@/lib/authToken";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

// Silently degrades to no results on any failure (network error, 404
// because this deployment has no /api at all, timeout, etc.) — search is a
// convenience, never a requirement, so the user can always fall back to
// entering a place manually. Same convention as VaultGlassView's
// maybeFetchLinkPreview.
export async function searchPlaces(query: string): Promise<PlaceCandidate[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  // Search needs a signed-in user; signed out, places are entered by hand.
  const token = await getAuthToken();
  if (!token) {
    return [];
  }

  try {
    const response = await fetch(`${API_URL}/api/geocode?q=${encodeURIComponent(trimmed)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    return Array.isArray(data.candidates) ? data.candidates : [];
  } catch (_error) {
    return [];
  }
}
