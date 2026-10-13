import { useState } from "react";
import { LOCATIONS } from "../data/mockData";
import { daysAgoLabel, formatReviewTimestamp } from "../lib/format";
import type { Review } from "../types";
import { StarRating } from "./badges";
import { ReplyForm } from "./ReplyForm";
import styles from "./CriticalReviewFeed.module.css";

const LOCATION_NAME = new Map(LOCATIONS.map((l) => [l.id, l.name]));

interface CriticalReviewFeedProps {
  reviews: Review[];
  showLocation: boolean;
}

/** Dedicated panel for 1–2★ reviews — separate from the general feed so a
 * critical review never has to compete for attention with 4★/5★ ones.
 * Same "show the latest available, don't hide real data behind a strict
 * weekly cutoff" rule as ReviewFeed. */
export function CriticalReviewFeed({
  reviews,
  showLocation,
}: CriticalReviewFeedProps) {
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

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.title}>1–2★ reviews</div>
        <div className={styles.count}>{reviews.length} totaal</div>
      </div>

      {reviews.length === 0 ? (
        <div className={styles.empty}>Geen 1–2★ reviews op dit moment.</div>
      ) : (
        reviews.map((review) => (
          <div key={review.id} className={styles.item}>
            <div className={styles.initials}>{review.initials}</div>
            <div className={styles.body}>
              <div className={styles.meta}>
                <span className={styles.reviewer}>{review.reviewer}</span>
                <StarRating rating={review.rating} />
                {showLocation && (
                  <span className={styles.locationName}>
                    · {LOCATION_NAME.get(review.location)}
                  </span>
                )}
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
                {isResponded(review) ? "Beantwoord" : "Open"}
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
        ))
      )}
    </div>
  );
}
