import { buildWeekSummary, type WeekSummaryInput } from "../lib/summary";
import styles from "./WeekSummary.module.css";

export function WeekSummary(input: WeekSummaryInput) {
  const lines = buildWeekSummary(input);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.icon} aria-hidden="true">
          ✦
        </span>
        <span className={styles.title}>Samenvatting</span>
      </div>
      <ul className={styles.lines}>
        {lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
