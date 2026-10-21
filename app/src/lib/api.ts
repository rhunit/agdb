import type {
  LocationId,
  LogType,
  ReviewGrowthWeek,
  SearchViewsWeek,
  WeeklyLogEntry,
} from "../types";
import { classifyServerError, clearApiFailure, recordApiFailure } from "./apiFailures";

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

// Long enough for the full-history fetch on a small instance, short
// enough that a hung backend turns into a visible error instead of a
// spinner that never stops.
const DEFAULT_TIMEOUT_MS = 60_000;

/** GET + JSON parse with a timeout. Never throws: returns null on any
 * failure (callers keep their existing null fallback) but records why in
 * ./apiFailures, which is what the error banner and error states read. */
async function getJson<T>(path: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      const message = body?.error ?? `HTTP ${res.status}`;
      recordApiFailure(path, classifyServerError(res.status, message), message);
      return null;
    }
    const data = (await res.json()) as T;
    clearApiFailure(path);
    return data;
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === "TimeoutError";
    recordApiFailure(
      path,
      timedOut ? "timeout" : "network",
      timedOut ? `Geen antwoord binnen ${timeoutMs / 1000} s` : String(err),
    );
    return null;
  }
}

export async function fetchLiveLocations(): Promise<LiveLocation[] | null> {
  if (!hasLiveBackend()) return null;
  return getJson<LiveLocation[]>("/api/locations");
}

function weekSortKey(week: string): number {
  return Number(week.replace(/\D/g, "")) || 0;
}

export async function fetchLiveSearchViews(): Promise<SearchViewsWeek[] | null> {
  if (!hasLiveBackend()) return null;
  const raw = await getJson<Record<string, Record<LocationId, number>>>("/api/search-views");
  if (!raw) return null;
  return Object.entries(raw)
    .map(([week, byLocation]) => ({ week, ...byLocation }))
    .sort((a, b) => weekSortKey(a.week) - weekSortKey(b.week));
}

export async function fetchLivePlacesSummary(): Promise<Partial<
  Record<LocationId, LivePlaceSummary>
> | null> {
  if (!hasLiveBackend()) return null;
  return getJson<Partial<Record<LocationId, LivePlaceSummary>>>("/api/places-summary");
}

/** Week-over-week new-review counts, derived server-side from weekly
 * snapshots of each location's total review count (see
 * server/src/placesHistoryStore.ts). Only as many weeks as have actually
 * been snapshotted come back — sparse until the dashboard has been open
 * across enough weeks to build up history. */
export async function fetchLiveReviewGrowth(): Promise<ReviewGrowthWeek[] | null> {
  if (!hasLiveBackend()) return null;
  const raw = await getJson<Record<string, Partial<Record<LocationId, number>>>>(
    "/api/places-review-growth",
  );
  if (!raw) return null;
  return Object.entries(raw)
    .map(([week, byLocation]) => ({
      week,
      centrum: byLocation.centrum ?? 0,
      oost: byLocation.oost ?? 0,
      depijp: byLocation.depijp ?? 0,
      boerejongens: byLocation.boerejongens ?? 0,
      almere: byLocation.almere ?? 0,
      amsterdamgenetics: byLocation.amsterdamgenetics ?? 0,
    }))
    .sort((a, b) => weekSortKey(a.week) - weekSortKey(b.week));
}

/** Reviews from the last two weeks per location via the legacy v4
 * Business Profile API — complete and correctly time-ordered, unlike the
 * Places-based summary. The authoritative source for "Nieuwe reviews",
 * reactieratio, and the 5★/1–2★ split when available. */
export async function fetchLiveBusinessReviews(): Promise<Partial<
  Record<LocationId, LiveBusinessReview[]>
> | null> {
  if (!hasLiveBackend()) return null;
  return getJson<Partial<Record<LocationId, LiveBusinessReview[]>>>("/api/business-reviews");
}

/** The complete review history per location (not just the recent window
 * fetchLiveBusinessReviews uses) — backs the "Alle reviews" page. */
export async function fetchLiveAllBusinessReviews(): Promise<Partial<
  Record<LocationId, LiveBusinessReview[]>
> | null> {
  if (!hasLiveBackend()) return null;
  // Pulls every review for every location — noticeably slower than the
  // other calls, so it gets a longer timeout before counting as hung.
  return getJson<Partial<Record<LocationId, LiveBusinessReview[]>>>(
    "/api/business-reviews-all",
    120_000,
  );
}

export async function fetchLiveWeeklyLog(): Promise<WeeklyLogEntry[] | null> {
  if (!hasLiveBackend()) return null;
  return getJson<WeeklyLogEntry[]>("/api/weekly-log");
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
  return getJson<ReviewEdit[]>("/api/review-edits");
}

export async function fetchRemovedReviews(): Promise<RemovedReview[] | null> {
  if (!hasLiveBackend()) return null;
  return getJson<RemovedReview[]>("/api/review-removals");
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

export type Permission = "reply" | "ai";

/** The logged-in account and what it may do — see server/src/accounts.ts. */
export interface Me {
  username: string;
  permissions: Permission[];
  /** Whether the AI reply draft is switched on server-side at all. */
  replyDraftAvailable: boolean;
}

export async function fetchMe(): Promise<Me | null> {
  if (!hasLiveBackend()) return null;
  return getJson<Me>("/api/me");
}

export type GenerateReplyDraftResult = { ok: true; draft: string } | { ok: false; error: string };

/** A draft owner reply for one review, written per the business's reply
 * rules — only ever put in the text field to edit, never posted directly. */
export async function generateReplyDraft(input: {
  location: LocationId;
  reviewer: string;
  rating: number;
  text: string;
}): Promise<GenerateReplyDraftResult> {
  if (!hasLiveBackend()) {
    return { ok: false, error: "Geen backend geconfigureerd." };
  }
  try {
    const res = await fetch(`${API_BASE}/api/reply-draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: body?.error ?? `Genereren mislukt (${res.status}).` };
    }
    return { ok: true, draft: ((await res.json()) as { draft: string }).draft };
  } catch {
    return { ok: false, error: "Kon de server niet bereiken." };
  }
}
