import { LOCATIONS } from "../data/mockData";
import { daysAgoLabel } from "../lib/format";
import type { Review } from "../types";
import { StarRating } from "./badges";
import styles from "./CriticalReviewFeed.module.css";

const LOCATION_NAME = new Map(LOCATIONS.map((l) => [l.id, l.name]));

interface CriticalReviewFeedProps {
  reviews: Review[];
  showLocation: boolean;
  isLive?: boolean;
}

/** Dedicated panel for 1–2★ reviews — separate from the general feed so a
 * critical review never has to compete for attention with 4★/5★ ones.
 * Same "show the latest available, don't hide real data behind a strict
 * weekly cutoff" rule as ReviewFeed. */
export function CriticalReviewFeed({
  reviews,
  showLocation,
  isLive = false,
}: CriticalReviewFeedProps) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.title}>
          1–2★ reviews
          {isLive && <span className={styles.liveBadge}>LIVE</span>}
        </div>
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
            </div>
            <div className={styles.aside}>
              <span
                className={
                  review.responded ? styles.statusResponded : styles.statusOpen
                }
              >
                {review.responded ? "Beantwoord" : "Open"}
              </span>
              <span className={styles.time}>{daysAgoLabel(review.daysAgo)}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
