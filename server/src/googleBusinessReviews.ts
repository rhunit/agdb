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
  replyText: string | null;
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
  return (await listBusinessReviewsWithTotal(auth, accountName, googleLocationId, maxPages)).reviews;
}

export interface ReviewListing {
  reviews: BusinessReview[];
  /** Google's own count for the location, when it reports one. */
  totalReviewCount: number | null;
  /** Pagination stopped at maxPages with more pages left. */
  truncated: boolean;
}

async function listBusinessReviewsWithTotal(
  auth: OAuth2Client,
  accountName: string,
  googleLocationId: string,
  maxPages: number,
): Promise<ReviewListing> {
  const { token } = await auth.getAccessToken();
  if (!token) throw new Error("No access token available");

  const reviews: BusinessReview[] = [];
  let pageToken: string | undefined;
  let pages = 0;
  let totalReviewCount: number | null = null;

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
    if (typeof data.totalReviewCount === "number") totalReviewCount = data.totalReviewCount;

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
        replyText: r.reviewReply?.comment ?? null,
      });
    }
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken && pages < maxPages);

  return { reviews, totalReviewCount, truncated: Boolean(pageToken) };
}

/** Reviews from the last `withinDays` for every location we have a
 * matched internal id for — the live source for "Nieuwe reviews deze
 * week", reactieratio, and the 5★/1–2★ split, none of which Places could
 * answer reliably (5-review cap, relevance ranking instead of recency, no
 * reply status at all). Two pages (100 reviews) per location is ample
 * margin for a single coffeeshop's weekly/biweekly review volume, so this
 * stays cheap even though the full history can run into the hundreds.
 *
 * A review counts as "recent" when EITHER its createTime or its
 * updateTime falls in the window — not createTime alone. A review posted
 * well outside the window but edited (or freshly replied to) inside it
 * would otherwise be dropped before the frontend ever sees it, which is
 * exactly the kind of activity worth surfacing in the feed; Google's own
 * Business Profile UI does the same (it sorts/flags by last-updated, not
 * original post date). The weekly stats bucketing in useDashboardData
 * still keys off createTime specifically, so "nieuwe reviews deze week"
 * keeps meaning newly-posted, not newly-edited.
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
        const recent = all.filter((r) => {
          const created = r.createTime ? new Date(r.createTime).getTime() : 0;
          const updated = r.updateTime ? new Date(r.updateTime).getTime() : 0;
          return created >= cutoff || updated >= cutoff;
        });
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

/** Posts (or overwrites) the owner reply on one review — a PUT to Google's
 * reply sub-resource upserts it, so this doubles as "edit my reply" when
 * called again with new text. This writes directly to the public Google
 * listing: there's no draft/preview step on Google's side, only whatever
 * confirmation the caller adds before invoking this. */
export async function replyToReview(
  auth: OAuth2Client,
  accountName: string,
  googleLocationId: string,
  reviewId: string,
  comment: string,
): Promise<{ comment: string; updateTime: string | null }> {
  const { token } = await auth.getAccessToken();
  if (!token) throw new Error("No access token available");

  const res = await fetch(
    `https://mybusiness.googleapis.com/v4/${accountName}/${googleLocationId}/reviews/${reviewId}/reply`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ comment }),
    },
  );
  if (!res.ok) {
    throw new Error(
      `Review reply request failed: ${res.status} ${await res.text()}`,
    );
  }
  const data = (await res.json()) as { comment?: string; updateTime?: string };
  return { comment: data.comment ?? comment, updateTime: data.updateTime ?? null };
}

export interface AllBusinessReviews {
  reviews: Partial<Record<InternalLocationId, BusinessReview[]>>;
  /** Per location: whether this fetch is known to hold the location's
   * whole list. Google's v4 API sometimes serves an older or partial copy,
   * so a fetch with fewer reviews than Google's own total — or cut off at
   * the page limit — must not be read as "the missing ones were removed". */
  complete: Partial<Record<InternalLocationId, boolean>>;
}

/** The complete review history (not just a recent window) for every
 * location we have a matched internal id for — backs the "Alle reviews"
 * page, which is explicitly meant to be the full list rather than a
 * recency-capped feed. 40 pages (2,000 reviews) per location is a safety
 * bound against pagination running away, not an expected ceiling; hitting
 * it marks the fetch incomplete.
 *
 * Same per-location fault isolation as getRecentBusinessReviews — one
 * location erroring must not blank out the others. */
export async function getAllBusinessReviews(
  auth: OAuth2Client,
  locations: DiscoveredLocation[],
  maxPagesPerLocation = 40,
): Promise<AllBusinessReviews> {
  const settled = await Promise.allSettled(
    locations
      .filter((loc) => loc.internalId)
      .map(async (loc) => {
        const listing = await listBusinessReviewsWithTotal(
          auth,
          loc.accountName,
          loc.googleLocationId,
          maxPagesPerLocation,
        );
        return [loc.internalId as InternalLocationId, listing] as const;
      }),
  );

  const out: AllBusinessReviews = { reviews: {}, complete: {} };
  for (const result of settled) {
    if (result.status === "fulfilled") {
      const [id, listing] = result.value;
      out.reviews[id] = listing.reviews;
      const complete =
        !listing.truncated &&
        (listing.totalReviewCount === null || listing.reviews.length >= listing.totalReviewCount);
      out.complete[id] = complete;
      if (!complete) {
        console.warn(
          `getAllBusinessReviews: ${id} incomplete (${listing.reviews.length} of ` +
            `${listing.totalReviewCount ?? "?"}${listing.truncated ? ", page limit reached" : ""}) — ` +
            "removal detection skipped for this fetch",
        );
      }
    } else {
      console.error("getAllBusinessReviews: one location failed:", result.reason);
    }
  }
  return out;
}
