import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The notice shown at the top of the dashboard for everyone (e.g. "Coffeeshop
// Sloterdijk is toegevoegd…"), set by an admin under Instellingen. Kept on
// the persistent volume like the other settings.

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", ".data");
const NOTICE_FILE = join(DATA_DIR, "notice.json");

export interface Notice {
  title: string;
  description: string;
  active: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

// Until an admin saves one: the Sloterdijk text that used to be built in,
// switched off, so it's there to reuse or edit.
const DEFAULT_NOTICE: Notice = {
  title: "Coffeeshop Sloterdijk is toegevoegd",
  description:
    "Tijdens de overdracht van het account zijn de reacties op de beoordelingen van Coffeeshop Sloterdijk komen te vervallen. Daardoor is het aantal onbeantwoorde reviews op dit moment erg hoog. We zijn met Google in gesprek om dit indien mogelijk terug te draaien.",
  active: false,
  updatedAt: null,
  updatedBy: null,
};

export class NoticeError extends Error {}

export function loadNotice(): Notice {
  if (!existsSync(NOTICE_FILE)) return DEFAULT_NOTICE;
  try {
    return { ...DEFAULT_NOTICE, ...(JSON.parse(readFileSync(NOTICE_FILE, "utf-8")) as Partial<Notice>) };
  } catch {
    return DEFAULT_NOTICE;
  }
}

export function saveNotice(input: unknown, username: string): Notice {
  const raw = (input ?? {}) as Partial<Notice>;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const description = typeof raw.description === "string" ? raw.description.trim() : "";
  const active = raw.active === true;
  if (title.length > 120) throw new NoticeError("De titel is te lang (maximaal 120 tekens).");
  if (description.length > 1000) throw new NoticeError("De beschrijving is te lang (maximaal 1000 tekens).");
  if (active && !title) throw new NoticeError("Geef de melding een titel voordat je hem actief zet.");
  const notice: Notice = { title, description, active, updatedAt: new Date().toISOString(), updatedBy: username };
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(NOTICE_FILE, JSON.stringify(notice, null, 2), "utf-8");
  return notice;
}
