import { useEffect, useSyncExternalStore } from "react";
import { fetchReplyLog, type ReplyLogEntry } from "./api";

// The latest dashboard reply per review (who and when), shared by every
// review list — fetched once per page load, and updated in place when
// someone sends a reply so it shows without a reload.
let byReview = new Map<string, ReplyLogEntry>();
let requested = false;
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
  useEffect(() => {
    if (requested) return;
    requested = true;
    fetchReplyLog().then((entries) => entries?.forEach(addReplyLogEntry));
  }, []);
  return useSyncExternalStore(subscribe, () => byReview);
}
