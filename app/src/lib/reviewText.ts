export interface SplitReviewText {
  /** What the reviewer actually wrote. Empty for a stars-only review. */
  original: string;
  /** Google's machine translation, when the review wasn't in the
   * profile's language — null otherwise. */
  translation: string | null;
}

// Google returns a review that isn't in the profile's language as one
// string: "(Translated by Google) <translation>\n\n(Original)\n<original>".
// Split it so the original can lead and the translation follow, clearly
// labelled, instead of one run-on line with both markers in it.
const TRANSLATED =
  /^\((?:Translated by Google|Vertaald door Google)\)\s*([\s\S]*?)\s*\((?:Original|Origineel)\)\s*([\s\S]*)$/i;

export function splitReviewText(text: string): SplitReviewText {
  const trimmed = text.trim();
  const match = trimmed.match(TRANSLATED);
  if (!match) return { original: trimmed, translation: null };
  return { original: match[2].trim(), translation: match[1].trim() || null };
}
