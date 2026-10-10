import { LOCATIONS } from "../data/mockData";
import {
  formatDutchDecimal,
  formatDutchInt,
  formatSignedDecimal,
} from "../lib/format";
import type { Review } from "../types";
import { StarRating } from "./badges";
import styles from "./BentoGrid.module.css";

const LOCATION_NAME = new Map(LOCATIONS.map((l) => [l.id, l.name]));

function deltaClass(value: number): string {
  if (value > 0) return styles.deltaPositive;
  if (value < 0) return styles.deltaNegative;
  return styles.deltaMuted;
}

function signedCount(value: number): string {
  if (value > 0) return `+${value}`;
  if (value < 0) return `−${Math.abs(value)}`;
  return "±0";
}

interface BentoGridProps {
  avgScore: number;
  avgScoreIsLive?: boolean;
  avgScoreReviewCount?: number;
  avgScoreDelta: number;
  reviewCount: number;
  reviewCountDelta: number;
  statsAreLive?: boolean;
  topRatedCount: number;
  topRatedCountDelta: number;
  criticalCount: number;
  criticalCountDelta: number;
  criticalResponseRatio: number;
  openCriticalReviews: Review[];
}

export function BentoGrid({
  avgScore,
  avgScoreIsLive = false,
  avgScoreReviewCount = 0,
  avgScoreDelta,
  reviewCount,
  reviewCountDelta,
  statsAreLive = false,
  topRatedCount,
  topRatedCountDelta,
  criticalCount,
  criticalCountDelta,
  criticalResponseRatio,
  openCriticalReviews,
}: BentoGridProps) {
  const shownOpen = openCriticalReviews.slice(0, 2);
  const extraOpenCount = openCriticalReviews.length - shownOpen.length;

  return (
    <div className={styles.grid}>
      <div className={`${styles.tile} ${styles.hero}`}>
        <div className={styles.label}>
          GEMIDDELDE SCORE
          {avgScoreIsLive && <span className={styles.liveBadge}>LIVE</span>}
        </div>
        <div className={styles.heroValue}>{formatDutchDecimal(avgScore)}</div>
        <StarRating rating={Math.round(avgScore)} />
        {avgScoreIsLive ? (
          <div className={styles.deltaMuted}>
            Gebaseerd op {formatDutchInt(avgScoreReviewCount)} Google-reviews
          </div>
        ) : (
          <div className={deltaClass(avgScoreDelta)}>
            {formatSignedDecimal(avgScoreDelta)} vs vorige week
          </div>
        )}
      </div>

      <div className={styles.tile}>
        <div className={styles.label}>
          NIEUWE REVIEWS
          {statsAreLive && <span className={styles.liveBadge}>LIVE</span>}
        </div>
        <div className={styles.value}>{formatDutchInt(reviewCount)}</div>
        <div className={deltaClass(reviewCountDelta)}>
          {signedCount(reviewCountDelta)} vs vorige week
        </div>
      </div>

      <div className={`${styles.tile} ${styles.accentPositive}`}>
        <div className={styles.label}>
          NIEUWE 5★ REVIEWS
          {statsAreLive && <span className={styles.liveBadge}>LIVE</span>}
        </div>
        <div className={styles.value}>{formatDutchInt(topRatedCount)}</div>
        <div className={deltaClass(topRatedCountDelta)}>
          {signedCount(topRatedCountDelta)} vs vorige week
        </div>
      </div>

      <div className={`${styles.tile} ${styles.accentCritical}`}>
        <div className={styles.label}>
          NIEUWE 1–2★ REVIEWS
          {statsAreLive && <span className={styles.liveBadge}>LIVE</span>}
        </div>
        <div className={styles.value}>{formatDutchInt(criticalCount)}</div>
        <div className={criticalCountDelta > 0 ? styles.deltaNegative : deltaClass(criticalCountDelta)}>
          {signedCount(criticalCountDelta)} vs vorige week
        </div>
      </div>

      <div className={`${styles.tile} ${styles.ratio}`}>
        <div className={styles.label}>
          REACTIERATIO 1–2★
          {statsAreLive && <span className={styles.liveBadge}>LIVE</span>}
        </div>
        <div className={styles.value}>{formatDutchInt(criticalResponseRatio)}%</div>
        {openCriticalReviews.length === 0 ? (
          <div className={styles.deltaMuted}>Alles beantwoord</div>
        ) : (
          <>
            <div className={styles.deltaMuted}>
              {openCriticalReviews.length} open
            </div>
            <ul className={styles.openList}>
              {shownOpen.map((r) => (
                <li key={r.id} className={styles.openItem}>
                  <span className={styles.openName}>{r.reviewer}</span>
                  <span className={styles.openLocation}>
                    {LOCATION_NAME.get(r.location)}
                  </span>
                </li>
              ))}
              {extraOpenCount > 0 && (
                <li className={styles.openMore}>+{extraOpenCount} meer</li>
              )}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
