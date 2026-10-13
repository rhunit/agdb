import type { Review } from "../types";

export interface RatingStats {
  counts: Record<1 | 2 | 3 | 4 | 5, number>;
  total: number;
  /** Share of 4-5★ reviews — the only sentiment signal used here is the
   * star rating itself, never a guess at the review text's tone. */
  positivePct: number;
  notPositivePct: number;
}

export function computeRatingStats(reviews: Review[]): RatingStats {
  const counts: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of reviews) counts[r.rating]++;

  const total = reviews.length;
  const positive = counts[4] + counts[5];

  return {
    counts,
    total,
    positivePct: total > 0 ? (positive / total) * 100 : 0,
    notPositivePct: total > 0 ? ((total - positive) / total) * 100 : 0,
  };
}
