import { useNotice } from "../lib/notice";
import styles from "./SiteNotice.module.css";

/** The orange notice at the top of the dashboard, as set by an admin under
 * Instellingen. Shown to everyone while it's switched on. */
export function SiteNotice() {
  const notice = useNotice();
  if (!notice?.active || !notice.title) return null;
  return (
    <div className={styles.notice} role="status">
      <div className={styles.icon} aria-hidden="true">
        !
      </div>
      <div className={styles.body}>
        <div className={styles.title}>{notice.title}</div>
        {notice.description && <div className={styles.text}>{notice.description}</div>}
      </div>
    </div>
  );
}
