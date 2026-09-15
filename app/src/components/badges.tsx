import type { Confidence, ReviewSource } from "../types";
import styles from "./badges.module.css";

const SOURCE_META: Record<
  ReviewSource,
  { label: string; bg: string; border: string; text: string }
> = {
  organisch: {
    label: "Organisch",
    bg: "var(--ag-primary-bg)",
    border: "var(--ag-primary-border)",
    text: "var(--ag-primary-strong)",
  },
  qr: {
    label: "QR-scan",
    bg: "var(--ag-neutral-100)",
    border: "var(--ag-border)",
    text: "var(--ag-secondary)",
  },
  smoke: {
    label: "Smoke Session",
    bg: "var(--ag-neutral-200)",
    border: "var(--ag-border)",
    text: "var(--ag-secondary)",
  },
  onbekend: {
    label: "Onbekend",
    bg: "var(--ag-neutral)",
    border: "var(--ag-border)",
    text: "var(--ag-muted)",
  },
};

const CONFIDENCE_META: Record<Confidence, { label: string; dot: string }> = {
  bevestigd: { label: "bevestigd", dot: "var(--ag-primary)" },
  vermoedelijk: { label: "vermoedelijk", dot: "var(--ag-muted)" },
  onbekend: { label: "onbekend", dot: "var(--ag-tertiary)" },
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
