import styles from "./Sidebar.module.css";

export type SidebarView = "dashboard" | "locaties";

interface NavItem {
  label: string;
  view: SidebarView | null;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", view: "dashboard" },
  { label: "Alle reviews", view: null },
  { label: "Weekly update", view: null },
  { label: "Locaties", view: "locaties" },
  { label: "Instellingen", view: null },
];

interface SidebarProps {
  active: SidebarView;
  onNavigate: (view: SidebarView) => void;
}

export function Sidebar({ active, onNavigate }: SidebarProps) {
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
            key={item.label}
            className={
              item.view === active
                ? `${styles.navItem} ${styles.navItemActive}`
                : item.view
                  ? `${styles.navItem} ${styles.navItemClickable}`
                  : styles.navItem
            }
            role={item.view ? "button" : undefined}
            tabIndex={item.view ? 0 : undefined}
            onClick={item.view ? () => onNavigate(item.view!) : undefined}
            onKeyDown={
              item.view
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") onNavigate(item.view!);
                  }
                : undefined
            }
          >
            {item.label}
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
