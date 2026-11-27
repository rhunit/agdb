import type { LocationId } from "./types";

// Locations with a working Topbar tab for now — the rest of LOCATIONS
// (see data/mockData.ts) still exists in the data model, it just doesn't
// get its own tab, a LocationsOverview card, or a slot in the "Dashboard"
// bundle yet. More locations land here once their own profile is ready
// to show on its own; until then, bundling them into "Dashboard" would
// silently blend in data for a location nobody can otherwise see or
// select, which is confusing rather than honest.
export const VISIBLE_LOCATION_IDS: LocationId[] = [
  "boerejongens",
  "almere",
  "west",
  "centrum",
  "sloterdijk",
  "amsterdamgenetics",
];

/** Locations without access to their Google Business Profile: a tab on
 * the dashboard with only public Google Maps data (score, review count, a
 * few reviews Google picks), marked with a red asterisk. Kept out of
 * VISIBLE_LOCATION_IDS on purpose — there they'd count as zero reviews in
 * the totals, Alle reviews, Rapportage and the weekly mail. */
// Empty since Boerejongens West's profile is connected (November 2026); the
// mechanism stays for a future location without profile access.
export const PUBLIC_ONLY_LOCATION_IDS: LocationId[] = [];

/** The location tabs in order (Dashboard and Alle reviews): Boerejongens
 * West (public data only) next to the other Boerejongens shops, after Almere. */
export const TAB_LOCATION_IDS: LocationId[] = VISIBLE_LOCATION_IDS.flatMap((id) =>
  id === "almere" ? [id, ...PUBLIC_ONLY_LOCATION_IDS] : [id],
);

/** Short tab labels for the locations above — used by both the
 * dashboard's profile tabs (Topbar) and "Alle reviews"' per-location
 * tabs, so the two stay worded the same. */
export const LOCATION_TAB_LABEL: Record<LocationId, string> = {
  centrum: "Coffeeshop BIJ",
  almere: "Boerejongens Almere",
  sloterdijk: "Coffeeshop Sloterdijk",
  west: "Boerejongens West",
  // The Utrechtsestraat shop; "Centrum" as in the reply instructions, so it
  // isn't mistaken for Boerejongens Almere next to it.
  boerejongens: "Boerejongens Centrum",
  amsterdamgenetics: "Amsterdam Genetics",
};
