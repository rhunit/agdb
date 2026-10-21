import { useId } from "react";
import { formatReviewTimestamp } from "../lib/format";
import { useReplyLog } from "../lib/replyLog";
import styles from "./ReplyMeta.module.css";

interface ReplyMetaProps {
  googleReviewId?: string;
  /** When Google says the reply was last updated, if known. */
  responseTime?: string;
}

/** "Beantwoord door rick op 21 okt 2026, 14:03" under a reply. Google
 * doesn't know which person replied, so the name only exists for replies
 * sent through the dashboard since this was added; anything else is marked
 * "Externe reactie" with the date from Google. */
const EXTERNAL_TOOLTIP = "Op deze review is buiten het dashboard gereageerd.";

export function ReplyMeta({ googleReviewId, responseTime }: ReplyMetaProps) {
  const log = useReplyLog();
  const tooltipId = useId();
  const entry = googleReviewId ? log.get(googleReviewId) : undefined;
  if (entry) {
    return (
      <div className={styles.meta}>
        Beantwoord door <strong>{entry.username}</strong> op{" "}
        {formatReviewTimestamp(entry.repliedAt)}
      </div>
    );
  }
  return (
    <div className={styles.meta}>
      {/* Focusable so the tooltip also opens on tap/keyboard, where a
          plain title attribute never shows. */}
      <span className={styles.external} tabIndex={0} aria-describedby={tooltipId}>
        Externe reactie
        <span className={styles.tooltip} role="tooltip" id={tooltipId}>
          {EXTERNAL_TOOLTIP}
        </span>
      </span>
      {responseTime && <> · Beantwoord op {formatReviewTimestamp(responseTime)}</>}
    </div>
  );
}
