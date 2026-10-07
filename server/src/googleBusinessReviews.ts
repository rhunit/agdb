import type { OAuth2Client } from "google-auth-library";

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

/** Lists every review for one location, newest-updated first, following
 * pagination to completion — unlike the Places API, there's no 5-review
 * cap here. accountName/googleLocationId come from DiscoveredLocation. */
export async function listBusinessReviews(
  auth: OAuth2Client,
  accountName: string,
  googleLocationId: string,
): Promise<BusinessReview[]> {
  const { token } = await auth.getAccessToken();
  if (!token) throw new Error("No access token available");

  const reviews: BusinessReview[] = [];
  let pageToken: string | undefined;

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
  } while (pageToken);

  return reviews;
}
