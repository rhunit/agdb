import { detectReviewPatterns } from "../lib/reviewPatterns";
import type { Review } from "../types";
import styles from "./ReviewPatterns.module.css";

interface ReviewPatternsProps {
  reviews: Review[];
}

export function ReviewPatterns({ reviews }: ReviewPatternsProps) {
  const patterns = detectReviewPatterns(reviews);

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.title}>Terugkerende patronen in 1–3★ reviews</div>
        <div className={styles.subtitle}>
          Op trefwoorden gebaseerd, geen AI — elk patroon is direct te herleiden naar
          echte reviewtekst. Mist mogelijk andere bewoordingen.
        </div>
      </div>

      {patterns.length === 0 ? (
        <div className={styles.empty}>
          Nog geen duidelijk terugkerend patroon gevonden in de 1–3★ reviews.
        </div>
      ) : (
        <div className={styles.chips}>
          {patterns.map((pattern) => (
            <div key={pattern.label} className={styles.chip}>
              <span className={styles.label}>{pattern.label}</span>
              <span className={styles.count}>{pattern.count}×</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
