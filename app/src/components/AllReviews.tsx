import { useEffect, useMemo, useState } from "react";
import { VISIBLE_LOCATION_IDS } from "../config";
import { LOCATIONS } from "../data/mockData";
import type { LiveBusinessReview } from "../lib/api";
import { daysAgoLabel, formatReviewTimestamp } from "../lib/format";
import { businessReviewsFor } from "../lib/reviews";
import { reviewMatchesTheme } from "../lib/reviewPatterns";
import type { LocationId, Review } from "../types";
import { StarRating } from "./badges";
import { LoadingState } from "./LoadingState";
import { ReplyForm } from "./ReplyForm";
import { ReviewPatterns } from "./ReviewPatterns";
import styles from "./AllReviews.module.css";

const LOCATION_NAME = new Map(LOCATIONS.map((l) => [l.id, l.name]));
const PAGE_SIZE = 25;
const RATINGS = [5, 4, 3, 2, 1] as const;

export type StatusFilter = "all" | "open" | "responded";

/** A request to jump straight into a specific filter combination (e.g.
 * from the status strip's "view the critical reviews" link). Passing a
 * new object — even with the same values — re-applies it, since the
 * person may want to re-trigger the jump after changing filters by hand. */
export interface AllReviewsFilterRequest {
  status: StatusFilter;
  ratings: number[];
}

interface AllReviewsProps {
  reviewsByLocation: Partial<Record<LocationId, LiveBusinessReview[]>> | null;
  isLive: boolean;
  loading: boolean;
  filterRequest?: AllReviewsFilterRequest | null;
}

