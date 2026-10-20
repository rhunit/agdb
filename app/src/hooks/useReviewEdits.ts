import { useEffect, useState } from "react";
import { fetchReviewEdits, hasLiveBackend, type ReviewEdit } from "../lib/api";

interface UseReviewEditsResult {
  edits: ReviewEdit[] | null;
  loading: boolean;
  /** True once the fetch finished without data — the request failed
   * (see ../lib/apiFailures for why), as opposed to still loading. */
  failed: boolean;
}

/** The server-detected list of reviews that changed text/rating after we'd
 * already seen them once — see server/src/reviewHistoryStore.ts for why
 * this can only ever start from whenever that backend first ran. */
export function useReviewEdits(enabled: boolean): UseReviewEditsResult {
  const [settled, setSettled] = useState(false);
  const [edits, setEdits] = useState<ReviewEdit[] | null>(null);

  useEffect(() => {
    if (!enabled || !hasLiveBackend() || settled) return;
    let cancelled = false;
    fetchReviewEdits().then((result) => {
      if (cancelled) return;
      setEdits(result);
      setSettled(true);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, settled]);

  return {
    edits,
    loading: enabled && hasLiveBackend() && !settled,
    failed: settled && edits === null,
  };
}
