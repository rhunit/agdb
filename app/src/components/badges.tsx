import type { Confidence, ReviewSource } from "../types";
import styles from "./badges.module.css";

const SOURCE_META: Record<
  ReviewSource,
  { label: string; bg: string; border: string; text: string }
> = {
  organisch: {
    label: "Organisch",
    bg: "var(--ag-green-bg)",
    border: "var(--ag-green-border)",
    text: "var(--ag-green-dark)",
  },
  qr: {
    label: "QR-scan",
    bg: "var(--ag-gold-bg)",
    border: "var(--ag-gold-border)",
    text: "var(--ag-gold-text)",
  },
  smoke: {
    label: "Smoke Session",
    bg: "var(--ag-brown-bg)",
    border: "var(--ag-brown-border)",
    text: "var(--ag-brown)",
  },
  onbekend: {
    label: "Onbekend",
    bg: "var(--ag-unknown-bg)",
    border: "var(--ag-unknown-border)",
    text: "var(--ag-unknown-text)",
  },
};

const CONFIDENCE_META: Record<Confidence, { label: string; dot: string }> = {
  bevestigd: { label: "bevestigd", dot: "var(--ag-green)" },
  vermoedelijk: { label: "vermoedelijk", dot: "var(--ag-gold)" },
  onbekend: { label: "onbekend", dot: "#b6ada5" },
};

export function SourceBadge({ source }: { source: ReviewSource }) {
  const meta = SOURCE_META[source];
  return (
    <span
      className={styles.sourceBadge}
      style={{
        background: meta.bg,
        borderColor: meta.border,
        color: meta.text,
      }}
    >
      {meta.label}
    </span>
  );
}

export function ConfidenceTag({ confidence }: { confidence: Confidence }) {
  const meta = CONFIDENCE_META[confidence];
  return (
    <span className={styles.confidenceTag}>
      <span className={styles.confidenceDot} style={{ background: meta.dot }} />
      {meta.label}
    </span>
  );
}

export function StarRating({ rating }: { rating: number }) {
  return (
    <span className={styles.stars} aria-label={`${rating} van de 5 sterren`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={i < rating ? styles.starFilled : styles.starEmpty}
        >
          ★
        </span>
      ))}
    </span>
  );
}
