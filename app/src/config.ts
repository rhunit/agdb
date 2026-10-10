import type { LocationId } from "./types";

// Locations with a working Topbar tab for now — the rest of LOCATIONS
// (see data/mockData.ts) still exists in the data model, it just doesn't
// get its own tab, a LocationsOverview card, or a slot in the "Dashboard"
// bundle yet. More locations land here once their own profile is ready
// to show on its own; until then, bundling them into "Dashboard" would
// silently blend in data for a location nobody can otherwise see or
// select, which is confusing rather than honest.
export const VISIBLE_LOCATION_IDS: LocationId[] = ["centrum"];
