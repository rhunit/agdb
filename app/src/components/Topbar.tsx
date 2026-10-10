import { formatDateRangeLabel } from "../lib/format";
import type { LocationFilter } from "../hooks/useDashboardData";
import styles from "./Topbar.module.css";

// Only these two profile tabs are live for now — the rest of LOCATIONS
// still exists in the data model (and still feeds the "Dashboard" bundle
// below), it just doesn't get its own tab yet. More tabs land once those
// profiles are ready to show on their own.
const VISIBLE_TABS: { filter: LocationFilter; label: string }[] = [
  { filter: "all", label: "Dashboard" },
  { filter: "centrum", label: "Coffeeshop BIJ" },
];

// Shared with LocationsOverview so its cards never link to a location
// that doesn't have a working tab to land on yet.
export const VISIBLE_LOCATION_IDS = VISIBLE_TABS.map((t) => t.filter).filter(
  (f): f is Exclude<LocationFilter, "all"> => f !== "all",
);

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
          <div className={styles.rangePill}>{formatDateRangeLabel(7)}</div>
          <div className={styles.userAvatar}>LV</div>
        </div>
      </div>
      <div className={styles.tabs} role="tablist" aria-label="Profiel">
        {VISIBLE_TABS.map((tab) => (
          <button
            key={tab.filter}
            type="button"
            role="tab"
            aria-selected={selected === tab.filter}
            className={
              selected === tab.filter
                ? `${styles.tab} ${styles.tabActive}`
                : styles.tab
            }
            onClick={() => onSelect(tab.filter)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
