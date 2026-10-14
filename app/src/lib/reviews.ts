import type { LiveBusinessReview, RemovedReview } from "./api";
import type { LocationId, Review } from "../types";

export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/);
  const initials = parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
  return initials.toUpperCase() || "?";
}

export function daysAgoFrom(publishTime: string | null): number {
  if (!publishTime) return 999;
  const ms = Date.now() - new Date(publishTime).getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

/** The best available moment a review was posted — the real timestamp
 * when there is one, otherwise a reconstruction from `daysAgo` (good
 * enough for mock data, which only ever carries the latter). Powers
 * date-range filtering across both live and mock reviews uniformly. */
export function dateFromReview(review: Review): Date {
  if (review.publishedAt) return new Date(review.publishedAt);
  return new Date(Date.now() - review.daysAgo * 24 * 60 * 60 * 1000);
}

/** Converts a location's v4 Business Profile reviews into the feed's
 * Review shape — complete and correctly time-ordered (no 5-review cap,
 * no relevance ranking), and `responded` is real reply status, not a
 * stand-in. The authoritative source whenever it's available. */
export function businessReviewsFor(
  locationId: LocationId,
  items: LiveBusinessReview[],
): Review[] {
  return items.map((r) => ({
    id: `biz-${locationId}-${r.id}`,
    location: locationId,
    reviewer: r.reviewer,
    initials: initialsFrom(r.reviewer),
    rating: Math.min(5, Math.max(1, Math.round(r.rating))) as Review["rating"],
    snippet: r.text,
    source: "onbekend",
    confidence: "onbekend",
    daysAgo: daysAgoFrom(r.createTime),
    publishedAt: r.createTime ?? undefined,
    responded: r.responded,
    googleReviewId: r.id,
    replyText: r.replyText ?? undefined,
    responseTime: r.responseTime ?? undefined,
  }));
}

/** Converts detected removals into the same Review shape so they can
 * share "Alle reviews"' filtering, sorting and rendering — gated behind
 * the "Verwijderd" status filter rather than mixed into the normal list,
 * since they no longer exist on Google (see RemovedReview). */
export function reviewsFromRemoved(removed: RemovedReview[]): Review[] {
  return removed.map((r) => ({
    id: `removed-${r.id}`,
    location: r.location,
    reviewer: r.reviewer,
    initials: initialsFrom(r.reviewer),
    rating: Math.min(5, Math.max(1, Math.round(r.rating))) as Review["rating"],
    snippet: r.text,
    source: "onbekend",
    confidence: "onbekend",
    daysAgo: daysAgoFrom(r.createTime),
    publishedAt: r.createTime ?? undefined,
    responded: false,
    removedAt: r.detectedAt,
  }));
}
