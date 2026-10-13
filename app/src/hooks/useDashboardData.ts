import { useMemo } from "react";
import { VISIBLE_LOCATION_IDS } from "../config";
import {
  PREVIOUS_WEEK_AVG_SCORE,
  PREVIOUS_WEEK_CRITICAL_COUNT,
  PREVIOUS_WEEK_REVIEW_COUNT,
  PREVIOUS_WEEK_TOP_RATED_COUNT,
  REVIEW_GROWTH,
  REVIEWS,
  WEEKLY_LOG,
} from "../data/mockData";
import type { DateRange } from "../lib/dateRange";
import { isWithinRange, previousRange } from "../lib/dateRange";
import type { LiveBusinessReview, LivePlaceSummary } from "../lib/api";
import { businessReviewsFor, dateFromReview, daysAgoFrom, initialsFrom } from "../lib/reviews";
import type { LocationId, Review, ReviewGrowthWeek, WeeklyLogEntry } from "../types";

export type LocationFilter = LocationId | "all";

// How many reviews each feed shows at most.
const FEED_DISPLAY_CAP = 12;
const CRITICAL_FEED_DISPLAY_CAP = 8;

// "Dashboard" (filter "all") bundles only the locations that currently
// have their own visible tab (see ../config) — not every location in the
// data model. Blending in a location nobody can otherwise see or select
// would silently inflate every stat with data for a profile the
// dashboard doesn't yet present as connected.
function includedLocations(filter: LocationFilter): LocationId[] {
  return filter === "all" ? VISIBLE_LOCATION_IDS : [filter];
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
    publishedAt: r.publishTime ?? undefined,
    responded: false,
  }));
}

function sumByLocation(
  record: Record<LocationId, number>,
  locations: LocationId[],
): number {
  return locations.reduce((sum, id) => sum + record[id], 0);
}

