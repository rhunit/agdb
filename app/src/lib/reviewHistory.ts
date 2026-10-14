import type { ReviewEdit } from "./api";

export interface OriginalVersion {
  rating: number;
  text: string;
  /** When the most recent of the recorded edits was detected. */
  editedAt: string;
}

/** The earliest known prior state for a review — if it's been edited more
 * than once, this reconstructs the true original (what it said before
 * the FIRST recorded change), not just what it looked like right before
 * the most recent one. */
export function originalVersionFor(
  googleReviewId: string,
  edits: ReviewEdit[] | null,
): OriginalVersion | undefined {
  if (!edits) return undefined;
  const matches = edits.filter((e) => e.reviewId === googleReviewId);
  if (matches.length === 0) return undefined;

  const earliest = matches.reduce((a, b) => (a.detectedAt < b.detectedAt ? a : b));
  const latest = matches.reduce((a, b) => (a.detectedAt > b.detectedAt ? a : b));

  return {
    rating: earliest.previousRating,
    text: earliest.previousText,
    editedAt: latest.detectedAt,
  };
}
