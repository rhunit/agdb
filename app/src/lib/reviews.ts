import type { LiveBusinessReview } from "./api";
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
  }));
}
