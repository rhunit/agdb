import { useEffect, useSyncExternalStore } from "react";
import { fetchReplyLog, type ReplyLogEntry } from "./api";
import { trackLoad, useRefreshState } from "./refresh";

// The latest dashboard reply per review (who and when), shared by every
// review list — fetched once per page load and again on "Vernieuwen", and
// updated in place when someone sends a reply so it shows without a reload.
let byReview = new Map<string, ReplyLogEntry>();
let fetchedForToken = -1;
const listeners = new Set<() => void>();

function emit() {
  byReview = new Map(byReview);
  for (const l of listeners) l();
}

export function addReplyLogEntry(entry: ReplyLogEntry) {
  const current = byReview.get(entry.reviewId);
  if (!current || current.repliedAt < entry.repliedAt) {
    byReview.set(entry.reviewId, entry);
    emit();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useReplyLog(): Map<string, ReplyLogEntry> {
  const { token } = useRefreshState();
  useEffect(() => {
    if (fetchedForToken === token) return;
    fetchedForToken = token;
    trackLoad(fetchReplyLog()).then((entries) => entries?.forEach(addReplyLogEntry));
  }, [token]);
  return useSyncExternalStore(subscribe, () => byReview);
}
