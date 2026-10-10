import { LOCATIONS } from "../data/mockData";
import { formatSignedDecimal } from "../lib/format";
import type { WeeklyLogEntry } from "../types";
import styles from "./TrendContext.module.css";

const LOCATION_NAME = new Map(LOCATIONS.map((l) => [l.id, l.name]));

interface TrendContextProps {
  avgScoreDelta: number;
  reviewCountDelta: number;
  logEntries: WeeklyLogEntry[];
}

type Direction = "up" | "down" | "flat";

function direction(avgScoreDelta: number): Direction {
  if (avgScoreDelta > 0.05) return "up";
  if (avgScoreDelta < -0.05) return "down";
  return "flat";
}

const HEADLINE: Record<Direction, string> = {
  up: "Stijgende lijn",
  down: "Dalende lijn",
  flat: "Stabiel",
};

export function TrendContext({
  avgScoreDelta,
  reviewCountDelta,
  logEntries,
}: TrendContextProps) {
  const dir = direction(avgScoreDelta);
  // logEntries is already sorted newest-week-first — the most recent
  // logged week is the best honest guess at "wat hier mogelijk invloed op
  // heeft", since it's the only record of what actually changed.
  const latestWeek = logEntries[0]?.week;
  const latestEntries = logEntries.filter((e) => e.week === latestWeek).slice(0, 3);

  return (
    <div className={`${styles.card} ${styles[dir]}`}>
      <div className={styles.header}>
        <div className={styles.icon}>
          {dir === "up" ? "↑" : dir === "down" ? "↓" : "→"}
        </div>
        <div>
          <div className={styles.headline}>{HEADLINE[dir]}</div>
          <div className={styles.sub}>
            {formatSignedDecimal(avgScoreDelta)} gemiddelde score ·{" "}
            {reviewCountDelta >= 0 ? "+" : "−"}
            {Math.abs(reviewCountDelta)} nieuwe reviews vs vorige week
          </div>
        </div>
      </div>

      <div className={styles.context}>
        <div className={styles.contextLabel}>Voor zover zichtbaar, mogelijk van invloed</div>
        {latestEntries.length === 0 ? (
          <div className={styles.contextEmpty}>
            Geen wijzigingen gelogd deze periode — voeg een regel toe bij
            Weeklog om context te geven bij volgende schommelingen.
          </div>
        ) : (
          <ul className={styles.contextList}>
            {latestEntries.map((e) => (
              <li key={e.id} className={styles.contextItem}>
                <span className={styles.contextLocation}>
                  {LOCATION_NAME.get(e.location)}
                </span>
                <span className={styles.contextNote}>{e.note}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
