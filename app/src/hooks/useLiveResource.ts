import { useEffect, useState } from "react";
import { hasLiveBackend } from "../lib/api";
import { trackLoad, useRefreshState } from "../lib/refresh";

interface ResourceState<T> {
  data: T | null;
  settled: boolean;
  /** The refresh token this data was fetched for. */
  token: number;
}

/** Shared fetch-once-then-on-refresh logic behind the live-data hooks.
 * `enabled` defers the fetch until a page actually needs it (and a fetch
 * cancelled by disabling restarts on re-enable). On "Vernieuwen" the data
 * already on screen stays until the new data arrives — and stays put if
 * the refetch fails, with the error banner saying why (see ../lib/api). */
export function useLiveResource<T>(fetcher: () => Promise<T | null>, enabled = true) {
  const { token } = useRefreshState();
  const [state, setState] = useState<ResourceState<T>>({ data: null, settled: false, token: -1 });

  useEffect(() => {
    if (!enabled || !hasLiveBackend() || state.token === token) return;
    let cancelled = false;
    trackLoad(fetcher()).then((result) => {
      if (cancelled) return;
      setState((prev) => ({ data: result ?? prev.data, settled: true, token }));
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, token, state.token, fetcher]);

  return {
    data: state.data,
    setData: (update: (prev: T | null) => T | null) =>
      setState((prev) => ({ ...prev, data: update(prev.data) })),
    loading: enabled && hasLiveBackend() && !state.settled,
    /** True once a fetch finished without any data — the request failed
     * (see ../lib/apiFailures for why), as opposed to still loading. */
    failed: state.settled && state.data === null,
  };
}
