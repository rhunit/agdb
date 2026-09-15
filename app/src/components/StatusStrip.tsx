import styles from "./StatusStrip.module.css";

interface StatusStripProps {
  reviewCount: number;
}

export function StatusStrip({ reviewCount }: StatusStripProps) {
  return (
    <div className={styles.strip}>
      <div className={styles.icon}>✓</div>
      <div>
        <div className={styles.headline}>
          Geen 1–2 sterren reviews in de laatste 7 dagen
        </div>
        <div className={styles.sub}>
          Alle {reviewCount} nieuwe reviews zijn 3 sterren of hoger. Volgende
          automatische controle om 12:00.
        </div>
      </div>
      <div className={styles.status}>STATUS · RUSTIG</div>
    </div>
  );
}
