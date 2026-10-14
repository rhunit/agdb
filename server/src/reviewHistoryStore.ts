import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BusinessReview } from "./googleBusinessReviews.js";
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

interface Store {
  snapshots: ReviewSnapshot[];
  edits: ReviewEditEvent[];
  removals: RemovedReviewEvent[];
}

function load(): Store {
  if (!existsSync(HISTORY_FILE)) return { snapshots: [], edits: [], removals: [] };
  try {
    return JSON.parse(readFileSync(HISTORY_FILE, "utf-8")) as Store;
  } catch {
    return { snapshots: [], edits: [], removals: [] };
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
