import { useEffect, useState } from "react";
import { fetchRemovedReviews, hasLiveBackend, type RemovedReview } from "../lib/api";

interface UseRemovedReviewsResult {
  removed: RemovedReview[] | null;
  loading: boolean;
}

/** The server-detected list of reviews that were present on an earlier
 * fetch and are simply gone from a later one — see
 * server/src/reviewHistoryStore.ts for why this can't say who removed
 * them or recover anything from before the backend started watching. */
export function useRemovedReviews(enabled: boolean): UseRemovedReviewsResult {
  const [removed, setRemoved] = useState<RemovedReview[] | null>(null);

  useEffect(() => {
    if (!enabled || !hasLiveBackend() || removed !== null) return;
    let cancelled = false;
    fetchRemovedReviews().then((result) => {
      if (!cancelled) setRemoved(result);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, removed]);

  return { removed, loading: enabled && hasLiveBackend() && removed === null };
}
