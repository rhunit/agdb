import { fetchLiveReviewGrowth } from "../lib/api";
import type { ReviewGrowthWeek } from "../types";
import { useLiveResource } from "./useLiveResource";

interface LiveReviewGrowthState {
  data: ReviewGrowthWeek[] | null;
  isLive: boolean;
  loading: boolean;
  /** True once the fetch finished without data — the request failed
   * (see ../lib/apiFailures for why), as opposed to still loading. */
  failed: boolean;
}

/** Fetches real week-over-week review-growth data from the backend when
 * one is configured (VITE_API_BASE_URL). Falls back to null (caller uses
 * mock data) if no backend is configured, unreachable, or too few weeks
 * of history have been recorded yet. */
export function useLivePlacesReviewGrowth(): LiveReviewGrowthState {
  const { data, loading, failed } = useLiveResource(fetchLiveReviewGrowth);
  return { data, isLive: data !== null && data.length > 0, loading, failed };
}
