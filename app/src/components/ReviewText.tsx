import { splitReviewText } from "../lib/reviewText";
import styles from "./ReviewText.module.css";

interface ReviewTextProps {
  text: string;
  /** The caller's own text style for the review itself. */
  className?: string;
}

/** A review's text as the reviewer wrote it, with Google's translation
 * (if any) underneath as a separate, labelled block — and an explicit
 * "no text" note for stars-only reviews instead of empty quotes. */
export function ReviewText({ text, className }: ReviewTextProps) {
  const { original, translation } = splitReviewText(text);
  return (
    <>
      <div className={className}>
        {original ? (
          <>&ldquo;{original}&rdquo;</>
        ) : (
          <span className={styles.empty}>Geen tekst, alleen sterren</span>
        )}
      </div>
      {translation && (
        <div className={styles.translation}>
          <span className={styles.translationLabel}>Vertaling door Google</span>
          <span className={styles.translationText}>{translation}</span>
        </div>
      )}
    </>
  );
}
