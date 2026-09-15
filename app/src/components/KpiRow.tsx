import {
  formatDutchDecimal,
  formatDutchInt,
  formatSignedDecimal,
  formatSignedPercent,
} from "../lib/format";
import styles from "./KpiRow.module.css";

interface KpiRowProps {
  avgScore: number;
  avgScoreDelta: number;
  reviewCount: number;
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
  avgScoreDelta,
  reviewCount,
  reviewCountDelta,
  responseRatio,
  openCount,
  searchViewsTotal,
  searchViewsDeltaPct,
}: KpiRowProps) {
  return (
    <div className={styles.row}>
      <div className={styles.tile}>
        <div className={styles.label}>GEMIDDELDE SCORE</div>
        <div className={styles.value}>{formatDutchDecimal(avgScore)}</div>
        <div className={deltaClass(avgScoreDelta)}>
          {formatSignedDecimal(avgScoreDelta)} vs vorige week
        </div>
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
        <div className={styles.label}>ZOEKWEERGAVEN</div>
        <div className={styles.value}>{formatDutchInt(searchViewsTotal)}</div>
        <div className={deltaClass(searchViewsDeltaPct)}>
          {formatSignedPercent(searchViewsDeltaPct)} vs vorige week
        </div>
      </div>
    </div>
  );
}
