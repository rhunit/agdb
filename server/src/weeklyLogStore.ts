import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatDutchTimestamp, isoWeekString } from "./dateUtils.js";
import type { InternalLocationId } from "./googleBusinessProfile.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", ".data");
const LOG_FILE = join(DATA_DIR, "weekly-log.json");

export type LogType = "smoke" | "qr";

export interface WeeklyLogEntry {
  id: string;
  week: string;
  location: InternalLocationId;
  type: LogType;
  submitter: string;
  timestamp: string;
  note: string;
}

export interface NewWeeklyLogEntry {
  location: InternalLocationId;
  type: LogType;
  submitter: string;
  note: string;
}

// Seeds the store on first run so switching from mock to live data doesn't
// suddenly show an empty log — same entries the dashboard already shows.
const SEED_ENTRIES: WeeklyLogEntry[] = [
  {
    id: "w1",
    week: "2026-W36",
    location: "centrum",
    type: "smoke",
    submitter: "Lotte Verhoeven",
    timestamp: "07-09-2026 16:42",
    note: "Session met 8 gasten rond de nieuwe White Choco. Drie gasten gaven aan een review te laten; twee QR-kaartjes meegegeven.",
  },
  {
    id: "w2",
    week: "2026-W36",
    location: "oost",
    type: "qr",
    submitter: "Daan Smit",
    timestamp: "06-09-2026 11:08",
    note: "QR-standaard bij de kassa vervangen; 41 scans geregistreerd deze week (was 27).",
  },
  {
    id: "w3",
    week: "2026-W35",
    location: "depijp",
    type: "smoke",
    submitter: "Sem Jansen",
    timestamp: "31-08-2026 18:20",
    note: "Kleine sessie (4 gasten). Feedback: openingstijden op Google stonden verkeerd — doorgegeven aan ops.",
  },
  {
    id: "w4",
    week: "2026-W35",
    location: "centrum",
    type: "qr",
    submitter: "Lotte Verhoeven",
    timestamp: "31-08-2026 09:20",
    note: "27 scans deze week; standaard stond nog achter de deur, verplaatst naar de balie.",
  },
  {
    id: "w5",
    week: "2026-W34",
    location: "centrum",
    type: "qr",
    submitter: "Lotte Verhoeven",
    timestamp: "24-08-2026 09:55",
    note: "Flyers met QR bijgedrukt in AG-groen/goud. Personeel geïnstrueerd om er alleen naar te verwijzen, niet actief om reviews te vragen.",
  },
  {
    id: "w6",
    week: "2026-W34",
    location: "oost",
    type: "smoke",
    submitter: "Daan Smit",
    timestamp: "23-08-2026 19:10",
    note: "Sessie met 6 gasten; veel vragen over landrace-herkomst en kweekwijze.",
  },
  {
    id: "w7",
    week: "2026-W33",
    location: "depijp",
    type: "qr",
    submitter: "Sem Jansen",
    timestamp: "17-08-2026 18:31",
    note: "19 scans; materiaal was nog niet geleverd, tijdelijke kaartjes bijgemaakt.",
  },
  {
    id: "w8",
    week: "2026-W33",
    location: "centrum",
    type: "smoke",
    submitter: "Lotte Verhoeven",
    timestamp: "16-08-2026 17:05",
    note: "Sessie met 9 gasten; proefronde nieuwe hasj goed ontvangen.",
  },
  {
    id: "w9",
    week: "2026-W32",
    location: "oost",
    type: "qr",
    submitter: "Daan Smit",
    timestamp: "10-08-2026 12:40",
    note: "22 scans; QR-kaartje toegevoegd aan de bon in plaats van los kaartje.",
  },
  {
    id: "w10",
    week: "2026-W31",
    location: "depijp",
    type: "smoke",
    submitter: "Sem Jansen",
    timestamp: "03-08-2026 18:55",
    note: "Sessie met 5 gasten; korte uitleg gegeven over verschil sativa/indica landrace.",
  },
];

function load(): WeeklyLogEntry[] {
  if (!existsSync(LOG_FILE)) {
    save(SEED_ENTRIES);
    return SEED_ENTRIES;
  }
  try {
    return JSON.parse(readFileSync(LOG_FILE, "utf-8")) as WeeklyLogEntry[];
  } catch {
    return [];
  }
}

function save(entries: WeeklyLogEntry[]): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(LOG_FILE, JSON.stringify(entries, null, 2), "utf-8");
}

export function listWeeklyLog(): WeeklyLogEntry[] {
  return load().sort((a, b) => (a.week < b.week ? 1 : a.week > b.week ? -1 : 0));
}

// Intentionally no update/delete export — append-only at the code level,
// not just by convention.
export function appendWeeklyLogEntry(input: NewWeeklyLogEntry): WeeklyLogEntry {
  const now = new Date();
  const entry: WeeklyLogEntry = {
    id: `w-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    week: isoWeekString(now),
    location: input.location,
    type: input.type,
    submitter: input.submitter.trim(),
    timestamp: formatDutchTimestamp(now),
    note: input.note.trim(),
  };
  const entries = load();
  entries.push(entry);
  save(entries);
  return entry;
}
