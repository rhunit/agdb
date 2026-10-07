import { useMemo } from "react";
import {
  LOCATIONS,
  PREVIOUS_WEEK_AVG_SCORE,
  PREVIOUS_WEEK_REVIEW_COUNT,
  REVIEW_GROWTH,
  REVIEWS,
  WEEKLY_LOG,
} from "../data/mockData";
import type { LiveBusinessReview, LivePlaceSummary } from "../lib/api";
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

/** Converts a location's v4 Business Profile reviews into the feed's
 * Review shape — complete and correctly time-ordered (no 5-review cap,
 * no relevance ranking), and `responded` is real reply status this time,
 * not a stand-in. The authoritative source whenever it's available. */
function businessReviewsFor(
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
    responded: r.responded,
  }));
}

export function useDashboardData(
  filter: LocationFilter,
  reviewGrowthOverride?: ReviewGrowthWeek[] | null,
  livePlaces?: Partial<Record<LocationId, LivePlaceSummary>> | null,
  weeklyLogOverride?: WeeklyLogEntry[] | null,
  liveBusinessReviews?: Partial<Record<LocationId, LiveBusinessReview[]>> | null,
) {
  const reviewGrowthSource =
    reviewGrowthOverride && reviewGrowthOverride.length > 0
      ? reviewGrowthOverride
      : REVIEW_GROWTH;
  const weeklyLogSource = weeklyLogOverride ?? WEEKLY_LOG;

  return useMemo(() => {
    const locations = includedLocations(filter);
    const locationSet = new Set(locations);

    // Used whenever a location has no better live source — the mock set
    // is the final fallback for the feed and every stat derived from it.
    const mockReviews = REVIEWS.filter((r) => locationSet.has(r.location));

    // Per location: v4 Business Profile reviews (complete, correctly
    // ordered, real reply status) > Places reviews (5-review relevance-
    // ranked cap, no reply status) > mock. Only the ≤14-day business set
    // is fetched server-side, so bucket it into "this week" (the feed,
    // and — when every included location has it — the live stats below)
    // and "last week" (the real baseline for reviewCountDelta).
    const thisWeekByLocation: Review[][] = [];
    const previousWeekBizByLocation: Review[][] = [];
    for (const id of locations) {
      const biz = liveBusinessReviews?.[id];
      if (biz) {
        const converted = businessReviewsFor(id, biz);
        thisWeekByLocation.push(converted.filter((r) => r.daysAgo <= 7));
        previousWeekBizByLocation.push(
          converted.filter((r) => r.daysAgo > 7 && r.daysAgo <= 14),
        );
        continue;
      }
      const live = livePlaces?.[id];
      thisWeekByLocation.push(
        live
          ? liveReviewsFor(id, live).filter((r) => r.daysAgo <= 7)
          : mockReviews.filter((r) => r.location === id),
      );
    }

    const reviews = thisWeekByLocation.flat().sort((a, b) => a.daysAgo - b.daysAgo);
    const previousWeekBizReviews = previousWeekBizByLocation.flat();

    const liveRatings = livePlaces
      ? locations
          .map((id) => livePlaces[id])
          .filter((p): p is LivePlaceSummary => Boolean(p && p.rating !== null))
      : [];
    const avgScoreIsLive = livePlaces != null && liveRatings.length > 0;

    // Whether the review feed for this selection includes at least one
    // location with real live data (either source) — used to badge the
    // feed as LIVE, since (unlike avgScore) it can be a mix of live and
    // mock locations under "Alle locaties".
    const reviewsAreLive =
      locations.some((id) => livePlaces?.[id] != null) ||
      locations.some((id) => liveBusinessReviews?.[id] != null);

    // reviewCount / reactieratio / extremes only trust live numbers when
    // EVERY included location has v4 data — otherwise the aggregate would
    // silently blend a complete real count for one location with a mock
    // placeholder for another, which is worse than being honestly mock
    // everywhere. When true, `reviews` is guaranteed fully business-
    // sourced (nothing fell through to the Places/mock branch above).
    const statsAreLive =
      liveBusinessReviews != null &&
      locations.length > 0 &&
      locations.every((id) => liveBusinessReviews[id] != null);

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

    const statsSource = statsAreLive ? reviews : mockReviews;

    const respondedCount = statsSource.filter((r) => r.responded).length;
    const openCount = statsSource.length - respondedCount;
    const responseRatio =
      statsSource.length > 0 ? (respondedCount / statsSource.length) * 100 : 0;

    const reviewCount = statsSource.length;

    // Real week-over-week delta when live (previousWeekBizReviews comes
    // from the same complete v4 source), mock baseline otherwise.
    const previousReviewCount = statsAreLive
      ? previousWeekBizReviews.length
      : locations.reduce((sum, id) => sum + PREVIOUS_WEEK_REVIEW_COUNT[id], 0);

    const criticalReviews = statsSource.filter((r) => r.rating <= 2);
    const topRatedCount = statsSource.filter((r) => r.rating === 5).length;

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
      statsAreLive,
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
  }, [filter, reviewGrowthSource, livePlaces, weeklyLogSource, liveBusinessReviews]);
}
