export type LocationId = "centrum" | "oost" | "depijp" | "boerejongens" | "almere";

export type ReviewSource = "organisch" | "qr" | "smoke" | "onbekend";
export type Confidence = "bevestigd" | "vermoedelijk" | "onbekend";
export type LogType = "smoke" | "qr";

export interface Location {
  id: LocationId;
  name: string;
}

export interface Review {
  id: string;
  location: LocationId;
  reviewer: string;
  initials: string;
  rating: 1 | 2 | 3 | 4 | 5;
  snippet: string;
  source: ReviewSource;
  confidence: Confidence;
  daysAgo: number;
  /** Exact moment the review was posted (ISO 8601), straight from Google —
   * only set for live data. Mock reviews only carry a daysAgo estimate,
   * so they're left undefined rather than making up a time of day. */
  publishedAt?: string;
  responded: boolean;
  /** Google's own review id (unprefixed) — only set for live reviews.
   * Replying posts straight to Google, so this is the only safe way to
   * gate "can this review actually be replied to" without the reply
   * button ever appearing on fabricated mock data. */
  googleReviewId?: string;
  /** The owner reply's text, straight from Google — only set when
   * `responded` is true and the review is live. */
  replyText?: string;
  /** When the owner reply was posted/last edited, straight from Google —
   * only set when `responded` is true and the review is live. Powers the
   * "Recent beantwoord" sort on "Alle reviews". */
  responseTime?: string;
  /** Set only for a review reconstructed from a detected removal (see
   * RemovedReview / reviewHistoryStore) — the moment our own snapshot
   * diffing noticed it was gone, not something Google reports directly.
   * When set, the review no longer exists on Google: no reply is
   * possible and `responded` is meaningless. */
  removedAt?: string;
}

export interface WeeklyLogEntry {
  id: string;
  week: string;
  location: LocationId;
  type: LogType;
  submitter: string;
  timestamp: string;
  note: string;
}

export interface SearchViewsWeek {
  week: string;
  centrum: number;
  oost: number;
  depijp: number;
  boerejongens: number;
  almere: number;
}

/** New reviews per location per week — same shape as SearchViewsWeek, kept
 * as a separate type since it's a different real-world metric (review
 * count deltas vs search impressions). */
export interface ReviewGrowthWeek {
  week: string;
  centrum: number;
  oost: number;
  depijp: number;
  boerejongens: number;
  almere: number;
}
