import { useEffect, useState } from "react";
import { fetchRemovedReviews, hasLiveBackend, type RemovedReview } from "../lib/api";

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
  const [settled, setSettled] = useState(false);
  const [removed, setRemoved] = useState<RemovedReview[] | null>(null);

  useEffect(() => {
    if (!enabled || !hasLiveBackend() || settled) return;
    let cancelled = false;
    fetchRemovedReviews().then((result) => {
      if (cancelled) return;
      setRemoved(result);
      setSettled(true);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, settled]);

  return {
    removed,
    loading: enabled && hasLiveBackend() && !settled,
    failed: settled && removed === null,
  };
}
