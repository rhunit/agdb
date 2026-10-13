import { useMemo, useState } from "react";
import { VISIBLE_LOCATION_IDS } from "../config";
import { LOCATIONS } from "../data/mockData";
import type { LiveBusinessReview } from "../lib/api";
import { daysAgoLabel } from "../lib/format";
import { businessReviewsFor } from "../lib/reviews";
import type { LocationId, Review } from "../types";
import { StarRating } from "./badges";
import styles from "./AllReviews.module.css";

const LOCATION_NAME = new Map(LOCATIONS.map((l) => [l.id, l.name]));
const PAGE_SIZE = 25;

interface AllReviewsProps {
  reviewsByLocation: Partial<Record<LocationId, LiveBusinessReview[]>> | null;
  isLive: boolean;
}

export function AllReviews({ reviewsByLocation, isLive }: AllReviewsProps) {
  const [shown, setShown] = useState(PAGE_SIZE);

  const reviews = useMemo(() => {
    if (!reviewsByLocation) return [];
    const combined: Review[] = [];
    for (const id of VISIBLE_LOCATION_IDS) {
      const items = reviewsByLocation[id];
      if (items) combined.push(...businessReviewsFor(id, items));
    }
    return combined.sort((a, b) => a.daysAgo - b.daysAgo);
  }, [reviewsByLocation]);

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>
            Alle reviews
            {isLive && <span className={styles.liveBadge}>LIVE</span>}
          </div>
          <div className={styles.subtitle}>
            Volledige, ongefilterde lijst over alle gekoppelde locaties — niet beperkt tot
            deze week.
          </div>
        </div>
        {reviews.length > 0 && <div className={styles.count}>{reviews.length} totaal</div>}
      </div>

      {!isLive ? (
        <div className={styles.empty}>
          Nog niet gekoppeld — er is geen backend-verbinding voor de volledige
          reviewgeschiedenis.
        </div>
      ) : reviews.length === 0 ? (
        <div className={styles.empty}>Geen reviews gevonden voor de gekoppelde locaties.</div>
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
