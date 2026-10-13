import { useMemo } from "react";
import { LOCATIONS, REVIEWS } from "../data/mockData";
import type { LocationId } from "../types";
import { useLivePlacesSummary } from "./useLivePlacesSummary";

export interface LocationSummary {
  id: LocationId;
  name: string;
  avgScore: number;
  avgScoreIsLive: boolean;
  reviewCount: number;
}

interface LocationSummariesState {
  summaries: LocationSummary[];
  loading: boolean;
}

/** One row per location for the "Locaties" overview cards — average score
 * (live if Places has a rating for it, mock otherwise, same fallback rule
 * as the main dashboard) and this-week review count (always mock, for the
 * same reliability reason reviewCount stays mock on the dashboard). */
export function useLocationSummaries(): LocationSummariesState {
  const livePlaces = useLivePlacesSummary();

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
      return {
        id: loc.id,
        name: loc.name,
        avgScore,
        avgScoreIsLive,
        reviewCount: mockReviews.length,
      };
    });
  }, [livePlaces.data]);

  return { summaries, loading: livePlaces.loading };
}
