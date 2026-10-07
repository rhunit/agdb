import { useEffect, useState } from "react";
import {
  fetchLiveBusinessReviews,
  hasLiveBackend,
  type LiveBusinessReview,
} from "../lib/api";
import type { LocationId } from "../types";

type BusinessReviewsMap = Partial<Record<LocationId, LiveBusinessReview[]>>;

interface LiveBusinessReviewsState {
  data: BusinessReviewsMap | null;
  isLive: boolean;
}

/** Fetches the last two weeks of reviews per location via the legacy v4
 * Business Profile API — complete and correctly ordered, unlike the
 * Places-based summary's 5-review relevance-ranked cap. Falls back to
 * null (caller uses Places data or mock) with zero config, no Google
 * connection yet, or on any failure. */
export function useLiveBusinessReviews(): LiveBusinessReviewsState {
  const [data, setData] = useState<BusinessReviewsMap | null>(null);

  useEffect(() => {
    if (!hasLiveBackend()) return;
    let cancelled = false;
    fetchLiveBusinessReviews().then((result) => {
      if (!cancelled) setData(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, isLive: data !== null };
}
