import {
  fetchLiveAllBusinessReviews,
  type LiveBusinessReview,
} from "../lib/api";
import type { LocationId } from "../types";
import { useLiveResource } from "./useLiveResource";

type BusinessReviewsMap = Partial<Record<LocationId, LiveBusinessReview[]>>;

interface LiveAllBusinessReviewsState {
  data: BusinessReviewsMap | null;
  isLive: boolean;
  loading: boolean;
  /** True once the fetch finished without data — the request failed
   * (see ../lib/apiFailures for why), as opposed to still loading. */
  failed: boolean;
}

/** Fetches the complete review history per location (not just the recent
 * window useLiveBusinessReviews uses for the dashboard) — backs the
 * "Alle reviews" page. Only fetches once `enabled` (the page is actually
 * open) — this pulls the full history for every location, which is a
 * much heavier request than the rest of the dashboard needs, so it
 * shouldn't fire on every load just because the person is on some other
 * tab. Falls back to null with zero config, no Google connection yet, or
 * on any failure; the page then shows an honest empty state rather than
 * mock data, since there's no plausible mock for "every review ever". */
export function useLiveAllBusinessReviews(enabled: boolean): LiveAllBusinessReviewsState {
  const { data, loading, failed } = useLiveResource(fetchLiveAllBusinessReviews, enabled);
  return { data, isLive: data !== null, loading, failed };
}
