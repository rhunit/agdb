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
  /** Set while a review we knew is missing from complete fetches, but not
   * yet missing often enough to call it removed (see REMOVAL_CONFIRMATIONS). */
  missingSince?: string;
  missingCount?: number;
}

// A review only counts as removed once it's absent from this many complete
// fetches in a row: Google sometimes serves an older copy of the list that
// lacks recent reviews, and a single such fetch must not mark them removed.
const REMOVAL_CONFIRMATIONS = 2;

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

// Google's v4 reviews API is eventually consistent: back-to-back fetches
// can alternate between a review's current version and an older cached
// one. Without guarding against that, one real edit showed up as an
// endless back-and-forth (13:34 → 07:35 → 13:34 ...). A version only
// counts as newer when its updateTime is strictly later.
function isNewer(candidate: string | null, than: string | null): boolean {
  if (!candidate || !than) return candidate !== than;
  return Date.parse(candidate) > Date.parse(than);
}

/** Drops edit events recorded before the guard above existed: ones that
 * went *back* to an older version, and repeats of an edit already seen
 * (same review, same resulting version) — keeping the first detection. */
function withoutStaleEdits(edits: ReviewEditEvent[]): ReviewEditEvent[] {
  const seen = new Set<string>();
  return [...edits]
    .sort((a, b) => (a.detectedAt < b.detectedAt ? -1 : 1))
    .filter((e) => {
      if (!isNewer(e.newUpdateTime, e.previousUpdateTime)) return false;
      const key = `${e.reviewId}|${e.newUpdateTime}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function load(): Store {
  if (!existsSync(HISTORY_FILE)) return { snapshots: [], edits: [], removals: [] };
  try {
    const store = JSON.parse(readFileSync(HISTORY_FILE, "utf-8")) as Store;
    store.edits = withoutStaleEdits(store.edits);
    return store;
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
  /** False when this fetch may be missing reviews (see
   * getAllBusinessReviews): then nothing is treated as removed. */
  complete = true,
): { edits: ReviewEditEvent[]; removals: RemovedReviewEvent[] } {
  const store = load();
  const now = new Date().toISOString();
  const currentIds = new Set(current.map((r) => r.id));
  const priorForLocation = store.snapshots.filter((s) => s.location === location);
  const priorById = new Map(priorForLocation.map((s) => [s.id, s]));

  const alreadyRecorded = new Set(store.edits.map((e) => `${e.reviewId}|${e.newUpdateTime}`));
  const newEdits: ReviewEditEvent[] = [];
  for (const r of current) {
    const prior = priorById.get(r.id);
    if (
      prior &&
      isNewer(r.updateTime, prior.updateTime) &&
      (prior.rating !== r.rating || prior.text !== r.text) &&
      !alreadyRecorded.has(`${r.id}|${r.updateTime}`)
    ) {
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

  // A review recorded as removed that's back in the list was never really
  // removed (an earlier fetch just lacked it) — drop that removal.
  const restored = store.removals.filter(
    (r) => r.location === location && currentIds.has(r.reviewId),
  );
  if (restored.length > 0) {
    const restoredIds = new Set(restored.map((r) => r.reviewId));
    store.removals = store.removals.filter(
      (r) => !(r.location === location && restoredIds.has(r.reviewId)),
    );
    console.log(
      `review history: ${restored.length} review(s) for ${location} reappeared — no longer marked removed`,
    );
  }

  const newRemovals: RemovedReviewEvent[] = [];
  const stillMissing: ReviewSnapshot[] = [];
  for (const prior of priorForLocation) {
    if (currentIds.has(prior.id)) continue;
    // An incomplete fetch says nothing about the reviews it lacks.
    if (!complete) {
      stillMissing.push(prior);
      continue;
    }
    const missingCount = (prior.missingCount ?? 0) + 1;
    const missingSince = prior.missingSince ?? now;
    if (missingCount < REMOVAL_CONFIRMATIONS) {
      stillMissing.push({ ...prior, missingSince, missingCount });
      continue;
    }
    newRemovals.push({
      id: `removed-${prior.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      reviewId: prior.id,
      location,
      reviewer: prior.reviewer,
      rating: prior.rating,
      text: prior.text,
      createTime: prior.createTime,
      lastSeenUpdateTime: prior.updateTime,
      // When it was first found missing, not when that was confirmed.
      detectedAt: missingSince,
    });
  }

  // Replace this location's snapshot set with the current fetch — drops
  // confirmed removals (so they don't get re-reported next time), keeps
  // reviews that are missing but not yet confirmed removed, and refreshes
  // everything else to its latest known state. A stale copy (older
  // updateTime than what we already have) never overwrites the newer
  // snapshot, or the next fresh fetch would look like an edit again.
  const otherLocations = store.snapshots.filter((s) => s.location !== location);
  const refreshed: ReviewSnapshot[] = current.map((r) => {
    const prior = priorById.get(r.id);
    if (prior && isNewer(prior.updateTime, r.updateTime)) {
      return { ...prior, missingSince: undefined, missingCount: undefined };
    }
    return {
      id: r.id,
      location,
      reviewer: r.reviewer,
      rating: r.rating,
      text: r.text,
      createTime: r.createTime,
      updateTime: r.updateTime,
      capturedAt: now,
    };
  });

  store.snapshots = [...otherLocations, ...refreshed, ...stillMissing];
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
