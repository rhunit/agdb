import { useMemo } from "react";
import {
  LOCATIONS,
  PREVIOUS_WEEK_AVG_SCORE,
  PREVIOUS_WEEK_REVIEW_COUNT,
  REVIEW_GROWTH,
  REVIEWS,
  WEEKLY_LOG,
} from "../data/mockData";
import type { LivePlaceSummary } from "../lib/api";
import type { LocationId, Review, ReviewGrowthWeek, WeeklyLogEntry } from "../types";

export type LocationFilter = LocationId | "all";

function includedLocations(filter: LocationFilter): LocationId[] {
  return filter === "all" ? LOCATIONS.map((l) => l.id) : [filter];
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/);
  const initials = parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
  return initials.toUpperCase() || "?";
}

function daysAgoFrom(publishTime: string | null): number {
  if (!publishTime) return 999;
  const ms = Date.now() - new Date(publishTime).getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

/** Converts a location's real Places reviews into the feed's Review shape.
 * Source/confidence are honestly "onbekend" — Places has no concept of
 * how a review came in, and "responded" is left false but these reviews
 * are never used for reactieratio (that stays mock-only, see below). */
function liveReviewsFor(locationId: LocationId, summary: LivePlaceSummary): Review[] {
  return summary.reviews.map((r, i) => ({
    id: `live-${locationId}-${i}`,
    location: locationId,
    reviewer: r.authorName,
    initials: initialsFrom(r.authorName),
    rating: Math.min(5, Math.max(1, Math.round(r.rating))) as Review["rating"],
    snippet: r.text,
    source: "onbekend",
    confidence: "onbekend",
    daysAgo: daysAgoFrom(r.publishTime),
    responded: false,
  }));
}

export function useDashboardData(
  filter: LocationFilter,
  reviewGrowthOverride?: ReviewGrowthWeek[] | null,
  livePlaces?: Partial<Record<LocationId, LivePlaceSummary>> | null,
  weeklyLogOverride?: WeeklyLogEntry[] | null,
) {
  const reviewGrowthSource =
    reviewGrowthOverride && reviewGrowthOverride.length > 0
      ? reviewGrowthOverride
      : REVIEW_GROWTH;
  const weeklyLogSource = weeklyLogOverride ?? WEEKLY_LOG;

  return useMemo(() => {
    const locations = includedLocations(filter);
    const locationSet = new Set(locations);

    // Used for reactieratio / critical-review detection — always the mock
    // set, regardless of live status, since response status isn't
    // available from Places at all (see reviewCount comment below).
    const mockReviews = REVIEWS.filter((r) => locationSet.has(r.location));

    // What the feed actually displays: real Places reviews for any
    // location we have live data for, mock reviews for the rest. Places
    // has no way to guarantee "newest" — it returns 5 "most relevant"
    // reviews, which are often old, high-engagement ones. Showing those
    // under "Nieuwe reviews deze week" would be misleading, so live
    // reviews older than 7 days are dropped here rather than displayed
    // with a false recency claim; a location with none inside that
    // window just contributes nothing, which is the honest outcome.
    const reviews = locations
      .flatMap((id) => {
        const live = livePlaces?.[id];
        return live
          ? liveReviewsFor(id, live).filter((r) => r.daysAgo <= 7)
          : mockReviews.filter((r) => r.location === id);
      })
      .sort((a, b) => a.daysAgo - b.daysAgo);

    const liveRatings = livePlaces
      ? locations
          .map((id) => livePlaces[id])
          .filter((p): p is LivePlaceSummary => Boolean(p && p.rating !== null))
      : [];
    const avgScoreIsLive = livePlaces != null && liveRatings.length > 0;

    // Whether the review feed / extremes count for this selection includes
    // at least one location with real Places data — used to badge those
    // UI pieces as LIVE, since (unlike avgScore) they can be a mix of live
    // and mock locations under "Alle locaties".
    const reviewsAreLive =
      livePlaces != null && locations.some((id) => livePlaces[id] != null);

    const avgScore = avgScoreIsLive
      ? liveRatings.reduce((sum, p) => sum + p.rating! * p.userRatingCount, 0) /
        liveRatings.reduce((sum, p) => sum + p.userRatingCount, 0)
      : mockReviews.length > 0
        ? mockReviews.reduce((sum, r) => sum + r.rating, 0) / mockReviews.length
        : 0;

    const avgScoreReviewCount = liveRatings.reduce(
      (sum, p) => sum + p.userRatingCount,
      0,
    );

    const previousAvgScore =
      locations.reduce((sum, id) => sum + PREVIOUS_WEEK_AVG_SCORE[id], 0) /
      locations.length;

    // Reactieratio stays purely mock-derived — Places has no concept of
    // reply status, so a live review's `responded: false` is a stand-in,
    // not real data, and must not affect this percentage.
    const respondedCount = mockReviews.filter((r) => r.responded).length;
    const openCount = mockReviews.length - respondedCount;
    const responseRatio =
      mockReviews.length > 0 ? (respondedCount / mockReviews.length) * 100 : 0;

    // Also stays mock: the API's default "most relevant" review selection
    // can omit a genuinely brand-new review entirely (low engagement,
    // first-time reviewer), so a last-7-days count derived from it can
    // undercount all the way to a misleading 0. Wait for the v4 Reviews
    // API's complete, ordered list instead.
    const reviewCount = mockReviews.length;

    const previousReviewCount = locations.reduce(
      (sum, id) => sum + PREVIOUS_WEEK_REVIEW_COUNT[id],
      0,
    );

    const criticalReviews = reviews.filter((r) => r.rating <= 2);
    const topRatedCount = reviews.filter((r) => r.rating === 5).length;

    const reviewGrowthSeries = reviewGrowthSource.map((week) => ({
      week: week.week,
      total: locations.reduce((sum, id) => sum + week[id], 0),
      byLocation: Object.fromEntries(
        locations.map((id) => [id, week[id]]),
      ) as Record<LocationId, number>,
    }));

    const latestWeek = reviewGrowthSeries[reviewGrowthSeries.length - 1];
    const previousWeek = reviewGrowthSeries[reviewGrowthSeries.length - 2];
    const reviewGrowthTotal = latestWeek.total;
    const reviewGrowthDeltaPct =
      previousWeek && previousWeek.total > 0
        ? ((latestWeek.total - previousWeek.total) / previousWeek.total) * 100
        : 0;

    const logEntries = weeklyLogSource
      .filter((e) => locationSet.has(e.location))
      .sort((a, b) => (a.week < b.week ? 1 : a.week > b.week ? -1 : 0));

    const distinctWeeks = new Set(logEntries.map((e) => e.week));

    return {
      locations,
      reviews,
      reviewsAreLive,
      avgScore,
      avgScoreIsLive,
      avgScoreReviewCount,
      avgScoreDelta: avgScore - previousAvgScore,
      reviewCount,
      reviewCountDelta: reviewCount - previousReviewCount,
      responseRatio,
      openCount,
      criticalCount: criticalReviews.length,
      oldestCriticalDaysAgo: criticalReviews.length
        ? Math.max(...criticalReviews.map((r) => r.daysAgo))
        : 0,
      topRatedCount,
      reviewGrowthSeries,
      reviewGrowthTotal,
      reviewGrowthDeltaPct,
      logEntries,
      logEntryCount: logEntries.length,
      logWeekCount: distinctWeeks.size,
    };
  }, [filter, reviewGrowthSource, livePlaces, weeklyLogSource]);
}
