import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The "Vermeldingen" tab: places on the web where one of the tracked terms
// (company and shop names) came up — Reddit posts, news articles, pages
// Google Alerts found. Kept on the persistent volume like the review
// history: the search terms in mentions-config.json, what was found in
// mentions.json. Only a title and a first line are stored per mention,
// straight from the source (no AI).

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", ".data");
const CONFIG_FILE = join(DATA_DIR, "mentions-config.json");
const ITEMS_FILE = join(DATA_DIR, "mentions.json");

export type MentionSource = "reddit" | "news" | "alerts";

export interface MentionTerm {
  term: string;
  /** Words that mark a hit as noise, e.g. a different "Boerejongens". */
  exclude: string[];
  /** Require the exact capitalisation in the title or first line — search
   * engines ignore case, and "Coffeeshop BIJ" would otherwise also match
   * every "coffeeshop bij het station". */
  matchCase: boolean;
  /** The term's Google Alerts feed ("Bezorgen aan: RSS-feed"), if set up. */
  alertsFeedUrl: string | null;
  /** A topic rather than a name ("Top 10 coffeeshops", "Spacecake"): only
   * its Google Alert is read (Reddit and Google Nieuws would flood the list),
   * and an article counts when all its words are in one sentence instead of
   * the exact phrase. */
  alertsOnly: boolean;
}

export interface Mention {
  id: string;
  url: string;
  source: MentionSource;
  /** Where on that source: "r/Amsterdam", a news publisher, a site's domain. */
  sourceName: string;
  title: string;
  firstLine: string;
  /** When the source says it was published, if it says. */
  publishedAt: string | null;
  /** When the dashboard first found it. */
  foundAt: string;
  /** Every tracked term this mention came up for. */
  terms: string[];
  hidden: boolean;
  hiddenBy: string | null;
}

const DEFAULT_TERMS: MentionTerm[] = [
  "Amsterdam Genetics",
  "Boerejongens",
  "Coffeeshop BIJ",
  "Boerejongens West",
  "Boerejongens Centrum",
  "Boerejongens Almere",
  "Coffeeshop Sloterdijk",
].map((term) => ({
  term,
  exclude: [],
  matchCase: term === "Coffeeshop BIJ",
  alertsFeedUrl: null,
  alertsOnly: false,
}));

// Enough history to look back on, small enough to load in one request.
const MAX_ITEMS = 3000;

function readJson<T>(file: string, fallback: T): T {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

export function loadTerms(): MentionTerm[] {
  return readJson<{ terms: MentionTerm[] }>(CONFIG_FILE, { terms: DEFAULT_TERMS }).terms.map((t) => ({
    ...t,
    // Saved before this field existed.
    alertsOnly: t.alertsOnly ?? false,
  }));
}

export class MentionTermError extends Error {}

/** Replaces the tracked terms (the admin's "Zoektermen" form). */
export function saveTerms(input: unknown): MentionTerm[] {
  if (!Array.isArray(input)) throw new MentionTermError("Ongeldige lijst met zoektermen.");
  const seen = new Set<string>();
  const terms: MentionTerm[] = [];
  for (const raw of input as Partial<MentionTerm>[]) {
    const term = typeof raw?.term === "string" ? raw.term.trim() : "";
    if (!term) continue;
    if (term.length > 80) throw new MentionTermError(`Zoekterm "${term.slice(0, 20)}…" is te lang.`);
    if (seen.has(term.toLowerCase())) throw new MentionTermError(`"${term}" staat er twee keer in.`);
    seen.add(term.toLowerCase());
    const feed = typeof raw.alertsFeedUrl === "string" ? raw.alertsFeedUrl.trim() : "";
    if (feed && !/^https:\/\/www\.google\.[a-z.]+\/alerts\/feeds\//.test(feed)) {
      throw new MentionTermError(
        `De Google Alerts-link bij "${term}" klopt niet. Kopieer de RSS-link van de melding ` +
          "(begint met https://www.google.com/alerts/feeds/).",
      );
    }
    terms.push({
      term,
      exclude: Array.isArray(raw.exclude)
        ? raw.exclude.filter((w): w is string => typeof w === "string").map((w) => w.trim()).filter(Boolean)
        : [],
      matchCase: Boolean(raw.matchCase),
      alertsFeedUrl: feed || null,
      alertsOnly: Boolean(raw.alertsOnly),
    });
  }
  writeJson(CONFIG_FILE, { terms });
  return terms;
}

interface ItemsFile {
  items: Mention[];
  /** Pages checked and found not to mention any term in the article
   * itself (e.g. only in a "Lees ook" teaser) — remembered so they aren't
   * fetched and checked again on every run. id → when rejected. */
  rejected?: Record<string, string>;
}

function loadFile(): ItemsFile {
  return readJson<ItemsFile>(ITEMS_FILE, { items: [] });
}

export function loadMentions(): Mention[] {
  return loadFile().items;
}

/** Whether a page is already listed ("known") or was checked and turned
 * down ("rejected") — either way it isn't fetched and checked again. */
export function pageState(id: string): "known" | "rejected" | "new" {
  const file = loadFile();
  if (file.items.some((m) => m.id === id)) return "known";
  return file.rejected?.[id] ? "rejected" : "new";
}

const MAX_REJECTED = 5000;

export function addRejected(ids: string[]): void {
  if (ids.length === 0) return;
  const file = loadFile();
  const rejected = { ...(file.rejected ?? {}) };
  const now = new Date().toISOString();
  for (const id of ids) rejected[id] = now;
  const kept = Object.entries(rejected)
    .sort((a, b) => b[1].localeCompare(a[1]))
    .slice(0, MAX_REJECTED);
  writeJson(ITEMS_FILE, { ...file, rejected: Object.fromEntries(kept) });
}

export function mentionId(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

/** Adds what a check found. A URL already known only gains the new term
 * (one article can mention "Boerejongens" and "Boerejongens West"), so the
 * same page is never listed twice. Returns how many were new. */
export function addMentions(
  found: (Omit<Mention, "id" | "foundAt" | "hidden" | "hiddenBy"> & {
    /** What identifies the page across checks, when the stored url differs
     * from what the search returned (e.g. a resolved Google News link). */
    idUrl?: string;
  })[],
): number {
  const file = loadFile();
  const items = file.items;
  const byId = new Map(items.map((m) => [m.id, m]));
  const now = new Date().toISOString();
  let added = 0;
  for (const { idUrl, ...f } of found) {
    const id = mentionId(idUrl ?? f.url);
    const existing = byId.get(id);
    if (existing) {
      for (const t of f.terms) if (!existing.terms.includes(t)) existing.terms.push(t);
      continue;
    }
    const mention: Mention = { ...f, id, foundAt: now, hidden: false, hiddenBy: null };
    items.push(mention);
    byId.set(id, mention);
    added++;
  }
  const newestFirst = items.sort((a, b) =>
    (b.publishedAt ?? b.foundAt).localeCompare(a.publishedAt ?? a.foundAt),
  );
  writeJson(ITEMS_FILE, { ...file, items: newestFirst.slice(0, MAX_ITEMS) });
  return added;
}

/** "Niet relevant" / "Toch tonen" on one mention. */
export function setMentionHidden(id: string, hidden: boolean, username: string): Mention | null {
  const file = loadFile();
  const items = file.items;
  const mention = items.find((m) => m.id === id);
  if (!mention) return null;
  mention.hidden = hidden;
  mention.hiddenBy = hidden ? username : null;
  writeJson(ITEMS_FILE, file);
  return mention;
}
