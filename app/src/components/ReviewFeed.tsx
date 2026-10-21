import { LOCATIONS } from "../data/mockData";
import { daysAgoLabel, formatReviewTimestamp } from "../lib/format";
import type { Review } from "../types";
import { StarRating } from "./badges";
import styles from "./ReviewFeed.module.css";
import { ReviewText } from "./ReviewText";

const LOCATION_NAME = new Map(LOCATIONS.map((l) => [l.id, l.name]));

interface ReviewFeedProps {
  reviews: Review[];
  showLocation: boolean;
}

export function ReviewFeed({ reviews, showLocation }: ReviewFeedProps) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.title}>Laatste reviews</div>
        <div className={styles.count}>{reviews.length} totaal</div>
        <a href="#" className={styles.viewAll} onClick={(e) => e.preventDefault()}>
          Alles bekijken
        </a>
      </div>

      {reviews.length === 0 ? (
        <div className={styles.empty}>Nog geen reviews ontvangen.</div>
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
              <ReviewText text={review.snippet} className={styles.snippet} />
            </div>
            <div className={styles.aside}>
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
