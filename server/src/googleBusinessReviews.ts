import type { OAuth2Client } from "google-auth-library";
import type { DiscoveredLocation, InternalLocationId } from "./googleBusinessProfile.js";

// Review content (text, rating, reply status) isn't available through any
// of the modern Business Profile APIs — only through the legacy "Google My
// Business API v4" (mybusiness.googleapis.com/v4). That API has no public
// discovery document anymore (removed from Google's directory), so it
// can't be called through the typed googleapis client the rest of this
// file uses — it's a raw authenticated HTTPS request instead. Untested
// against real production access as of writing: a 403/404 here most
// likely means this legacy product needs enabling separately from the
// newer Business Profile API approval that unlocked everything else.

interface GbpStarRating {
  starRating?: "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE";
}

interface GbpReview {
  reviewId: string;
  reviewer?: { displayName?: string };
  starRating?: GbpStarRating["starRating"];
  comment?: string;
  createTime?: string;
  updateTime?: string;
  reviewReply?: { comment?: string; updateTime?: string };
}

interface GbpReviewsListResponse {
  reviews?: GbpReview[];
  averageRating?: number;
  totalReviewCount?: number;
  nextPageToken?: string;
}

const STAR_MAP: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

export interface BusinessReview {
  id: string;
  reviewer: string;
  rating: number;
  text: string;
  createTime: string | null;
  updateTime: string | null;
  responded: boolean;
  responseTime: string | null;
}

/** Lists reviews for one location, newest-updated first. `maxPages` bounds
 * how far pagination goes — unbounded (the default) walks the complete
 * history, which is fine for a one-off diagnostic call but wasteful for
 * every dashboard load, where only the last week or two ever matters. */
export async function listBusinessReviews(
  auth: OAuth2Client,
  accountName: string,
  googleLocationId: string,
  maxPages = Infinity,
): Promise<BusinessReview[]> {
  const { token } = await auth.getAccessToken();
  if (!token) throw new Error("No access token available");

  const reviews: BusinessReview[] = [];
  let pageToken: string | undefined;
  let pages = 0;

  do {
    const url = new URL(
      `https://mybusiness.googleapis.com/v4/${accountName}/${googleLocationId}/reviews`,
    );
    url.searchParams.set("orderBy", "updateTime desc");
    url.searchParams.set("pageSize", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(
        `Business Profile reviews request failed: ${res.status} ${await res.text()}`,
      );
    }
    const data = (await res.json()) as GbpReviewsListResponse;
    pages++;

    for (const r of data.reviews ?? []) {
      reviews.push({
        id: r.reviewId,
        reviewer: r.reviewer?.displayName ?? "Anoniem",
        rating: r.starRating ? (STAR_MAP[r.starRating] ?? 0) : 0,
        text: r.comment ?? "",
        createTime: r.createTime ?? null,
        updateTime: r.updateTime ?? null,
        responded: Boolean(r.reviewReply),
        responseTime: r.reviewReply?.updateTime ?? null,
      });
    }
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken && pages < maxPages);

  return reviews;
}

/** Reviews from the last `withinDays` for every location we have a
 * matched internal id for — the live source for "Nieuwe reviews deze
 * week", reactieratio, and the 5★/1–2★ split, none of which Places could
 * answer reliably (5-review cap, relevance ranking instead of recency, no
 * reply status at all). Two pages (100 reviews) per location is ample
 * margin for a single coffeeshop's weekly/biweekly review volume, so this
 * stays cheap even though the full history can run into the hundreds.
 *
 * Fetches are isolated per location (Promise.allSettled, not
 * Promise.all): one location erroring — a quota hiccup, a location not
 * yet matched on Google's side, anything — must not wipe out data for
 * every other location that fetched fine. A location that failed is just
 * absent from the result, same as one Google hasn't returned data for;
 * the frontend already treats "missing" as "fall back for this one". */
export async function getRecentBusinessReviews(
  auth: OAuth2Client,
  locations: DiscoveredLocation[],
  withinDays = 14,
): Promise<Partial<Record<InternalLocationId, BusinessReview[]>>> {
  const cutoff = Date.now() - withinDays * 24 * 60 * 60 * 1000;

  const settled = await Promise.allSettled(
    locations
      .filter((loc) => loc.internalId)
      .map(async (loc) => {
        const all = await listBusinessReviews(
          auth,
          loc.accountName,
          loc.googleLocationId,
          2,
        );
        const recent = all.filter(
          (r) => r.createTime && new Date(r.createTime).getTime() >= cutoff,
        );
        return [loc.internalId as InternalLocationId, recent] as const;
      }),
  );

  const out: Partial<Record<InternalLocationId, BusinessReview[]>> = {};
  for (const result of settled) {
    if (result.status === "fulfilled") {
      const [id, recent] = result.value;
      out[id] = recent;
    } else {
      console.error("getRecentBusinessReviews: one location failed:", result.reason);
    }
  }
  return out;
}
