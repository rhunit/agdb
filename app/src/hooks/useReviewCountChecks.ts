import { useEffect, useState } from "react";
import {
  fetchReviewCountChecks,
  hasLiveBackend,
  type ReviewCountCheck,
} from "../lib/api";

interface UseReviewCountChecksResult {
  checks: ReviewCountCheck[] | null;
  loading: boolean;
}

/** Google's own reported review total per location vs how many we
 * actually received — see lib/api.ts's ReviewCountCheck for why a gap
 * here can reveal a removal from before this backend started watching,
 * unlike the snapshot-based edit/removal tracking. */
export function useReviewCountChecks(enabled: boolean): UseReviewCountChecksResult {
  const [checks, setChecks] = useState<ReviewCountCheck[] | null>(null);

  useEffect(() => {
    if (!enabled || !hasLiveBackend() || checks !== null) return;
    let cancelled = false;
    fetchReviewCountChecks().then((result) => {
      if (!cancelled) setChecks(result);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, checks]);

  return { checks, loading: enabled && hasLiveBackend() && checks === null };
}
