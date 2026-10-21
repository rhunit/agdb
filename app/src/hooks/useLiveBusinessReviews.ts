import {
  fetchLiveBusinessReviews,
  type LiveBusinessReview,
} from "../lib/api";
import type { LocationId } from "../types";
import { useLiveResource } from "./useLiveResource";

type BusinessReviewsMap = Partial<Record<LocationId, LiveBusinessReview[]>>;

interface LiveBusinessReviewsState {
  data: BusinessReviewsMap | null;
  isLive: boolean;
  loading: boolean;
  /** True once the fetch finished without data — the request failed
   * (see ../lib/apiFailures for why), as opposed to still loading. */
  failed: boolean;
}

/** Fetches the last two weeks of reviews per location via the legacy v4
 * Business Profile API — complete and correctly ordered, unlike the
 * Places-based summary's 5-review relevance-ranked cap. Falls back to
 * null (caller uses Places data or mock) with zero config, no Google
 * connection yet, or on any failure. */
export function useLiveBusinessReviews(): LiveBusinessReviewsState {
  const { data, loading, failed } = useLiveResource(fetchLiveBusinessReviews);
  return { data, isLive: data !== null, loading, failed };
}
