import type { LocationId } from "./types";

// Locations with a working Topbar tab for now — the rest of LOCATIONS
// (see data/mockData.ts) still exists in the data model, it just doesn't
// get its own tab, a LocationsOverview card, or a slot in the "Dashboard"
// bundle yet. More locations land here once their own profile is ready
// to show on its own; until then, bundling them into "Dashboard" would
// silently blend in data for a location nobody can otherwise see or
// select, which is confusing rather than honest.
export const VISIBLE_LOCATION_IDS: LocationId[] = [
  "centrum",
  "almere",
  "amsterdamgenetics",
  "boerejongens",
];

/** Short tab labels for the locations above — used by both the
 * dashboard's profile tabs (Topbar) and "Alle reviews"' per-location
 * tabs, so the two stay worded the same. */
export const LOCATION_TAB_LABEL: Record<LocationId, string> = {
  centrum: "Coffeeshop BIJ",
  almere: "Boerejongens Almere",
  oost: "Sloterdijk",
  depijp: "Boerejongens West",
  // The Utrechtsestraat shop; "Centrum" as in the reply instructions, so it
  // isn't mistaken for Boerejongens Almere next to it.
  boerejongens: "Boerejongens Centrum",
  amsterdamgenetics: "Amsterdam Genetics",
};
