import { useMemo } from "react";
import {
  LOCATIONS,
  PREVIOUS_WEEK_AVG_SCORE,
  PREVIOUS_WEEK_REVIEW_COUNT,
  REVIEWS,
  SEARCH_VIEWS,
  WEEKLY_LOG,
} from "../data/mockData";
import type { LocationId } from "../types";

export type LocationFilter = LocationId | "all";

function includedLocations(filter: LocationFilter): LocationId[] {
  return filter === "all" ? LOCATIONS.map((l) => l.id) : [filter];
}

export function useDashboardData(filter: LocationFilter) {
  return useMemo(() => {
    const locations = includedLocations(filter);
    const locationSet = new Set(locations);

    const reviews = REVIEWS.filter((r) => locationSet.has(r.location)).sort(
      (a, b) => a.daysAgo - b.daysAgo,
    );

    const avgScore =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

    const previousAvgScore =
      locations.reduce((sum, id) => sum + PREVIOUS_WEEK_AVG_SCORE[id], 0) /
      locations.length;

    const respondedCount = reviews.filter((r) => r.responded).length;
    const openCount = reviews.length - respondedCount;
    const responseRatio =
      reviews.length > 0 ? (respondedCount / reviews.length) * 100 : 0;

    const previousReviewCount = locations.reduce(
      (sum, id) => sum + PREVIOUS_WEEK_REVIEW_COUNT[id],
      0,
    );

    const criticalReviews = reviews.filter((r) => r.rating <= 2);

    const searchViewsSeries = SEARCH_VIEWS.map((week) => ({
      week: week.week,
      total: locations.reduce((sum, id) => sum + week[id], 0),
      byLocation: Object.fromEntries(
        locations.map((id) => [id, week[id]]),
      ) as Record<LocationId, number>,
    }));

    const latestWeek = searchViewsSeries[searchViewsSeries.length - 1];
    const previousWeek = searchViewsSeries[searchViewsSeries.length - 2];
    const searchViewsTotal = latestWeek.total;
    const searchViewsDeltaPct =
      previousWeek && previousWeek.total > 0
        ? ((latestWeek.total - previousWeek.total) / previousWeek.total) * 100
        : 0;

    const logEntries = WEEKLY_LOG.filter((e) =>
      locationSet.has(e.location),
    ).sort((a, b) => (a.week < b.week ? 1 : a.week > b.week ? -1 : 0));

    const distinctWeeks = new Set(logEntries.map((e) => e.week));

    return {
      locations,
      reviews,
      avgScore,
      avgScoreDelta: avgScore - previousAvgScore,
      reviewCount: reviews.length,
      reviewCountDelta: reviews.length - previousReviewCount,
      responseRatio,
      openCount,
      criticalCount: criticalReviews.length,
      oldestCriticalDaysAgo: criticalReviews.length
        ? Math.max(...criticalReviews.map((r) => r.daysAgo))
        : 0,
      searchViewsSeries,
      searchViewsTotal,
      searchViewsDeltaPct,
      logEntries,
      logEntryCount: logEntries.length,
      logWeekCount: distinctWeeks.size,
    };
  }, [filter]);
}
