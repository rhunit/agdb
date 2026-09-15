import { useEffect, useState } from "react";
import { fetchLivePlacesSummary, hasLiveBackend, type LivePlaceSummary } from "../lib/api";
import type { LocationId } from "../types";

type PlacesSummaryMap = Record<LocationId, LivePlaceSummary>;

interface LivePlacesState {
  data: PlacesSummaryMap | null;
  isLive: boolean;
}

/** Interim live data source (average rating, total review count, a few
 * public reviews) via the Places API — works without the Business Profile
 * OAuth connection. Falls back to null (caller uses mock) with zero config
 * or on any failure. */
export function useLivePlacesSummary(): LivePlacesState {
  const [data, setData] = useState<PlacesSummaryMap | null>(null);

  useEffect(() => {
    if (!hasLiveBackend()) return;
    let cancelled = false;
    fetchLivePlacesSummary().then((result) => {
      if (!cancelled) setData(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, isLive: data !== null };
}
