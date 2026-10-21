import { fetchReviewEdits, type ReviewEdit } from "../lib/api";
import { useLiveResource } from "./useLiveResource";

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
  const { data, loading, failed } = useLiveResource(fetchReviewEdits, enabled);
  return { edits: data, loading, failed };
}