export function AllReviews({
  reviewsByLocation,
  isLive,
  loading,
  filterRequest,
}: AllReviewsProps) {
  const [shown, setShown] = useState(PAGE_SIZE);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [ratingFilter, setRatingFilter] = useState<Set<number>>(new Set());
  const [activeTheme, setActiveTheme] = useState<string | null>(null);
  // Reviews replied to in this session, ahead of the next full refetch —
  // lets the status (and the reply text itself) show immediately after a
  // send succeeds, keyed by review id -> the text that was sent.
  const [repliedText, setRepliedText] = useState<Map<string, string>>(new Map());

  function isResponded(review: Review): boolean {
    return review.responded || repliedText.has(review.id);
  }

  function replyTextFor(review: Review): string | undefined {
    return repliedText.get(review.id) ?? review.replyText;
  }

  useEffect(() => {
    if (!filterRequest) return;
    setStatusFilter(filterRequest.status);
    setRatingFilter(new Set(filterRequest.ratings));
    setActiveTheme(null);
    setShown(PAGE_SIZE);
  }, [filterRequest]);

  const allReviews = useMemo(() => {
    if (!reviewsByLocation) return [];
    const combined: Review[] = [];
    for (const id of VISIBLE_LOCATION_IDS) {
      const items = reviewsByLocation[id];
      if (items) combined.push(...businessReviewsFor(id, items));
    }
    return combined.sort((a, b) => a.daysAgo - b.daysAgo);
  }, [reviewsByLocation]);

  const reviews = useMemo(() => {
    return allReviews.filter((r) => {
      if (statusFilter === "open" && isResponded(r)) return false;
      if (statusFilter === "responded" && !isResponded(r)) return false;
      if (ratingFilter.size > 0 && !ratingFilter.has(r.rating)) return false;
      if (activeTheme && !reviewMatchesTheme(r, activeTheme)) return false;
      return true;
    });
  }, [allReviews, statusFilter, ratingFilter, activeTheme, repliedText]);

  function updateStatusFilter(next: StatusFilter) {
    setStatusFilter(next);
    setShown(PAGE_SIZE);
  }

  function toggleRating(rating: number) {
    setRatingFilter((prev) => {
      const next = new Set(prev);
      if (next.has(rating)) next.delete(rating);
      else next.add(rating);
      return next;
    });
    setShown(PAGE_SIZE);
  }

  function selectTheme(label: string) {
    setActiveTheme((prev) => (prev === label ? null : label));
    setShown(PAGE_SIZE);
  }

  const filtersActive = statusFilter !== "all" || ratingFilter.size > 0 || activeTheme !== null;

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Alle reviews</div>
          <div className={styles.subtitle}>
            Volledige, ongefilterde lijst over alle gekoppelde locaties — niet beperkt tot
            deze week.
          </div>
        </div>
        {allReviews.length > 0 && (
          <div className={styles.count}>
            {reviews.length === allReviews.length
              ? `${allReviews.length} totaal`
              : `${reviews.length} van ${allReviews.length}`}
          </div>
        )}
      </div>

      {!loading && allReviews.length > 0 && (
        <ReviewPatterns
          reviews={allReviews}
          activeTheme={activeTheme}
          onSelectTheme={selectTheme}
        />
      )}

      {allReviews.length > 0 && (
        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <button
              type="button"
              className={
                statusFilter === "all"
                  ? `${styles.filterPill} ${styles.filterPillActive}`
                  : styles.filterPill
              }
              onClick={() => updateStatusFilter("all")}
            >
              Alle
            </button>
            <button
              type="button"
              className={
                statusFilter === "open"
                  ? `${styles.filterPill} ${styles.filterPillActive}`
                  : styles.filterPill
              }
              onClick={() => updateStatusFilter("open")}
            >
              Onbeantwoord
            </button>
            <button
              type="button"
              className={
                statusFilter === "responded"
                  ? `${styles.filterPill} ${styles.filterPillActive}`
                  : styles.filterPill
              }
              onClick={() => updateStatusFilter("responded")}
            >
              Beantwoord
            </button>
          </div>

          <div className={styles.filterDivider} />

          <div className={styles.filterGroup}>
            {RATINGS.map((rating) => (
              <button
                key={rating}
                type="button"
                className={
                  ratingFilter.has(rating)
                    ? `${styles.filterPill} ${styles.filterPillActive}`
                    : styles.filterPill
                }
                onClick={() => toggleRating(rating)}
              >
                {rating}★
              </button>
            ))}
          </div>

          {filtersActive && (
            <button
              type="button"
              className={styles.filterReset}
              onClick={() => {
                setStatusFilter("all");
                setRatingFilter(new Set());
                setActiveTheme(null);
                setShown(PAGE_SIZE);
              }}
            >
              Filters wissen
            </button>
          )}
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : !isLive ? (
        <div className={styles.empty}>
          Nog niet gekoppeld — er is geen backend-verbinding voor de volledige
          reviewgeschiedenis.
        </div>
      ) : allReviews.length === 0 ? (
        <div className={styles.empty}>Geen reviews gevonden voor de gekoppelde locaties.</div>
      ) : reviews.length === 0 ? (
        <div className={styles.empty}>Geen reviews voor deze filtercombinatie.</div>
      ) : (
        <>
          <div className={styles.list}>
            {reviews.slice(0, shown).map((review) => (
              <div key={review.id} className={styles.item}>
                <div className={styles.initials}>{review.initials}</div>
                <div className={styles.body}>
                  <div className={styles.meta}>
                    <span className={styles.reviewer}>{review.reviewer}</span>
                    <StarRating rating={review.rating} />
                    <span className={styles.locationName}>
                      · {LOCATION_NAME.get(review.location)}
                    </span>
                  </div>
                  <div className={styles.snippet}>&ldquo;{review.snippet}&rdquo;</div>
                  {isResponded(review) && replyTextFor(review) && (
                    <div className={styles.reply}>
                      <div className={styles.replyLabel}>Jullie antwoord</div>
                      <div className={styles.replyText}>{replyTextFor(review)}</div>
                    </div>
                  )}
                  {!isResponded(review) && review.googleReviewId && (
                    <ReplyForm
                      location={review.location}
                      googleReviewId={review.googleReviewId}
                      onSent={(text) =>
                        setRepliedText((prev) => new Map(prev).set(review.id, text))
                      }
                    />
                  )}
                </div>
                <div className={styles.aside}>
                  <span
                    className={
                      isResponded(review) ? styles.statusResponded : styles.statusOpen
                    }
                  >
                    {isResponded(review) ? "Beantwoord" : "Onbeantwoord"}
                  </span>
                  <span className={styles.time}>
                    {daysAgoLabel(review.daysAgo)}
                    {review.publishedAt && (
                      <span className={styles.timestamp}>
                        {formatReviewTimestamp(review.publishedAt)}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {shown < reviews.length && (
            <button
              type="button"
              className={styles.loadMore}
              onClick={() => setShown((n) => n + PAGE_SIZE)}
            >
              Toon meer ({reviews.length - shown} resterend)
            </button>
          )}
        </>
      )}
    </div>
  );
}
