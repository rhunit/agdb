import { fetchRemovedReviews, type RemovedReview } from "../lib/api";
import { useLiveResource } from "./useLiveResource";

interface UseRemovedReviewsResult {
  removed: RemovedReview[] | null;
  loading: boolean;
  /** True once the fetch finished without data — the request failed
   * (see ../lib/apiFailures for why), as opposed to still loading. */
  failed: boolean;
}

/** The server-detected list of reviews that were present on an earlier
 * fetch and are simply gone from a later one — see
 * server/src/reviewHistoryStore.ts for why this can't say who removed
 * them or recover anything from before the backend started watching. */
export function useRemovedReviews(enabled: boolean): UseRemovedReviewsResult {
  const { data, loading, failed } = useLiveResource(fetchRemovedReviews, enabled);
  return { removed: data, loading, failed };
}