export function useDashboardData(
  filter: LocationFilter,
  dateRange: DateRange,
  reviewGrowthOverride?: ReviewGrowthWeek[] | null,
  livePlaces?: Partial<Record<LocationId, LivePlaceSummary>> | null,
  weeklyLogOverride?: WeeklyLogEntry[] | null,
  liveBusinessReviews?: Partial<Record<LocationId, LiveBusinessReview[]>> | null,
  allBusinessReviews?: Partial<Record<LocationId, LiveBusinessReview[]>> | null,
) {
  const reviewGrowthSource =
    reviewGrowthOverride && reviewGrowthOverride.length > 0
      ? reviewGrowthOverride
      : REVIEW_GROWTH;
  const weeklyLogSource = weeklyLogOverride ?? WEEKLY_LOG;

  return useMemo(() => {
    const locations = includedLocations(filter);
    const locationSet = new Set(locations);

    // reviewCount / reactieratio / extremes only trust live numbers when
    // EVERY included location has the complete v4 history — otherwise the
    // aggregate would silently blend a complete real count for one
    // location with a mock placeholder for another, which is worse than
    // being honestly mock everywhere.
    const statsAreLive =
      allBusinessReviews != null &&
      locations.length > 0 &&
      locations.every((id) => allBusinessReviews[id] != null);

    // Best single source per location: complete v4 history > the ≤14-day
    // v4 window (still useful if the full-history fetch happened to fail
    // for a location Google otherwise has data for) > Places > mock. Used
    // for everything below except avgScore, which deliberately stays
    // sourced from Places' true current rating regardless of period (see
    // avgScore below).
    function reviewsForLocation(id: LocationId): Review[] {
      const full = allBusinessReviews?.[id];
      if (full) return businessReviewsFor(id, full);
      const recent = liveBusinessReviews?.[id];
      if (recent) return businessReviewsFor(id, recent);
      const places = livePlaces?.[id];
      if (places) return liveReviewsFor(id, places);
      return REVIEWS.filter((r) => r.location === id);
    }

    const combinedReviews = locations.flatMap(reviewsForLocation);
    const previousDateRange = previousRange(dateRange);

    const periodReviews = combinedReviews
      .filter((r) => isWithinRange(dateFromReview(r), dateRange))
      .sort((a, b) => a.daysAgo - b.daysAgo);
    const previousPeriodReviews = combinedReviews.filter((r) =>
      isWithinRange(dateFromReview(r), previousDateRange),
    );

    const reviews = periodReviews.slice(0, FEED_DISPLAY_CAP);
    const criticalFeedReviews = periodReviews
      .filter((r) => r.rating <= 2)
      .slice(0, CRITICAL_FEED_DISPLAY_CAP);

    // avgScore is Google's true current aggregate rating (Places), not
    // something scoped to the selected period — there's no "average
    // score in March" concept to show here, just the real published
    // number. Falls back to an all-time mock average with no live source.
    const liveRatings = livePlaces
      ? locations
          .map((id) => livePlaces[id])
          .filter((p): p is LivePlaceSummary => Boolean(p && p.rating !== null))
      : [];
    const avgScoreIsLive = livePlaces != null && liveRatings.length > 0;

    const avgScore = avgScoreIsLive
      ? liveRatings.reduce((sum, p) => sum + p.rating! * p.userRatingCount, 0) /
        liveRatings.reduce((sum, p) => sum + p.userRatingCount, 0)
      : (() => {
          const mockAll = REVIEWS.filter((r) => locationSet.has(r.location));
          return mockAll.length > 0
            ? mockAll.reduce((sum, r) => sum + r.rating, 0) / mockAll.length
            : 0;
        })();

    const avgScoreReviewCount = liveRatings.reduce(
      (sum, p) => sum + p.userRatingCount,
      0,
    );

    const previousAvgScore =
      locations.reduce((sum, id) => sum + PREVIOUS_WEEK_AVG_SCORE[id], 0) /
      locations.length;

    const reviewCount = periodReviews.length;
    const criticalReviews = periodReviews.filter((r) => r.rating <= 2);
    const topRatedCount = periodReviews.filter((r) => r.rating === 5).length;

    // The curated PREVIOUS_WEEK_* mock constants only model "the week
    // before" — a meaningful baseline exclusively for the default 7-day
    // preset. Any other preset in mock-only mode falls back to the same
    // period-filtering logic applied to the (small, ~week-old) mock set,
    // which usually comes up empty — an honest "nothing to compare
    // against" rather than a baseline that was never modelled for that
    // range.
    const useMockWeekBaseline = !statsAreLive && dateRange.preset === "7d";

    const previousReviewCount = statsAreLive
      ? previousPeriodReviews.length
      : useMockWeekBaseline
        ? sumByLocation(PREVIOUS_WEEK_REVIEW_COUNT, locations)
        : previousPeriodReviews.length;
    const previousTopRatedCount = statsAreLive
      ? previousPeriodReviews.filter((r) => r.rating === 5).length
      : useMockWeekBaseline
        ? sumByLocation(PREVIOUS_WEEK_TOP_RATED_COUNT, locations)
        : previousPeriodReviews.filter((r) => r.rating === 5).length;
    const previousCriticalCount = statsAreLive
      ? previousPeriodReviews.filter((r) => r.rating <= 2).length
      : useMockWeekBaseline
        ? sumByLocation(PREVIOUS_WEEK_CRITICAL_COUNT, locations)
        : previousPeriodReviews.filter((r) => r.rating <= 2).length;

    // Reactieratio scoped to critical reviews specifically — the number
    // that actually matters operationally (did we respond to the reviews
    // that need damage control), not the response rate across all reviews.
    const criticalRespondedCount = criticalReviews.filter((r) => r.responded).length;
    const criticalResponseRatio =
      criticalReviews.length > 0
        ? (criticalRespondedCount / criticalReviews.length) * 100
        : 0;
    const openCriticalReviews = criticalReviews
      .filter((r) => !r.responded)
      .sort((a, b) => a.daysAgo - b.daysAgo);

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
      periodReviews,
      criticalFeedReviews,
      avgScore,
      avgScoreIsLive,
      avgScoreReviewCount,
      avgScoreDelta: avgScore - previousAvgScore,
      reviewCount,
      reviewCountDelta: reviewCount - previousReviewCount,
      statsAreLive,
      criticalCount: criticalReviews.length,
      criticalCountDelta: criticalReviews.length - previousCriticalCount,
      oldestCriticalDaysAgo: criticalReviews.length
        ? Math.max(...criticalReviews.map((r) => r.daysAgo))
        : 0,
      topRatedCount,
      topRatedCountDelta: topRatedCount - previousTopRatedCount,
      criticalResponseRatio,
      openCriticalReviews,
      reviewGrowthSeries,
      reviewGrowthTotal,
      reviewGrowthDeltaPct,
      logEntries,
      logEntryCount: logEntries.length,
      logWeekCount: distinctWeeks.size,
    };
  }, [
    filter,
    dateRange,
    reviewGrowthSource,
    livePlaces,
    weeklyLogSource,
    liveBusinessReviews,
    allBusinessReviews,
  ]);
}
