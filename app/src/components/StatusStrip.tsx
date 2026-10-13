import styles from "./StatusStrip.module.css";

interface StatusStripProps {
  reviewCount: number;
  criticalCount: number;
  oldestCriticalDaysAgo: number;
  /** Navigates to Alle reviews, pre-filtered to the open critical reviews
   * this strip is warning about. Only rendered as a link when there's
   * actually something to jump to. */
  onViewCritical?: () => void;
}

export function StatusStrip({
  reviewCount,
  criticalCount,
  oldestCriticalDaysAgo,
  onViewCritical,
}: StatusStripProps) {
  const urgent = criticalCount > 0;
  const clickable = urgent && Boolean(onViewCritical);

  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onViewCritical : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onViewCritical!();
            }
          : undefined
      }
      className={
        urgent
          ? clickable
            ? `${styles.strip} ${styles.stripUrgent} ${styles.stripClickable}`
            : `${styles.strip} ${styles.stripUrgent}`
          : styles.strip
      }
    >
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
            ? `Oudste onbeantwoorde kritieke review: ${oldestCriticalDaysAgo} ${oldestCriticalDaysAgo === 1 ? "dag" : "dagen"} geleden. ${
                onViewCritical ? "Bekijk en reageer zo snel mogelijk →" : "Reageer zo snel mogelijk."
              }`
            : `Alle ${reviewCount} nieuwe reviews zijn 3 sterren of hoger. Volgende automatische controle om 12:00.`}
        </div>
      </div>
      <div className={urgent ? `${styles.status} ${styles.statusUrgent}` : styles.status}>
        {urgent ? "STATUS · ACTIE VEREIST" : "STATUS · RUSTIG"}
      </div>
    </div>
  );
}
