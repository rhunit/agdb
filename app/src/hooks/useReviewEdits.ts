import { useEffect, useState } from "react";
import { fetchReviewEdits, hasLiveBackend, type ReviewEdit } from "../lib/api";

interface UseReviewEditsResult {
  edits: ReviewEdit[] | null;
  loading: boolean;
}

/** The server-detected list of reviews that changed text/rating after we'd
 * already seen them once — see server/src/reviewHistoryStore.ts for why
 * this can only ever start from whenever that backend first ran. */
export function useReviewEdits(enabled: boolean): UseReviewEditsResult {
  const [edits, setEdits] = useState<ReviewEdit[] | null>(null);

  useEffect(() => {
    if (!enabled || !hasLiveBackend() || edits !== null) return;
    let cancelled = false;
    fetchReviewEdits().then((result) => {
      if (!cancelled) setEdits(result);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, edits]);

  return { edits, loading: enabled && hasLiveBackend() && edits === null };
}
