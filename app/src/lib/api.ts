import type {
  LocationId,
  LogType,
  ReviewGrowthWeek,
  SearchViewsWeek,
  WeeklyLogEntry,
} from "../types";

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
    publishTime: string | null;
  }[];
  newReviewsLast7d: number;
  newReviewsCapped: boolean;
}

/** True whenever VITE_API_BASE_URL is set at all — including to an empty
 * string, which means "same origin" for a combined deploy where the
 * backend serves this build itself (see app/.env.production). Lets the
 * app run standalone on mock data with zero setup when the var is unset
 * entirely, and switch on live data once a backend exists. */
export function hasLiveBackend(): boolean {
  return API_BASE !== undefined;
}

export async function fetchLiveLocations(): Promise<LiveLocation[] | null> {
  if (!hasLiveBackend()) return null;
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
  if (!hasLiveBackend()) return null;
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
  if (!hasLiveBackend()) return null;
  try {
    const res = await fetch(`${API_BASE}/api/places-summary`);
    if (!res.ok) return null;
    return (await res.json()) as Partial<Record<LocationId, LivePlaceSummary>>;
  } catch {
    return null;
  }
}

/** Week-over-week new-review counts, derived server-side from weekly
 * snapshots of each location's total review count (see
 * server/src/placesHistoryStore.ts). Only as many weeks as have actually
 * been snapshotted come back — sparse until the dashboard has been open
 * across enough weeks to build up history. */
export async function fetchLiveReviewGrowth(): Promise<ReviewGrowthWeek[] | null> {
  if (!hasLiveBackend()) return null;
  try {
    const res = await fetch(`${API_BASE}/api/places-review-growth`);
    if (!res.ok) return null;
    const raw = (await res.json()) as Record<
      string,
      Partial<Record<LocationId, number>>
    >;
    return Object.entries(raw)
      .map(([week, byLocation]) => ({
        week,
        centrum: byLocation.centrum ?? 0,
        oost: byLocation.oost ?? 0,
        depijp: byLocation.depijp ?? 0,
        boerejongens: byLocation.boerejongens ?? 0,
      }))
      .sort((a, b) => weekSortKey(a.week) - weekSortKey(b.week));
  } catch {
    return null;
  }
}

export async function fetchLiveWeeklyLog(): Promise<WeeklyLogEntry[] | null> {
  if (!hasLiveBackend()) return null;
  try {
    const res = await fetch(`${API_BASE}/api/weekly-log`);
    if (!res.ok) return null;
    return (await res.json()) as WeeklyLogEntry[];
  } catch {
    return null;
  }
}

export interface NewWeeklyLogEntry {
  location: LocationId;
  type: LogType;
  submitter: string;
  note: string;
}

export type SubmitWeeklyLogResult =
  | { ok: true; entry: WeeklyLogEntry }
  | { ok: false; error: string };

export async function submitWeeklyLogEntry(
  input: NewWeeklyLogEntry,
): Promise<SubmitWeeklyLogResult> {
  if (!hasLiveBackend()) {
    return { ok: false, error: "Geen backend geconfigureerd." };
  }
  try {
    const res = await fetch(`${API_BASE}/api/weekly-log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: body?.error ?? `Opslaan mislukt (${res.status}).` };
    }
    return { ok: true, entry: (await res.json()) as WeeklyLogEntry };
  } catch {
    return { ok: false, error: "Kon de server niet bereiken." };
  }
}
