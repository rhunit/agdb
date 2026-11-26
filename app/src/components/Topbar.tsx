import { LOCATION_TAB_LABEL, PUBLIC_ONLY_LOCATION_IDS, VISIBLE_LOCATION_IDS } from "../config";
import type { LocationFilter } from "../hooks/useDashboardData";
import type { DateRange } from "../lib/dateRange";
import { DateRangeSelector } from "./DateRangeSelector";
import { ExportPdfButton } from "./ExportPdfButton";
import { RefreshButton } from "./RefreshButton";
import styles from "./Topbar.module.css";

// Only these profile tabs are live for now (see ../config) — the rest of
// LOCATIONS still exists in the data model, it just doesn't get its own
// tab yet. More tabs land once those profiles are ready to show on
// their own.
// Boerejongens West (public data only) sits next to the other Boerejongens
// shops, after Almere.
const TAB_IDS = VISIBLE_LOCATION_IDS.flatMap((id) =>
  id === "almere" ? [id, ...PUBLIC_ONLY_LOCATION_IDS] : [id],
);
const VISIBLE_TABS: { filter: LocationFilter; label: string; publicOnly: boolean }[] = [
  { filter: "all", label: "Dashboard", publicOnly: false },
  ...TAB_IDS.map((id) => ({
    filter: id,
    label: LOCATION_TAB_LABEL[id],
    publicOnly: PUBLIC_ONLY_LOCATION_IDS.includes(id),
  })),
];

interface TopbarProps {
  selected: LocationFilter;
  onSelect: (filter: LocationFilter) => void;
  updatedAt: string;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

export function Topbar({
  selected,
  onSelect,
  updatedAt,
  dateRange,
  onDateRangeChange,
}: TopbarProps) {
  return (
    <div className={styles.topbar}>
      <div className={styles.row}>
        <div className={styles.title}>Overzicht reviews</div>
        <div className={styles.updated}>bijgewerkt {updatedAt}</div>
        <div className={styles.rightControls}>
          <RefreshButton />
          <DateRangeSelector value={dateRange} onChange={onDateRangeChange} />
          <ExportPdfButton />
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
            title={tab.publicOnly ? "Beperkte gegevens: alleen openbare Google Maps-data" : undefined}
          >
            {tab.label}
            {tab.publicOnly && (
              <span className={styles.limitedMark} aria-label="(beperkte gegevens)">
                *
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
