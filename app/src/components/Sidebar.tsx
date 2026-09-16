import styles from "./Sidebar.module.css";

const NAV_ITEMS = [
  "Dashboard",
  "Alle reviews",
  "Weekly update",
  "Locaties",
  "Instellingen",
];

export function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.mark}>AG</div>
        <div>
          <div className={styles.brandName}>
            <span>Review Radar</span>
            <span className={styles.betaBadge}>BETA</span>
          </div>
          <div className={styles.brandSub}>Amsterdam Genetics</div>
        </div>
      </div>

      <nav className={styles.nav} aria-label="Hoofdnavigatie">
        {NAV_ITEMS.map((item) => (
          <div
            key={item}
            className={
              item === "Dashboard"
                ? `${styles.navItem} ${styles.navItemActive}`
                : styles.navItem
            }
          >
            {item}
          </div>
        ))}
      </nav>

      <div className={styles.footer}>
        Professor Harvest:
        <br />
        &ldquo;Get smart, before you get high.&rdquo;
      </div>
    </aside>
  );
}
