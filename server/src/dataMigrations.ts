import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTerms, saveTerms } from "./mentionsStore.js";

// One-time changes to what's already stored on the persistent volume, run
// at startup before anything reads it. Each runs once; done ones are
// recorded in .data/migrations.json.

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", ".data");
const DONE_FILE = join(DATA_DIR, "migrations.json");

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, "utf-8"));
}

function writeJson(file: string, data: unknown): void {
  writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

/** Renames a location id wherever stored data refers to it: every
 * `location` field (review history, reply log, Places history, weekly log)
 * and the Places cache, which is keyed by id. */
function renameLocation(from: string, to: string): void {
  const relabel = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(relabel);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, k === "location" && v === from ? to : relabel(v)]),
      );
    }
    return value;
  };
  for (const name of ["review-history.json", "reply-log.json", "places-history.json", "weekly-log.json"]) {
    const file = join(DATA_DIR, name);
    if (existsSync(file)) writeJson(file, relabel(readJson(file)));
  }
  const cacheFile = join(DATA_DIR, "places-cache.json");
  if (existsSync(cacheFile)) {
    const cache = readJson(cacheFile) as Record<string, unknown>;
    if (from in cache && !(to in cache)) {
      cache[to] = cache[from];
      delete cache[from];
      writeJson(cacheFile, cache);
    }
  }
}

/** Adds tracked mention terms (or fills in a missing Google Alerts feed),
 * keeping everything already set up in Vermeldingen → Zoektermen. */
function addMentionTerms(add: { term: string; alertsFeedUrl: string; alertsOnly: boolean }[]): void {
  const terms = loadTerms();
  for (const a of add) {
    const existing = terms.find((t) => t.term.toLowerCase() === a.term.toLowerCase());
    if (existing) {
      existing.alertsFeedUrl ??= a.alertsFeedUrl;
    } else {
      terms.push({ ...a, exclude: [], matchCase: false });
    }
  }
  saveTerms(terms);
}

const FEED = "https://www.google.nl/alerts/feeds/05724818571195403781";

const MIGRATIONS: { id: string; run: () => void }[] = [
  // Coffeeshop Sloterdijk's internal id was the historical "oost".
  { id: "rename-location-oost-to-sloterdijk", run: () => renameLocation("oost", "sloterdijk") },
  {
    id: "mention-terms-topics-2026-11",
    run: () =>
      addMentionTerms([
        { term: "Top 5 coffeeshops", alertsFeedUrl: `${FEED}/6187541511528107308`, alertsOnly: true },
        { term: "Top 10 coffeeshops", alertsFeedUrl: `${FEED}/3354795128526718366`, alertsOnly: true },
        { term: "Beste coffeeshop", alertsFeedUrl: `${FEED}/7097446507546715527`, alertsOnly: true },
        { term: "Spacecake", alertsFeedUrl: `${FEED}/7394153610603996636`, alertsOnly: true },
        // Our own product name: searched everywhere, like the shop names.
        { term: "Spacetry", alertsFeedUrl: `${FEED}/5227008320613579641`, alertsOnly: false },
      ]),
  },
];

export function runDataMigrations(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const done = existsSync(DONE_FILE) ? (readJson(DONE_FILE) as Record<string, string>) : {};
  for (const m of MIGRATIONS) {
    if (done[m.id]) continue;
    m.run();
    done[m.id] = new Date().toISOString();
    writeJson(DONE_FILE, done);
    console.log(`data migration: ${m.id} done`);
  }
}
