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

/** What actually changed in one edit, in plain Dutch — so a text-only
 * edit doesn't read as a meaningless "5★ → 5★". */
export function describeEditChange(edit: ReviewEdit): string {
  const parts: string[] = [];
  if (edit.previousRating !== edit.newRating) {
    parts.push(`score ${edit.previousRating}★ → ${edit.newRating}★`);
  }
  if (edit.previousText !== edit.newText) {
    if (!edit.previousText.trim()) parts.push("tekst toegevoegd");
    else if (!edit.newText.trim()) parts.push("tekst verwijderd");
    else parts.push("tekst aangepast");
  }
  const sentence = parts.join(" en ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
