import styles from "./StatusStrip.module.css";

interface StatusStripProps {
  reviewCount: number;
  criticalCount: number;
  oldestCriticalDaysAgo: number;
}

export function StatusStrip({
  reviewCount,
  criticalCount,
  oldestCriticalDaysAgo,
}: StatusStripProps) {
  const urgent = criticalCount > 0;

  return (
    <div className={urgent ? `${styles.strip} ${styles.stripUrgent}` : styles.strip}>
      <div className={urgent ? `${styles.icon} ${styles.iconUrgent}` : styles.icon}>
        {urgent ? "!" : "✓"}
      </div>
      <div>
        <div className={urgent ? `${styles.headline} ${styles.headlineUrgent}` : styles.headline}>
          {urgent
            ? `${criticalCount} review${criticalCount > 1 ? "s" : ""} met 1–2 sterren in de laatste 7 dagen`
            : "Geen 1–2 sterren reviews in de laatste 7 dagen"}
        </div>
        <div className={styles.sub}>
          {urgent
            ? `Oudste onbeantwoorde kritieke review: ${oldestCriticalDaysAgo} ${oldestCriticalDaysAgo === 1 ? "dag" : "dagen"} geleden. Reageer zo snel mogelijk.`
            : `Alle ${reviewCount} nieuwe reviews zijn 3 sterren of hoger. Volgende automatische controle om 12:00.`}
        </div>
      </div>
      <div className={urgent ? `${styles.status} ${styles.statusUrgent}` : styles.status}>
        {urgent ? "STATUS · ACTIE VEREIST" : "STATUS · RUSTIG"}
      </div>
    </div>
  );
}
