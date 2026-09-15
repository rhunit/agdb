import { LOCATIONS } from "../data/mockData";
import type { LocationFilter } from "../hooks/useDashboardData";
import styles from "./Topbar.module.css";

interface TopbarProps {
  selected: LocationFilter;
  onSelect: (filter: LocationFilter) => void;
  updatedAt: string;
}

export function Topbar({ selected, onSelect, updatedAt }: TopbarProps) {
  return (
    <div className={styles.topbar}>
      <div className={styles.row}>
        <div className={styles.title}>Overzicht reviews</div>
        <div className={styles.updated}>bijgewerkt {updatedAt}</div>
        <div className={styles.rightControls}>
          <div className={styles.rangePill}>Laatste 7 dagen</div>
          <div className={styles.userAvatar}>LV</div>
        </div>
      </div>
      <div className={styles.tabs} role="tablist" aria-label="Locatie">
        <button
          type="button"
          role="tab"
          aria-selected={selected === "all"}
          className={
            selected === "all"
              ? `${styles.tab} ${styles.tabActive}`
              : styles.tab
          }
          onClick={() => onSelect("all")}
        >
          Alle locaties
        </button>
        {LOCATIONS.map((loc) => (
          <button
            key={loc.id}
            type="button"
            role="tab"
            aria-selected={selected === loc.id}
            className={
              selected === loc.id
                ? `${styles.tab} ${styles.tabActive}`
                : styles.tab
            }
            onClick={() => onSelect(loc.id)}
          >
            {loc.name}
          </button>
        ))}
      </div>
    </div>
  );
}
