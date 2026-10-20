import { useMemo } from "react";
import { LOCATIONS, REVIEWS } from "../data/mockData";
import { businessReviewsFor } from "../lib/reviews";
import type { LocationId } from "../types";
import { useLiveBusinessReviews } from "./useLiveBusinessReviews";
import { useLivePlacesSummary } from "./useLivePlacesSummary";

export interface LocationSummary {
  id: LocationId;
  name: string;
  avgScore: number;
  avgScoreIsLive: boolean;
  reviewCount: number;
  reviewCountIsLive: boolean;
}

interface LocationSummariesState {
  summaries: LocationSummary[];
  loading: boolean;
  /** The review counts couldn't be fetched — show an error rather than
   * the mock fallback, which would look like real numbers. */
  failed: boolean;
}

/** One row per location for the "Locaties" overview cards — average score
 * (live if Places has a rating for it, mock otherwise, same fallback rule
 * as the main dashboard) and this week's review count (live via the same
 * v4 Business Profile source and ≤7-day window the dashboard's "Nieuwe
 * reviews" tile uses, per location, mock otherwise). */
export function useLocationSummaries(): LocationSummariesState {
  const livePlaces = useLivePlacesSummary();
  const liveBusinessReviews = useLiveBusinessReviews();

  const summaries = useMemo(() => {
    return LOCATIONS.map((loc) => {
      const live = livePlaces.data?.[loc.id];
      const mockReviews = REVIEWS.filter((r) => r.location === loc.id);
      const avgScoreIsLive = live?.rating != null;
      const avgScore = avgScoreIsLive
        ? live!.rating!
        : mockReviews.length > 0
          ? mockReviews.reduce((sum, r) => sum + r.rating, 0) / mockReviews.length
          : 0;

      const liveReviews = liveBusinessReviews.data?.[loc.id];
      const reviewCountIsLive = liveReviews != null;
      const reviewCount = reviewCountIsLive
        ? businessReviewsFor(loc.id, liveReviews).filter((r) => r.daysAgo <= 7).length
        : mockReviews.length;

      return {
        id: loc.id,
        name: loc.name,
        avgScore,
        avgScoreIsLive,
        reviewCount,
        reviewCountIsLive,
      };
    });
  }, [livePlaces.data, liveBusinessReviews.data]);

  return {
    summaries,
    loading: livePlaces.loading || liveBusinessReviews.loading,
    failed: liveBusinessReviews.failed,
  };
}
