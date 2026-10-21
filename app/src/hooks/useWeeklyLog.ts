import { useState } from "react";
import {
  fetchLiveWeeklyLog,
  submitWeeklyLogEntry,
  type NewWeeklyLogEntry,
} from "../lib/api";
import type { WeeklyLogEntry } from "../types";
import { useLiveResource } from "./useLiveResource";

interface UseWeeklyLogResult {
  entries: WeeklyLogEntry[] | null;
  isLive: boolean;
  loading: boolean;
  /** True once the fetch finished without data — the request failed
   * (see ../lib/apiFailures for why), as opposed to still loading. */
  failed: boolean;
  submitting: boolean;
  submitError: string | null;
  submit: (input: NewWeeklyLogEntry) => Promise<boolean>;
}

/** Fetches the real, persisted weekly log when a backend is configured,
 * and lets the form append to it. Falls back to null (caller uses mock,
 * read-only) with zero config or on any failure. */
export function useWeeklyLog(): UseWeeklyLogResult {
  const { data: entries, setData: setEntries, loading, failed } = useLiveResource(fetchLiveWeeklyLog);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function submit(input: NewWeeklyLogEntry) {
    setSubmitting(true);
    setSubmitError(null);
    const result = await submitWeeklyLogEntry(input);
    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.error);
      return false;
    }
    setEntries((prev) => (prev ? [...prev, result.entry] : [result.entry]));
    return true;
  }

  return {
    entries,
    isLive: entries !== null,
    loading,
    failed,
    submitting,
    submitError,
    submit,
  };
}
