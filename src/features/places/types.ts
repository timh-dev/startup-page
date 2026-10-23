export type PlaceTag =
  | "City"
  | "Cafe"
  | "Restaurant"
  | "Bar"
  | "Park"
  | "Lake"
  | "Mountain"
  | "Trail"
  | "Beach"
  | "Hotel"
  | "Shop"
  | "Landmark"
  | "Other";

export interface Place {
  id: string;
  name: string;
  tag: PlaceTag;
  notes: string;
  address: string;
  lat: number;
  lng: number;
  source: "search" | "manual";
  osmId: string | null;
  createdAt: string;
  updatedAt: string;
}

// Deliberately no boundary/path field yet — park outlines and trail routes
// are a later phase once pin-based places work end-to-end.

export interface PlaceCandidate {
  name: string;
  address: string;
  lat: number;
  lng: number;
  tag: string;
  osmId: string;
}
