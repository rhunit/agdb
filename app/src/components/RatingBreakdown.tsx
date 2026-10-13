import { computeRatingStats } from "../lib/ratingStats";
import { formatDutchDecimal, formatDutchInt } from "../lib/format";
import type { Review } from "../types";
import { LoadingState } from "./LoadingState";
import styles from "./RatingBreakdown.module.css";

interface RatingBreakdownProps {
  reviews: Review[];
  loading: boolean;
}

const ROWS = [5, 4, 3, 2, 1] as const;

/** Star distribution and positive/negative split for the currently
 * selected tab and date range — deliberately based on the star rating
 * alone, never a guessed sentiment from the review text. */
export function RatingBreakdown({ reviews, loading }: RatingBreakdownProps) {
  if (loading) {
    return (
      <div className={styles.card}>
        <LoadingState />
      </div>
    );
  }

  const stats = computeRatingStats(reviews);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.title}>Sterrenverdeling</div>
        <div className={styles.subtitle}>
          {stats.total > 0
            ? `Op basis van ${formatDutchInt(stats.total)} reviews in de geselecteerde periode.`
            : "Geen reviews in de geselecteerde periode."}
        </div>
      </div>

      {stats.total > 0 && (
        <>
          <div className={styles.bars}>
            {ROWS.map((rating) => {
              const count = stats.counts[rating];
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
              return (
                <div key={rating} className={styles.row}>
                  <span className={styles.rowLabel}>{rating}★</span>
                  <div className={styles.track}>
                    <div className={styles.fill} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={styles.rowCount}>{formatDutchInt(count)}</span>
                </div>
              );
            })}
          </div>

          <div className={styles.split}>
            <div className={styles.splitTrack}>
              <div
                className={styles.splitPositive}
                style={{ width: `${stats.positivePct}%` }}
              />
            </div>
            <div className={styles.splitLabels}>
              <span className={styles.positiveLabel}>
                Positief (4–5★) {formatDutchDecimal(stats.positivePct, 1)}%
              </span>
              <span className={styles.notPositiveLabel}>
                Niet positief (1–3★) {formatDutchDecimal(stats.notPositivePct, 1)}%
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
