import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BusinessReview, LocationReviewCounts } from "./googleBusinessReviews.js";
import type { InternalLocationId } from "./googleBusinessProfile.js";

// Google's review API has no edit-history or deletion-log endpoint — it
// only ever returns the CURRENT state of a review (current text, current
// rating, a single updateTime). There is no way to ask Google "what did
// this review used to say" or "which reviews did you remove": the only
// way to know either of those is to have fetched the review ourselves
// before it changed, and noticed the difference on a later fetch. So
// everything in this file is built from our OWN snapshots going forward
// from whenever this feature first ran — it can never recover an edit or
// removal that already happened before we started watching.

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", ".data");
const HISTORY_FILE = join(DATA_DIR, "review-history.json");

interface ReviewSnapshot {
  id: string;
  location: InternalLocationId;
  reviewer: string;
  rating: number;
  text: string;
  createTime: string | null;
  updateTime: string | null;
  capturedAt: string;
}

export interface ReviewEditEvent {
  id: string;
  reviewId: string;
  location: InternalLocationId;
  reviewer: string;
  previousRating: number;
  previousText: string;
  previousUpdateTime: string | null;
  newRating: number;
  newText: string;
  newUpdateTime: string | null;
  detectedAt: string;
}

export interface RemovedReviewEvent {
  id: string;
  reviewId: string;
  location: InternalLocationId;
  reviewer: string;
  rating: number;
  text: string;
  createTime: string | null;
  lastSeenUpdateTime: string | null;
  detectedAt: string;
}

export interface ReviewCountCheck {
  location: InternalLocationId;
  /** Google's own reported total for the location, captured on the same
   * fetch as actualReviewCount — null if Google didn't send one. */
  totalReviewCount: number | null;
  /** How many review objects we actually received after full pagination. */
  actualReviewCount: number;
  /** totalReviewCount - actualReviewCount. Positive means Google's own
   * count is higher than what it actually hands back — the gap is
   * reviews Google still counts but no longer returns, which is a
   * removal signal that needs no history of ours to notice (unlike
   * edits/removals tracked via snapshots, this can reveal something that
   * was already gone before we ever looked). Zero (or null
   * totalReviewCount) means no such signal either way — not proof
   * nothing was removed, just nothing this check can see. */
  discrepancy: number | null;
  checkedAt: string;
}

interface Store {
  snapshots: ReviewSnapshot[];
  edits: ReviewEditEvent[];
  removals: RemovedReviewEvent[];
  countChecks: ReviewCountCheck[];
}

function load(): Store {
  if (!existsSync(HISTORY_FILE)) return { snapshots: [], edits: [], removals: [], countChecks: [] };
  try {
    const parsed = JSON.parse(readFileSync(HISTORY_FILE, "utf-8")) as Partial<Store>;
    return {
      snapshots: parsed.snapshots ?? [],
      edits: parsed.edits ?? [],
      removals: parsed.removals ?? [],
      countChecks: parsed.countChecks ?? [],
    };
  } catch {
    return { snapshots: [], edits: [], removals: [], countChecks: [] };
  }
}

function save(store: Store): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(HISTORY_FILE, JSON.stringify(store, null, 2), "utf-8");
}

/** Compares a fresh fetch of one location's full review history against
 * what we last saw, records any edits (rating and/or text changed, with
 * a moved updateTime) and any removals (a review we'd seen before is
 * simply gone from this fetch), then updates the stored snapshots. Meant
 * to be called every time the full history is fetched for real (see
 * index.ts) — a location's first-ever run only establishes the baseline
 * and reports nothing, since there's nothing yet to compare against. */
export function diffAndRecordReviews(
  location: InternalLocationId,
  current: BusinessReview[],
): { edits: ReviewEditEvent[]; removals: RemovedReviewEvent[] } {
  const store = load();
  const now = new Date().toISOString();
  const currentIds = new Set(current.map((r) => r.id));
  const priorForLocation = store.snapshots.filter((s) => s.location === location);
  const priorById = new Map(priorForLocation.map((s) => [s.id, s]));

  const newEdits: ReviewEditEvent[] = [];
  for (const r of current) {
    const prior = priorById.get(r.id);
    if (prior && prior.updateTime !== r.updateTime && (prior.rating !== r.rating || prior.text !== r.text)) {
      newEdits.push({
        id: `edit-${r.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        reviewId: r.id,
        location,
        reviewer: r.reviewer,
        previousRating: prior.rating,
        previousText: prior.text,
        previousUpdateTime: prior.updateTime,
        newRating: r.rating,
        newText: r.text,
        newUpdateTime: r.updateTime,
        detectedAt: now,
      });
    }
  }

  const newRemovals: RemovedReviewEvent[] = [];
  for (const prior of priorForLocation) {
    if (!currentIds.has(prior.id)) {
      newRemovals.push({
        id: `removed-${prior.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        reviewId: prior.id,
        location,
        reviewer: prior.reviewer,
        rating: prior.rating,
        text: prior.text,
        createTime: prior.createTime,
        lastSeenUpdateTime: prior.updateTime,
        detectedAt: now,
      });
    }
  }

  // Replace this location's snapshot set with exactly the current fetch —
  // drops removed reviews (so they don't get re-reported next time) and
  // refreshes everything else to its latest known state.
  const otherLocations = store.snapshots.filter((s) => s.location !== location);
  const refreshed: ReviewSnapshot[] = current.map((r) => ({
    id: r.id,
    location,
    reviewer: r.reviewer,
    rating: r.rating,
    text: r.text,
    createTime: r.createTime,
    updateTime: r.updateTime,
    capturedAt: now,
  }));

  store.snapshots = [...otherLocations, ...refreshed];
  store.edits.push(...newEdits);
  store.removals.push(...newRemovals);
  save(store);

  return { edits: newEdits, removals: newRemovals };
}

export function listReviewEdits(locations: InternalLocationId[]): ReviewEditEvent[] {
  const store = load();
  const set = new Set(locations);
  return store.edits
    .filter((e) => set.has(e.location))
    .sort((a, b) => (a.detectedAt < b.detectedAt ? 1 : -1));
}

export function listRemovedReviews(locations: InternalLocationId[]): RemovedReviewEvent[] {
  const store = load();
  const set = new Set(locations);
  return store.removals
    .filter((r) => set.has(r.location))
    .sort((a, b) => (a.detectedAt < b.detectedAt ? 1 : -1));
}

/** Records the latest Google-total-vs-actual-count comparison per
 * location (see ReviewCountCheck above) — one entry per location, each
 * fetch overwrites the previous check rather than accumulating a log,
 * since only the current gap matters. */
export function recordReviewCounts(
  counts: Partial<Record<InternalLocationId, LocationReviewCounts>>,
): void {
  const store = load();
  const now = new Date().toISOString();

  for (const [location, c] of Object.entries(counts)) {
    if (!c) continue;
    store.countChecks = store.countChecks.filter((x) => x.location !== location);
    store.countChecks.push({
      location: location as InternalLocationId,
      totalReviewCount: c.totalReviewCount,
      actualReviewCount: c.actualReviewCount,
      discrepancy: c.totalReviewCount != null ? c.totalReviewCount - c.actualReviewCount : null,
      checkedAt: now,
    });
  }
  save(store);
}

export function listReviewCountChecks(locations: InternalLocationId[]): ReviewCountCheck[] {
  const store = load();
  const set = new Set(locations);
  return store.countChecks.filter((c) => set.has(c.location));
}
