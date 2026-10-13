import { detectReviewPatterns } from "../lib/reviewPatterns";
import type { Review } from "../types";
import styles from "./ReviewPatterns.module.css";

interface ReviewPatternsProps {
  reviews: Review[];
  activeTheme: string | null;
  onSelectTheme: (label: string) => void;
}

export function ReviewPatterns({ reviews, activeTheme, onSelectTheme }: ReviewPatternsProps) {
  const patterns = detectReviewPatterns(reviews);

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.title}>Terugkerende patronen in 1–3★ reviews</div>
        <div className={styles.subtitle}>
          Op trefwoorden gebaseerd, geen AI — klik op een patroon om de bijbehorende
          reviews te zien. Mist mogelijk andere bewoordingen.
        </div>
      </div>

      {patterns.length === 0 ? (
        <div className={styles.empty}>
          Nog geen duidelijk terugkerend patroon gevonden in de 1–3★ reviews.
        </div>
      ) : (
        <div className={styles.chips}>
          {patterns.map((pattern) => (
            <button
              key={pattern.label}
              type="button"
              className={
                activeTheme === pattern.label
                  ? `${styles.chip} ${styles.chipActive}`
                  : styles.chip
              }
              onClick={() => onSelectTheme(pattern.label)}
            >
              <span className={styles.label}>{pattern.label}</span>
              <span className={styles.count}>{pattern.count}×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
