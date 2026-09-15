import styles from "./TopNav.module.css";

const NAV_ITEMS = [
  "Dashboard",
  "Alle reviews",
  "Weekly update",
  "Locaties",
  "Instellingen",
];

export function TopNav() {
  return (
    <header className={styles.topnav}>
      <div className={styles.brand}>
        <div className={styles.mark}>AG</div>
        <div className={styles.wordmark}>
          <div className={styles.name}>Review Radar</div>
          <div className={styles.sub}>Amsterdam Genetics</div>
        </div>
      </div>

      <nav className={styles.links} aria-label="Hoofdnavigatie">
        {NAV_ITEMS.map((item) => (
          <span
            key={item}
            className={
              item === "Dashboard"
                ? `${styles.link} ${styles.linkActive}`
                : styles.link
            }
          >
            {item}
          </span>
        ))}
      </nav>

      <div className={styles.quote}>
        Professor Harvest: &ldquo;Get smart, before you get high.&rdquo;
      </div>
    </header>
  );
}
