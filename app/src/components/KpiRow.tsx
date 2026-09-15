import {
  formatDutchDecimal,
  formatDutchInt,
  formatSignedDecimal,
  formatSignedPercent,
} from "../lib/format";
import styles from "./KpiRow.module.css";

interface KpiRowProps {
  avgScore: number;
  avgScoreIsLive?: boolean;
  avgScoreReviewCount?: number;
  avgScoreDelta: number;
  reviewCount: number;
  reviewCountIsLive?: boolean;
  reviewCountCapped?: boolean;
  reviewCountDelta: number;
  responseRatio: number;
  openCount: number;
  searchViewsTotal: number;
  searchViewsDeltaPct: number;
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
  reviewCountIsLive = false,
  reviewCountCapped = false,
  reviewCountDelta,
  responseRatio,
  openCount,
  searchViewsTotal,
  searchViewsDeltaPct,
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
        <div className={styles.label}>
          NIEUWE REVIEWS
          {reviewCountIsLive && <span className={styles.liveBadge}>LIVE</span>}
        </div>
        <div className={styles.value}>
          {reviewCountCapped ? `${reviewCount}+` : reviewCount}
        </div>
        {reviewCountIsLive ? (
          <div className={styles.deltaMuted}>
            {reviewCountCapped
              ? "Limiet bereikt — mogelijk meer"
              : "Laatste 7 dagen (live)"}
          </div>
        ) : (
          <div className={deltaClass(reviewCountDelta)}>
            {reviewCountDelta >= 0 ? "+" : "−"}
            {Math.abs(reviewCountDelta)} vs vorige week
          </div>
        )}
      </div>
      <div className={styles.tile}>
        <div className={styles.label}>REACTIERATIO</div>
        <div className={styles.value}>
          {formatDutchInt(responseRatio)}%
        </div>
        <div className={styles.deltaMuted}>{openCount} open reacties</div>
      </div>
      <div className={styles.tile}>
        <div className={styles.label}>ZOEKWEERGAVEN</div>
        <div className={styles.value}>{formatDutchInt(searchViewsTotal)}</div>
        <div className={deltaClass(searchViewsDeltaPct)}>
          {formatSignedPercent(searchViewsDeltaPct)} vs vorige week
        </div>
      </div>
    </div>
  );
}
