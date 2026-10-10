import { VISIBLE_LOCATION_IDS } from "../config";
import { formatDateRangeLabel } from "../lib/format";
import type { LocationFilter } from "../hooks/useDashboardData";
import styles from "./Topbar.module.css";

const TAB_LABEL: Record<string, string> = {
  centrum: "Coffeeshop BIJ",
};

// Only these profile tabs are live for now (see ../config) — the rest of
// LOCATIONS still exists in the data model, it just doesn't get its own
// tab yet. More tabs land once those profiles are ready to show on
// their own.
const VISIBLE_TABS: { filter: LocationFilter; label: string }[] = [
  { filter: "all", label: "Dashboard" },
  ...VISIBLE_LOCATION_IDS.map((id) => ({ filter: id, label: TAB_LABEL[id] ?? id })),
];

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
