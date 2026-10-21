import { triggerRefresh, useRefreshState } from "../lib/refresh";
import styles from "./RefreshButton.module.css";

/** Fetches every review/stat on the page again from Google, without a page
 * reload — the chosen tab, period and filters stay as they are. */
export function RefreshButton() {
  const { refreshing } = useRefreshState();
  return (
    <button
      type="button"
      className={styles.button}
      onClick={triggerRefresh}
      disabled={refreshing}
      aria-label="Data vernieuwen"
      title="Nieuwe data ophalen"
      data-print-hide
    >
      <svg
        className={refreshing ? `${styles.icon} ${styles.spinning}` : styles.icon}
        viewBox="0 0 24 24"
        width="16"
        height="16"
        aria-hidden="true"
      >
        <path
          d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className={styles.label}>{refreshing ? "Vernieuwen..." : "Vernieuwen"}</span>
    </button>
  );
}
