import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isoWeekLabel, type InternalLocationId } from "./googleBusinessProfile.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", ".data");
const HISTORY_FILE = join(DATA_DIR, "places-history.json");

interface Snapshot {
  week: string;
  location: InternalLocationId;
  userRatingCount: number;
  capturedAt: string;
}

function load(): Snapshot[] {
  if (!existsSync(HISTORY_FILE)) return [];
  try {
    return JSON.parse(readFileSync(HISTORY_FILE, "utf-8")) as Snapshot[];
  } catch {
    return [];
  }
}

function save(snapshots: Snapshot[]): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(HISTORY_FILE, JSON.stringify(snapshots, null, 2), "utf-8");
}

/** Records this week's total review count for a location, overwriting any
 * earlier snapshot from the same ISO week — the growth calculation only
 * needs one point per week, so a later check-in the same week just
 * refines that week's value rather than adding noise. */
export function recordSnapshot(
  location: InternalLocationId,
  userRatingCount: number,
): void {
  const week = isoWeekLabel(new Date());
  const snapshots = load();
  const idx = snapshots.findIndex(
    (s) => s.week === week && s.location === location,
  );
  const entry: Snapshot = {
    week,
    location,
    userRatingCount,
    capturedAt: new Date().toISOString(),
  };
  if (idx >= 0) snapshots[idx] = entry;
  else snapshots.push(entry);
  save(snapshots);
}

/** Week-over-week new-review counts, derived from consecutive weekly
 * snapshots of each location's total review count. Clamped at 0 — a drop
 * (a review being removed, or Google revising the count) isn't "negative
 * new reviews", it's just not a gain. Only weeks with both this and the
 * prior week's snapshot produce a value, so the series is honestly short
 * until the dashboard has been open across enough weeks to build it up. */
export function getWeeklyReviewGrowth(
  locations: InternalLocationId[],
): Record<string, Partial<Record<InternalLocationId, number>>> {
  const snapshots = load();
  const out: Record<string, Partial<Record<InternalLocationId, number>>> = {};

  for (const location of locations) {
    const perLocation = snapshots
      .filter((s) => s.location === location)
      .sort((a, b) => (a.week < b.week ? -1 : a.week > b.week ? 1 : 0));

    for (let i = 1; i < perLocation.length; i++) {
      const week = perLocation[i].week;
      const delta = Math.max(
        0,
        perLocation[i].userRatingCount - perLocation[i - 1].userRatingCount,
      );
      out[week] ??= {};
      out[week][location] = delta;
    }
  }

  return out;
}
