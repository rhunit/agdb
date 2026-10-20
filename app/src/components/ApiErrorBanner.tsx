import { describeFailure, primaryFailure, useApiFailures } from "../lib/apiFailures";
import styles from "./ApiErrorBanner.module.css";

function formatTime(d: Date): string {
  return d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

/** Shown above every page whenever any data request failed — says in
 * plain Dutch what's wrong and what to do about it, plus the raw detail
 * to pass on when asking for help. Hidden in the PDF export. */
export function ApiErrorBanner() {
  const failures = useApiFailures();
  const primary = primaryFailure(failures);
  if (!primary) return null;

  const { title, action } = describeFailure(primary);
  const others = failures.length - 1;

  return (
    <div className={styles.banner} role="alert" data-print-hide>
      <div className={styles.icon} aria-hidden="true">
        !
      </div>
      <div className={styles.body}>
        <div className={styles.title}>{title}</div>
        <div className={styles.action}>{action}</div>
        <div className={styles.detail}>
          Technisch: {primary.path} — {primary.detail} ({formatTime(primary.at)})
          {others > 0 && ` · nog ${others} ander${others === 1 ? "" : "e"} verzoek${others === 1 ? "" : "en"} mislukt`}
        </div>
      </div>
      <button type="button" className={styles.retry} onClick={() => window.location.reload()}>
        Opnieuw proberen
      </button>
    </div>
  );
}
