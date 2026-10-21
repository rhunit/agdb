import { useAccount } from "../hooks/useAccount";
import { logout } from "../lib/api";
import { ThemeToggle } from "./ThemeToggle";
import styles from "./Sidebar.module.css";

export type SidebarView = "dashboard" | "alle-reviews" | "locaties" | "rapportage" | "gebruikers";

interface NavItem {
  label: string;
  view: SidebarView | null;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", view: "dashboard" },
  { label: "Alle reviews", view: "alle-reviews" },
  { label: "Rapportage", view: "rapportage" },
  { label: "Locaties", view: "locaties" },
];

interface SidebarProps {
  active: SidebarView;
  onNavigate: (view: SidebarView) => void;
}

export function Sidebar({ active, onNavigate }: SidebarProps) {
  const { account, can } = useAccount();
  // "Gebruikers" only for accounts that may manage logins.
  const navItems = can("admin") && account
    ? [...NAV_ITEMS, { label: "Gebruikers", view: "gebruikers" as const }]
    : NAV_ITEMS;
  return (
    <aside className={styles.sidebar} data-print-hide>
      <div className={styles.stickyTop}>
        <div className={styles.brand}>
          <img className={styles.mark} src="/favicon.svg" alt="Amsterdam Genetics" />
          <div className={styles.brandText}>
            <div className={styles.brandName}>
              <span>Dashboard</span>
              <span className={styles.betaBadge}>BETA</span>
            </div>
            <div className={styles.brandSub}>Amsterdam Genetics</div>
          </div>
        </div>

        <nav className={styles.nav} aria-label="Hoofdnavigatie">
          {navItems.map((item) => (
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
      </div>

      {account && (
        <div className={styles.account}>
          <span>
            Ingelogd als <strong>{account.username}</strong>
          </span>
          <button
            type="button"
            className={styles.logout}
            onClick={async () => {
              await logout();
              window.location.reload();
            }}
          >
            Uitloggen
          </button>
        </div>
      )}

      <div className={styles.themeRow}>
        <ThemeToggle />
      </div>

      <div className={styles.footer}>
        <img
          className={styles.professorImg}
          src="https://www.amsterdamgenetics.com/wp-content/uploads/2023/10/2023_homepage_profh.jpg.webp"
          alt="Professor Harvest"
          loading="lazy"
        />
        <div>
          Professor Harvest:
          <br />
          &ldquo;Get smart, before you grow.&rdquo;
        </div>
      </div>
    </aside>
  );
}
