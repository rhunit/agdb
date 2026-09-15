import { LOCATIONS } from "../data/mockData";
import { daysAgoLabel } from "../lib/format";
import type { Review } from "../types";
import { ConfidenceTag, SourceBadge, StarRating } from "./badges";
import styles from "./ReviewFeed.module.css";

const LOCATION_NAME = new Map(LOCATIONS.map((l) => [l.id, l.name]));

interface ReviewFeedProps {
  reviews: Review[];
  showLocation: boolean;
  isLive?: boolean;
}

export function ReviewFeed({ reviews, showLocation, isLive = false }: ReviewFeedProps) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.title}>
          Nieuwe reviews deze week
          {isLive && <span className={styles.liveBadge}>LIVE</span>}
        </div>
        <div className={styles.count}>{reviews.length} totaal</div>
        <a href="#" className={styles.viewAll} onClick={(e) => e.preventDefault()}>
          Alles bekijken
        </a>
      </div>

      {reviews.length === 0 ? (
        <div className={styles.empty}>Geen reviews in de laatste 7 dagen.</div>
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
              <SourceBadge source={review.source} />
              <ConfidenceTag confidence={review.confidence} />
              <span className={styles.time}>
                {daysAgoLabel(review.daysAgo)}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
