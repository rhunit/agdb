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

export interface LiveBusinessReview {
  id: string;
  reviewer: string;
  rating: number;
  text: string;
  createTime: string | null;
  responded: boolean;
  replyText: string | null;
  responseTime: string | null;
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
        almere: byLocation.almere ?? 0,
      }))
      .sort((a, b) => weekSortKey(a.week) - weekSortKey(b.week));
  } catch {
    return null;
  }
}

/** Reviews from the last two weeks per location via the legacy v4
 * Business Profile API — complete and correctly time-ordered, unlike the
 * Places-based summary. The authoritative source for "Nieuwe reviews",
 * reactieratio, and the 5★/1–2★ split when available. */
export async function fetchLiveBusinessReviews(): Promise<Partial<
  Record<LocationId, LiveBusinessReview[]>
> | null> {
  if (!hasLiveBackend()) return null;
  try {
    const res = await fetch(`${API_BASE}/api/business-reviews`);
    if (!res.ok) return null;
    return (await res.json()) as Partial<Record<LocationId, LiveBusinessReview[]>>;
  } catch {
    return null;
  }
}

/** The complete review history per location (not just the recent window
 * fetchLiveBusinessReviews uses) — backs the "Alle reviews" page. */
export async function fetchLiveAllBusinessReviews(): Promise<Partial<
  Record<LocationId, LiveBusinessReview[]>
> | null> {
  if (!hasLiveBackend()) return null;
  try {
    const res = await fetch(`${API_BASE}/api/business-reviews-all`);
    if (!res.ok) return null;
    return (await res.json()) as Partial<Record<LocationId, LiveBusinessReview[]>>;
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

/** A review we'd previously fetched with different text/rating, now seen
 * with a moved updateTime — detected server-side by diffing against our
 * own snapshots (see server/src/reviewHistoryStore.ts). Google's API has
 * no edit-history endpoint, so this only ever covers edits that happened
 * after the backend started watching, never anything from before. */
export interface ReviewEdit {
  id: string;
  reviewId: string;
  location: LocationId;
  reviewer: string;
  previousRating: number;
  previousText: string;
  previousUpdateTime: string | null;
  newRating: number;
  newText: string;
  newUpdateTime: string | null;
  detectedAt: string;
}

/** A review we'd previously fetched that's simply gone from a later full
 * fetch — Google gives no reason or deletion log, so this can't say
 * whether Google removed it or the reviewer withdrew it, only that it's
 * gone, and only from the point the backend started watching onward. */
export interface RemovedReview {
  id: string;
  reviewId: string;
  location: LocationId;
  reviewer: string;
  rating: number;
  text: string;
  createTime: string | null;
  lastSeenUpdateTime: string | null;
  detectedAt: string;
}

export async function fetchReviewEdits(): Promise<ReviewEdit[] | null> {
  if (!hasLiveBackend()) return null;
  try {
    const res = await fetch(`${API_BASE}/api/review-edits`);
    if (!res.ok) return null;
    return (await res.json()) as ReviewEdit[];
  } catch {
    return null;
  }
}

export async function fetchRemovedReviews(): Promise<RemovedReview[] | null> {
  if (!hasLiveBackend()) return null;
  try {
    const res = await fetch(`${API_BASE}/api/review-removals`);
    if (!res.ok) return null;
    return (await res.json()) as RemovedReview[];
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

export type SubmitReviewReplyResult =
  | { ok: true }
  | { ok: false; error: string };

/** Posts the owner reply to one review — this goes straight to the public
 * Google listing the moment the request succeeds, there's no draft state
 * on Google's side. Any "are you sure" step has to happen before this is
 * called. */
export async function submitReviewReply(
  location: LocationId,
  googleReviewId: string,
  comment: string,
): Promise<SubmitReviewReplyResult> {
  if (!hasLiveBackend()) {
    return { ok: false, error: "Geen backend geconfigureerd." };
  }
  try {
    const res = await fetch(
      `${API_BASE}/api/business-reviews/${location}/${googleReviewId}/reply`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment }),
      },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: body?.error ?? `Versturen mislukt (${res.status}).` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Kon de server niet bereiken." };
  }
}

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

export interface ReportSummaryReviewInput {
  reviewer: string;
  rating: number;
  text: string;
  createTime: string | null;
}

export interface ReportSummaryResult {
  compliments: string;
  concerns: string;
  closing: string;
}

export type GenerateReportSummaryResult =
  | { ok: true; summary: ReportSummaryResult }
  | { ok: false; error: string };

/** Whether the AI-written narrative section on the Rapportage page can be
 * generated at all — the backend only has this configured when
 * OPENAI_API_KEY is set, so the frontend checks first rather than
 * letting someone click the button into a guaranteed failure. */
export async function fetchReportSummaryAvailable(): Promise<boolean> {
  if (!hasLiveBackend()) return false;
  try {
    const res = await fetch(`${API_BASE}/api/report-summary-available`);
    if (!res.ok) return false;
    const body = (await res.json()) as { available: boolean };
    return body.available;
  } catch {
    return false;
  }
}

/** Generates the narrative compliments/concerns/closing text for one
 * location and period — on demand only (never automatic), since this is
 * a paid OpenAI API call. Grounded strictly in the `reviews` passed in. */
export async function generateReportSummary(
  locationName: string,
  periodLabel: string,
  reviews: ReportSummaryReviewInput[],
): Promise<GenerateReportSummaryResult> {
  if (!hasLiveBackend()) {
    return { ok: false, error: "Geen backend geconfigureerd." };
  }
  try {
    const res = await fetch(`${API_BASE}/api/report-summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationName, periodLabel, reviews }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: body?.error ?? `Genereren mislukt (${res.status}).` };
    }
    return { ok: true, summary: (await res.json()) as ReportSummaryResult };
  } catch {
    return { ok: false, error: "Kon de server niet bereiken." };
  }
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type SendChatMessageResult = { ok: true; reply: string } | { ok: false; error: string };

/** Whether the floating AI chat panel can be used at all — same
 * OPENAI_API_KEY as the Rapportage summary. */
export async function fetchAiChatAvailable(): Promise<boolean> {
  if (!hasLiveBackend()) return false;
  try {
    const res = await fetch(`${API_BASE}/api/ai-chat-available`);
    if (!res.ok) return false;
    const body = (await res.json()) as { available: boolean };
    return body.available;
  } catch {
    return false;
  }
}

/** Sends the whole conversation so far and gets the next assistant turn
 * back — nothing is persisted server-side, so the full history has to be
 * resent each time. `context` is an optional plain-text snapshot of the
 * aggregate dashboard stats currently on screen (see
 * ../lib/aiChatContext.ts) — never individual review text. */
export async function sendChatMessage(
  messages: ChatMessage[],
  context?: string,
): Promise<SendChatMessageResult> {
  if (!hasLiveBackend()) {
    return { ok: false, error: "Geen backend geconfigureerd." };
  }
  try {
    const res = await fetch(`${API_BASE}/api/ai-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, context }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: body?.error ?? `Versturen mislukt (${res.status}).` };
    }
    const data = (await res.json()) as { reply: string };
    return { ok: true, reply: data.reply };
  } catch {
    return { ok: false, error: "Kon de server niet bereiken." };
  }
}
