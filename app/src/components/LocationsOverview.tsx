import { LOCATION_COLOR } from "./TrendChart";
import { useLocationSummaries } from "../hooks/useLocationSummaries";
import { formatDutchDecimal } from "../lib/format";
import type { LocationId } from "../types";
import styles from "./LocationsOverview.module.css";

interface LocationsOverviewProps {
  onSelect: (id: LocationId) => void;
}

export function LocationsOverview({ onSelect }: LocationsOverviewProps) {
  const summaries = useLocationSummaries();

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.title}>Locaties</div>
        <div className={styles.subtitle}>
          Kies een locatie om het reviewoverzicht van die vestiging te
          bekijken.
        </div>
      </div>

      <div className={styles.grid}>
        {summaries.map((loc) => (
          <button
            key={loc.id}
            type="button"
            className={styles.card}
            onClick={() => onSelect(loc.id)}
          >
            <div
              className={styles.hero}
              style={{ background: LOCATION_COLOR[loc.id] }}
            >
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z"
                  stroke="white"
                  strokeWidth="1.6"
                />
                <circle cx="12" cy="10" r="2.6" stroke="white" strokeWidth="1.6" />
              </svg>
            </div>

            <div className={styles.body}>
              <div className={styles.name}>{loc.name}</div>
              <div className={styles.subtext}>Google Business Profile</div>

              <div className={styles.tags}>
                <span className={styles.tag}>
                  ★ {formatDutchDecimal(loc.avgScore)}
                  {loc.avgScoreIsLive && (
                    <span className={styles.liveBadge}>LIVE</span>
                  )}
                </span>
                <span className={styles.tag}>
                  {loc.reviewCount} reviews deze week
                </span>
              </div>

              <span className={styles.cta}>Bekijk locatie →</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
