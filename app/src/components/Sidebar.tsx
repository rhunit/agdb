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
          <div className={styles.brandName}>REVIEW RADAR</div>
          <div className={styles.brandSub}>SINCE 1985</div>
        </div>
      </div>

      <nav className={styles.nav}>
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
        <div className={styles.avatar}>PH</div>
        <div className={styles.quote}>
          Professor Harvest:
          <br />
          &ldquo;Get smart, before you get high.&rdquo;
        </div>
      </div>
    </aside>
  );
}
