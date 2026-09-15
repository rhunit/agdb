import { LOCATIONS } from "../data/mockData";
import type { WeeklyLogEntry } from "../types";
import { SourceBadge } from "./badges";
import styles from "./WeeklyLog.module.css";

const LOCATION_NAME = new Map(LOCATIONS.map((l) => [l.id, l.name]));

interface WeeklyLogProps {
  entries: WeeklyLogEntry[];
  weekCount: number;
}

function groupByWeek(entries: WeeklyLogEntry[]) {
  const groups: { week: string; entries: WeeklyLogEntry[] }[] = [];
  for (const entry of entries) {
    const group = groups.find((g) => g.week === entry.week);
    if (group) group.entries.push(entry);
    else groups.push({ week: entry.week, entries: [entry] });
  }
  return groups;
}

export function WeeklyLog({ entries, weekCount }: WeeklyLogProps) {
  const groups = groupByWeek(entries);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.title}>Weeklog · handmatige updates</div>
        <span className={styles.appendOnly}>APPEND-ONLY</span>
        <div className={styles.count}>
          {entries.length} entries · {weekCount} weken
        </div>
      </div>

      {groups.length === 0 ? (
        <div className={styles.empty}>Geen regels voor deze selectie.</div>
      ) : (
        <div className={styles.timeline}>
          {groups.map((group, i) => (
            <div key={group.week} className={styles.row}>
              <div className={styles.weekLabel}>{group.week}</div>
              <div className={styles.timelineTrack}>
                <div
                  className={styles.dot}
                  style={{
                    background: i === 0 ? "var(--ag-green)" : "#b6ada5",
                  }}
                />
                {group.entries.map((entry) => (
                  <div key={entry.id} className={styles.entry}>
                    <div className={styles.entryHeader}>
                      <SourceBadge source={entry.type} />
                      <span className={styles.entryLocation}>
                        {LOCATION_NAME.get(entry.location)}
                      </span>
                      <span className={styles.entryMeta}>
                        {entry.submitter} · {entry.timestamp}
                      </span>
                    </div>
                    <div className={styles.entryNote}>{entry.note}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.footnote}>
        Regels worden nooit gewijzigd of verwijderd · correcties worden als
        nieuwe regel toegevoegd
      </div>
    </div>
  );
}
