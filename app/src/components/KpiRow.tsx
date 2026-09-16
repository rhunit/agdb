import {
  formatDutchDecimal,
  formatDutchInt,
  formatSignedDecimal,
} from "../lib/format";
import styles from "./KpiRow.module.css";

interface KpiRowProps {
  avgScore: number;
  avgScoreIsLive?: boolean;
  avgScoreReviewCount?: number;
  avgScoreDelta: number;
  reviewCount: number;
  reviewCountDelta: number;
  responseRatio: number;
  openCount: number;
  topRatedCount: number;
  criticalCount: number;
}

function deltaClass(value: number): string {
  return value < 0 ? styles.deltaNegative : styles.deltaPositive;
}

export function KpiRow({
  avgScore,
  avgScoreIsLive = false,
  avgScoreReviewCount = 0,
  avgScoreDelta,
  reviewCount,
  reviewCountDelta,
  responseRatio,
  openCount,
  topRatedCount,
  criticalCount,
}: KpiRowProps) {
  return (
    <div className={styles.row}>
      <div className={styles.tile}>
        <div className={styles.label}>
          GEMIDDELDE SCORE
          {avgScoreIsLive && <span className={styles.liveBadge}>LIVE</span>}
        </div>
        <div className={styles.value}>{formatDutchDecimal(avgScore)}</div>
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
        <div className={styles.label}>NIEUWE REVIEWS</div>
        <div className={styles.value}>{reviewCount}</div>
        <div className={deltaClass(reviewCountDelta)}>
          {reviewCountDelta >= 0 ? "+" : "−"}
          {Math.abs(reviewCountDelta)} vs vorige week
        </div>
      </div>
      <div className={styles.tile}>
        <div className={styles.label}>REACTIERATIO</div>
        <div className={styles.value}>
          {formatDutchInt(responseRatio)}%
        </div>
        <div className={styles.deltaMuted}>{openCount} open reacties</div>
      </div>
      <div className={styles.tile}>
        <div className={styles.label}>UITERSTEN DEZE WEEK</div>
        <div className={styles.value}>{topRatedCount} × 5★</div>
        <div className={criticalCount > 0 ? styles.deltaNegative : styles.deltaPositive}>
          {criticalCount > 0
            ? `${criticalCount} × 1–2★ deze week`
            : "Geen 1–2★ deze week"}
        </div>
      </div>
    </div>
  );
}
