import { useEffect, useState } from "react";
import { fetchLiveSearchViews, hasLiveBackend } from "../lib/api";
import type { SearchViewsWeek } from "../types";

interface LiveSearchViewsState {
  data: SearchViewsWeek[] | null;
  loading: boolean;
  isLive: boolean;
}

/** Fetches real search-views data from the backend when one is configured
 * (VITE_API_BASE_URL). Falls back to null (caller uses mock data) if no
 * backend is configured, unreachable, or Google isn't connected yet. */
export function useLiveSearchViews(): LiveSearchViewsState {
  const [data, setData] = useState<SearchViewsWeek[] | null>(null);
  const [loading, setLoading] = useState(hasLiveBackend());

  useEffect(() => {
    if (!hasLiveBackend()) return;
    let cancelled = false;
    setLoading(true);
    fetchLiveSearchViews().then((result) => {
      if (cancelled) return;
      setData(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, isLive: data !== null };
}
