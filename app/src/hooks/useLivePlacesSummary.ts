import { fetchLivePlacesSummary, type LivePlaceSummary } from "../lib/api";
import type { LocationId } from "../types";
import { useLiveResource } from "./useLiveResource";

type PlacesSummaryMap = Partial<Record<LocationId, LivePlaceSummary>>;

interface LivePlacesState {
  data: PlacesSummaryMap | null;
  isLive: boolean;
  /** True only while a live backend is configured and this fetch hasn't
   * resolved yet — always false in mock-only mode, since there's nothing
   * to wait for there. */
  loading: boolean;
  /** True once the fetch finished without data — the request failed
   * (see ../lib/apiFailures for why), as opposed to still loading. */
  failed: boolean;
}

/** Interim live data source (average rating, total review count, a few
 * public reviews) via the Places API — works without the Business Profile
 * OAuth connection. Falls back to null (caller uses mock) with zero config
 * or on any failure. */
export function useLivePlacesSummary(): LivePlacesState {
  const { data, loading, failed } = useLiveResource(fetchLivePlacesSummary);
  return { data, isLive: data !== null, loading, failed };
}
