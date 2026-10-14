import { LOCATIONS } from "../data/mockData";
import type { RemovedReview } from "../lib/api";
import { formatDutchInt, formatReviewTimestamp } from "../lib/format";
import { StarRating } from "./badges";
import { LoadingState } from "./LoadingState";
import styles from "./RemovedReviewsCard.module.css";

const LOCATION_NAME = new Map(LOCATIONS.map((l) => [l.id, l.name]));

interface RemovedReviewsCardProps {
  removed: RemovedReview[];
  loading: boolean;
}

/** Reviews we'd previously fetched that are simply gone from a later
 * fetch — Google gives no reason or deletion log, so this can only ever
 * report "gone", never why, and only from the moment the backend first
 * started watching (see server/src/reviewHistoryStore.ts). */
export function RemovedReviewsCard({ removed, loading }: RemovedReviewsCardProps) {
  if (loading) {
    return (
      <div className={styles.card}>
        <LoadingState />
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.title}>Verwijderde reviews</div>
        <div className={styles.count}>{formatDutchInt(removed.length)} totaal</div>
      </div>
      <div className={styles.subtitle}>
        Reviews die we eerder zagen en die inmiddels niet meer op Google staan — door Google
        verwijderd, door de reviewer zelf ingetrokken, of een andere reden; dat onderscheid geeft
        Google niet door. Alleen zichtbaar vanaf het moment dat dit is gaan bijhouden, dus geen
        volledige historie van daarvoor.
      </div>

      {removed.length === 0 ? (
        <div className={styles.empty}>Nog geen verwijderingen gedetecteerd.</div>
      ) : (
        <div className={styles.list}>
          {removed.map((r) => (
            <div key={r.id} className={styles.item}>
              <div className={styles.initials}>
                {r.reviewer.trim().slice(0, 1).toUpperCase() || "?"}
              </div>
              <div className={styles.body}>
                <div className={styles.meta}>
                  <span className={styles.reviewer}>{r.reviewer}</span>
                  <StarRating rating={r.rating} />
                  <span className={styles.locationName}>· {LOCATION_NAME.get(r.location)}</span>
                </div>
                <div className={styles.snippet}>&ldquo;{r.text}&rdquo;</div>
              </div>
              <div className={styles.aside}>
                <span className={styles.detectedLabel}>Verwijderd</span>
                <span className={styles.time}>{formatReviewTimestamp(r.detectedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
