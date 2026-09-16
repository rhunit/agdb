import { useCallback, useEffect, useState } from "react";
import {
  fetchLiveWeeklyLog,
  hasLiveBackend,
  submitWeeklyLogEntry,
  type NewWeeklyLogEntry,
} from "../lib/api";
import type { WeeklyLogEntry } from "../types";

interface UseWeeklyLogResult {
  entries: WeeklyLogEntry[] | null;
  isLive: boolean;
  submitting: boolean;
  submitError: string | null;
  submit: (input: NewWeeklyLogEntry) => Promise<boolean>;
}

/** Fetches the real, persisted weekly log when a backend is configured,
 * and lets the form append to it. Falls back to null (caller uses mock,
 * read-only) with zero config or on any failure. */
export function useWeeklyLog(): UseWeeklyLogResult {
  const [entries, setEntries] = useState<WeeklyLogEntry[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!hasLiveBackend()) return;
    fetchLiveWeeklyLog().then(setEntries);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = useCallback(
    async (input: NewWeeklyLogEntry) => {
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
    },
    [],
  );

  return { entries, isLive: entries !== null, submitting, submitError, submit };
}
