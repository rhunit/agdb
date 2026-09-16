import { useEffect, useState } from "react";
import { fetchLiveReviewGrowth, hasLiveBackend } from "../lib/api";
import type { ReviewGrowthWeek } from "../types";

interface LiveReviewGrowthState {
  data: ReviewGrowthWeek[] | null;
  isLive: boolean;
}

/** Fetches real week-over-week review-growth data from the backend when
 * one is configured (VITE_API_BASE_URL). Falls back to null (caller uses
 * mock data) if no backend is configured, unreachable, or too few weeks
 * of history have been recorded yet. */
export function useLivePlacesReviewGrowth(): LiveReviewGrowthState {
  const [data, setData] = useState<ReviewGrowthWeek[] | null>(null);

  useEffect(() => {
    if (!hasLiveBackend()) return;
    let cancelled = false;
    fetchLiveReviewGrowth().then((result) => {
      if (!cancelled) setData(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, isLive: data !== null && data.length > 0 };
}
