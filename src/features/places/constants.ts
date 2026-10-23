import {
  HiOutlineBuildingOffice2,
  HiOutlineBuildingStorefront,
  HiOutlineCake,
  HiOutlineCamera,
  HiOutlineHomeModern,
  HiOutlineMapPin,
  HiOutlineMoon,
  HiOutlineShoppingBag,
  HiOutlineSun,
} from "react-icons/hi2";
import type { PlaceTag } from "./types";

export const PLACE_TAGS: PlaceTag[] = [
  "City",
  "Cafe",
  "Restaurant",
  "Bar",
  "Park",
  "Lake",
  "Mountain",
  "Trail",
  "Beach",
  "Hotel",
  "Shop",
  "Landmark",
  "Other",
];

// Same generic `--read-tag-color` mechanism as READ_TAG_COLORS/CODE_LANGUAGE_COLORS
// (see src/assets/styles/index.css) — new place-tag-* classes, not a new color system.
export const PLACE_TAG_COLORS: Record<string, string> = {
  City: "place-tag-city",
  Cafe: "place-tag-cafe",
  Restaurant: "place-tag-restaurant",
  Bar: "place-tag-bar",
  Park: "place-tag-park",
  Lake: "place-tag-lake",
  Mountain: "place-tag-mountain",
  Trail: "place-tag-trail",
  Beach: "place-tag-beach",
  Hotel: "place-tag-hotel",
  Shop: "place-tag-shop",
  Landmark: "place-tag-landmark",
  Other: "place-tag-other",
};

// react-icons/hi2 has no dedicated lake/mountain/trail icon — those fall
// back to the generic pin rather than importing something that doesn't fit.
export const PLACE_TAG_ICONS: Record<string, typeof HiOutlineMapPin> = {
  City: HiOutlineBuildingOffice2,
  Cafe: HiOutlineCake,
  Restaurant: HiOutlineBuildingStorefront,
  Bar: HiOutlineMoon,
  Park: HiOutlineSun,
  Lake: HiOutlineMapPin,
  Mountain: HiOutlineMapPin,
  Trail: HiOutlineMapPin,
  Beach: HiOutlineSun,
  Hotel: HiOutlineHomeModern,
  Shop: HiOutlineShoppingBag,
  Landmark: HiOutlineCamera,
  Other: HiOutlineMapPin,
};

// Hex values backing each .place-tag-* CSS class's --read-tag-color — used
// directly (not via CSS class lookup) for the Leaflet divIcon markers, which
// render outside the app's normal DOM/stylesheet cascade.
export const PLACE_TAG_HEX: Record<string, string> = {
  City: "#64748b",
  Cafe: "#b45309",
  Restaurant: "#dc2626",
  Bar: "#a855f7",
  Park: "#16a34a",
  Lake: "#0891b2",
  Mountain: "#78716c",
  Trail: "#65a30d",
  Beach: "#eab308",
  Hotel: "#6366f1",
  Shop: "#ec4899",
  Landmark: "#f97316",
  Other: "#94a3b8",
};
