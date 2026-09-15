import type { LocationId, SearchViewsWeek } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL as string | undefined;

export interface LiveLocation {
  internalId: LocationId | null;
  googleLocationId: string;
  name: string;
}

export interface LivePlaceSummary {
  rating: number | null;
  userRatingCount: number;
  reviews: {
    authorName: string;
    rating: number;
    text: string;
    relativeTime: string;
  }[];
}

/** True only when a backend URL is configured — lets the app run standalone
 * on mock data with zero setup, and switch on live data once a backend
 * exists. */
export function hasLiveBackend(): boolean {
  return Boolean(API_BASE);
}

export async function fetchLiveLocations(): Promise<LiveLocation[] | null> {
  if (!API_BASE) return null;
  try {
    const res = await fetch(`${API_BASE}/api/locations`);
    if (!res.ok) return null;
    return (await res.json()) as LiveLocation[];
  } catch {
    return null;
  }
}

function weekSortKey(week: string): number {
  return Number(week.replace(/\D/g, "")) || 0;
}

export async function fetchLiveSearchViews(): Promise<SearchViewsWeek[] | null> {
  if (!API_BASE) return null;
  try {
    const res = await fetch(`${API_BASE}/api/search-views`);
    if (!res.ok) return null;
    const raw = (await res.json()) as Record<
      string,
      Record<LocationId, number>
    >;
    return Object.entries(raw)
      .map(([week, byLocation]) => ({ week, ...byLocation }))
      .sort((a, b) => weekSortKey(a.week) - weekSortKey(b.week));
  } catch {
    return null;
  }
}

export async function fetchLivePlacesSummary(): Promise<Partial<
  Record<LocationId, LivePlaceSummary>
> | null> {
  if (!API_BASE) return null;
  try {
    const res = await fetch(`${API_BASE}/api/places-summary`);
    if (!res.ok) return null;
    return (await res.json()) as Partial<Record<LocationId, LivePlaceSummary>>;
  } catch {
    return null;
  }
}
